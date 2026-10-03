const mongoose = require('mongoose');
const CreditNote    = require('../models/CreditNote');
const Branch        = require('../models/Branch');
const Customer      = require('../models/Customer');
const FinancialYear = require('../models/FinancialYear');
const Invoice       = require('../models/Invoice');
const Tax           = require('../models/Tax');
const ChartOfAccount = require('../models/ChartOfAccount');
const journalService = require('./journalEntry.service');

const EPSILON = 0.01;
const id = (v) => v?.toString();
const fail = (message, statusCode = 400, errorCode) =>
  Object.assign(new Error(message), { statusCode, errorCode });

// ─── Totals validation ────────────────────────────────────────────────────────

const validateTotals = (data) => {
  const subTotal  = data.lineItems.reduce((sum, l) => sum + l.amount,      0);
  const taxAmount = data.lineItems.reduce((sum, l) => sum + l.taxAmount,   0);

  if (Math.abs(data.subTotal   - subTotal)                   > EPSILON)
    throw fail('subTotal does not match sum of line amounts',    400, 'INVALID_TOTALS');
  if (Math.abs(data.taxAmount  - taxAmount)                  > EPSILON)
    throw fail('taxAmount does not match sum of line taxAmounts', 400, 'INVALID_TOTALS');
  if (Math.abs(data.totalAmount - (data.subTotal + data.taxAmount)) > EPSILON)
    throw fail('totalAmount must equal subTotal + taxAmount',   400, 'INVALID_TOTALS');
  if (data.totalAmount <= 0)
    throw fail('totalAmount must be greater than zero',         400, 'INVALID_TOTALS');

  for (const line of data.lineItems) {
    if (Math.abs(line.totalAmount - (line.amount + line.taxAmount)) > EPSILON)
      throw fail('Line totalAmount is inconsistent (amount + taxAmount)', 400, 'INVALID_LINE_TOTAL');
  }
};

// ─── Reference validation ─────────────────────────────────────────────────────

const validateReferences = async (data) => {
  // 1. Branch must exist and belong to the given company
  const branch = await Branch.findOne({ _id: data.branchId, companyId: data.companyId });
  if (!branch) throw fail('Branch not found or does not belong to the specified company', 400, 'INVALID_BRANCH');

  // 2. Financial year must belong to companyId
  const fy = await FinancialYear.findById(data.financialYearId);
  if (!fy || id(fy.companyId) !== id(data.companyId))
    throw fail('Financial year does not belong to the specified company', 400, 'INVALID_FINANCIAL_YEAR_COMPANY');
  if (fy.isLocked)
    throw fail('Cannot create a credit note in a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED');

  const noteDate = new Date(data.date);
  if (noteDate < fy.startDate || noteDate > fy.endDate)
    throw fail('Note date must fall within the selected financial year', 400, 'NOTE_DATE_OUTSIDE_FINANCIAL_YEAR');

  // 3. Customer must belong to companyId
  const customer = await Customer.findOne({ _id: data.customerId, companyId: data.companyId, isActive: true });
  if (!customer) throw fail('Customer not found for this company', 404, 'CUSTOMER_NOT_FOUND');

  // 4. originalInvoiceId (if provided) must belong to same company, branch, and customer
  if (data.originalInvoiceId) {
    const invoice = await Invoice.findOne({
      _id: data.originalInvoiceId,
      companyId: data.companyId,
      customerId: data.customerId
    });
    if (!invoice) throw fail('Original invoice not found or does not match company/customer', 400, 'INVALID_ORIGINAL_INVOICE');
    if (invoice.status === 'CANCELLED') throw fail('Cannot link a credit note to a cancelled invoice', 400, 'INVOICE_CANCELLED');
  }

  // 5. Validate tax rates against Module 25
  const taxIds = [...new Set(data.lineItems.filter((l) => l.taxRateId).map((l) => l.taxRateId))];
  if (taxIds.length > 0) {
    const count = await Tax.countDocuments({ _id: { $in: taxIds }, companyId: data.companyId, isActive: true });
    if (count !== taxIds.length)
      throw fail('One or more tax rates are invalid for this company', 400, 'INVALID_TAX_RATE');
  }

  // TODO: validate productIds against Module 7 Product/Service once that model is added.

  return { fy, customer };
};

// ─── Journal entry posting ────────────────────────────────────────────────────

/**
 * Post a double-entry journal for a credit note:
 *   Dr  Sales Return / Sales Adjustment  (subTotal)
 *   Dr  Output GST Reversal              (taxAmount)
 *   Cr  Customer Accounts Receivable     (totalAmount)
 *
 * COA account codes (same convention as invoice.service):
 *   4110 – Sales Revenue (reversed on credit note as Sales Return / Adjustment)
 *   2200 – Output GST
 *   customer.coaAccountId – Customer AR ledger
 */
const postCreditNoteJournalEntry = async (creditNote, customer, userId) => {
  const companyId      = creditNote.companyId;
  const financialYearId = creditNote.financialYearId;

  // Resolve accounts
  const customerAccount = customer.coaAccountId
    ? await ChartOfAccount.findById(customer.coaAccountId)
    : null;

  const salesReturnAccount = await ChartOfAccount.findOne({
    companyId, code: '4110', isActive: true, isGroup: false
  });

  const gstAccount = creditNote.taxAmount > 0
    ? await ChartOfAccount.findOne({ companyId, code: '2200', isActive: true, isGroup: false })
    : null;

  const lines = [];

  // Dr Sales Return (reversal of revenue)
  if (salesReturnAccount) {
    lines.push({
      accountId: salesReturnAccount._id,
      debit:     creditNote.subTotal,
      credit:    0,
      remarks:   'Sales return / adjustment (credit note)'
    });
  }

  // Dr Output GST reversal
  if (gstAccount && creditNote.taxAmount > 0) {
    lines.push({
      accountId: gstAccount._id,
      debit:     creditNote.taxAmount,
      credit:    0,
      remarks:   'Output GST reversal (credit note)'
    });
  }

  // Cr Customer Accounts Receivable
  if (customerAccount) {
    lines.push({
      accountId: customerAccount._id,
      debit:     0,
      credit:    creditNote.totalAmount,
      remarks:   'Customer receivable reduction (credit note)'
    });
  }

  if (lines.length < 2) {
    throw fail(
      'Unable to post credit note journal entry — required COA accounts are unavailable. ' +
      'Ensure Sales account (4110) and the customer AR account exist.',
      500,
      'CREDIT_NOTE_JOURNAL_ENTRY_FAILED'
    );
  }

  return journalService.createJournalEntry({
    companyId,
    financialYearId,
    // branchId is stored on the CreditNote; JournalEntry model does not yet
    // have a branchId field. When Module 12 gains branch dimension, pass it here.
    entryDate:   creditNote.date,
    reference:   creditNote.reference || `CN-${creditNote._id}`,
    narration:   `Credit note ${creditNote.reference || creditNote._id} — ${creditNote.reason}`,
    lines
  }, userId);
};

// ─── Invoice linkage ──────────────────────────────────────────────────────────

/**
 * If the credit note is linked to an original invoice, reduce the invoice's
 * balanceDue and update its status accordingly.
 *
 * TODO: Full invoice linkage integration should be finalised with Module 8
 * when payment-application flow is solidified. The current implementation
 * writes directly to the Invoice document.
 */
const applyToInvoice = async (creditNote, userId) => {
  if (!creditNote.originalInvoiceId) return;

  const invoice = await Invoice.findById(creditNote.originalInvoiceId);
  if (!invoice || invoice.status === 'CANCELLED') return;

  const newBalance = Math.max(0, (invoice.balanceDue || 0) - creditNote.totalAmount);
  invoice.balanceDue = newBalance;

  if (newBalance === 0 && invoice.status !== 'PAID') {
    invoice.status = 'PAID';
  } else if (newBalance < invoice.grandTotal && invoice.status === 'POSTED') {
    invoice.status = 'PARTIALLY_PAID';
  }

  invoice.updatedBy = userId;
  await invoice.save();
};

// ─── Shape helpers ────────────────────────────────────────────────────────────

const shape = (doc, detail = false) => ({
  id:               id(doc._id),
  companyId:        id(doc.companyId),
  branchId:         id(doc.branchId),
  financialYearId:  id(doc.financialYearId),
  customerId:       doc.customerId?._id ? id(doc.customerId._id) : id(doc.customerId),
  customerName:     doc.customerId?.name || null,
  originalInvoiceId: doc.originalInvoiceId ? id(doc.originalInvoiceId) : null,
  date:             doc.date,
  reason:           doc.reason,
  reference:        doc.reference || '',
  ...(detail ? { lineItems: doc.lineItems } : {}),
  subTotal:         doc.subTotal,
  taxAmount:        doc.taxAmount,
  totalAmount:      doc.totalAmount,
  status:           doc.status,
  journalEntryId:   doc.journalEntryId ? id(doc.journalEntryId) : null,
  reversalJournalEntryId: doc.reversalJournalEntryId ? id(doc.reversalJournalEntryId) : null,
  createdAt:        doc.createdAt,
  updatedAt:        doc.updatedAt
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new credit note:
 *   1. Validate totals consistency.
 *   2. Validate company, branch, FY, customer, invoice, taxes.
 *   3. Save CreditNote.
 *   4. Post journal entry (Module 12).
 *   5. Optionally reduce linked invoice balanceDue.
 */
const createCreditNote = async (data, userId) => {
  validateTotals(data);
  const { customer } = await validateReferences(data);

  const creditNote = await CreditNote.create({
    ...data,
    date:   new Date(data.date),
    status: 'POSTED',
    createdBy: userId,
    updatedBy: userId
  });

  try {
    // Post journal entry
    const journalEntry = await postCreditNoteJournalEntry(
      { ...creditNote.toObject() },
      customer,
      userId
    );
    creditNote.journalEntryId = journalEntry._id;
    creditNote.updatedBy = userId;
    await creditNote.save();

    // Apply credit to original invoice
    await applyToInvoice(creditNote, userId);

    const populated = await CreditNote.findById(creditNote._id).populate('customerId', 'name').lean();
    return shape(populated, true);
  } catch (error) {
    // Roll back the saved credit note so we don't leave orphaned documents
    await CreditNote.deleteOne({ _id: creditNote._id });
    throw error;
  }
};

/**
 * List credit notes with company + optional branch filter.
 * branchId is optional — when omitted, all branches for the company are returned.
 */
const listCreditNotes = async (q) => {
  const filter = { companyId: q.companyId };

  if (q.branchId)        filter.branchId        = q.branchId;
  if (q.financialYearId) filter.financialYearId  = q.financialYearId;
  if (q.customerId)      filter.customerId        = q.customerId;
  if (q.status)          filter.status            = q.status;

  if (q.from || q.to) {
    filter.date = {};
    if (q.from) filter.date.$gte = new Date(q.from);
    if (q.to)   filter.date.$lte = new Date(q.to);
  }

  const page  = Number(q.page  || 1);
  const limit = Number(q.limit || 20);

  const [items, total] = await Promise.all([
    CreditNote.find(filter)
      .populate('customerId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CreditNote.countDocuments(filter)
  ]);

  return {
    items: items.map((doc) => shape(doc)),
    pagination: { page, limit, total }
  };
};

/**
 * Find a credit note document by ID (Mongoose doc, not lean).
 */
const getCreditNoteDocument = async (noteId) => {
  if (!mongoose.isValidObjectId(noteId))
    throw fail('Credit note not found', 404, 'CREDIT_NOTE_NOT_FOUND');
  const doc = await CreditNote.findById(noteId);
  if (!doc) throw fail('Credit note not found', 404, 'CREDIT_NOTE_NOT_FOUND');
  return doc;
};

module.exports = { createCreditNote, listCreditNotes, getCreditNoteDocument, shape };
