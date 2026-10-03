const mongoose = require('mongoose');
const DebitNote     = require('../models/DebitNote');
const Branch        = require('../models/Branch');
const Supplier      = require('../models/Supplier');
const FinancialYear = require('../models/FinancialYear');
const Purchase      = require('../models/Purchase');
const Tax           = require('../models/Tax');
const ChartOfAccount = require('../models/ChartOfAccount');
const journalService = require('./journalEntry.service');

const EPSILON = 0.01;
const id   = (v) => v?.toString();
const fail = (message, statusCode = 400, errorCode) =>
  Object.assign(new Error(message), { statusCode, errorCode });

// ─── Totals validation ────────────────────────────────────────────────────────

const validateTotals = (data) => {
  const subTotal  = data.lineItems.reduce((sum, l) => sum + l.amount,    0);
  const taxAmount = data.lineItems.reduce((sum, l) => sum + l.taxAmount, 0);

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
    throw fail('Cannot create a debit note in a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED');

  const noteDate = new Date(data.date);
  if (noteDate < fy.startDate || noteDate > fy.endDate)
    throw fail('Note date must fall within the selected financial year', 400, 'NOTE_DATE_OUTSIDE_FINANCIAL_YEAR');

  // 3. Supplier must belong to companyId
  const supplier = await Supplier.findOne({ _id: data.supplierId, companyId: data.companyId, isActive: true });
  if (!supplier) throw fail('Supplier not found for this company', 404, 'SUPPLIER_NOT_FOUND');

  // 4. originalPurchaseId (if provided) must belong to same company, branch, and supplier
  if (data.originalPurchaseId) {
    const purchase = await Purchase.findOne({
      _id: data.originalPurchaseId,
      companyId: data.companyId,
      supplierId: data.supplierId
    });
    if (!purchase) throw fail('Original purchase not found or does not match company/supplier', 400, 'INVALID_ORIGINAL_PURCHASE');
    if (purchase.status === 'CANCELLED') throw fail('Cannot link a debit note to a cancelled purchase', 400, 'PURCHASE_CANCELLED');
  }

  // 5. Validate tax rates against Module 25
  const taxIds = [...new Set(data.lineItems.filter((l) => l.taxRateId).map((l) => l.taxRateId))];
  if (taxIds.length > 0) {
    const count = await Tax.countDocuments({ _id: { $in: taxIds }, companyId: data.companyId, isActive: true });
    if (count !== taxIds.length)
      throw fail('One or more tax rates are invalid for this company', 400, 'INVALID_TAX_RATE');
  }

  // TODO: validate productIds against Module 7 Product/Service once that model is added.

  return { fy, supplier };
};

// ─── Journal entry posting ────────────────────────────────────────────────────

/**
 * Post a double-entry journal for a debit note (purchase return/adjustment):
 *   Dr  Supplier Accounts Payable  (totalAmount)    — reduces payable
 *   Cr  Purchase / Inventory       (subTotal)        — reverses purchase cost
 *   Cr  Input GST Reversal         (taxAmount)       — reverses input GST claim
 *
 * COA account codes (same convention as purchase.service):
 *   2310 – Sundry Creditors / Supplier Payable
 *   5110 – Purchase / Inventory
 *   1410 – Input GST
 *   supplier.payableAccountId – supplier-specific payable ledger (if set)
 */
const postDebitNoteJournalEntry = async (debitNote, supplier, userId) => {
  const companyId       = debitNote.companyId;
  const financialYearId = debitNote.financialYearId;

  // Supplier payable account (dedicated or shared Sundry Creditors)
  const payableAccount = supplier.payableAccountId
    ? await ChartOfAccount.findById(supplier.payableAccountId)
    : await ChartOfAccount.findOne({ companyId, code: '2310', isActive: true, isGroup: false });

  const purchaseAccount = await ChartOfAccount.findOne({
    companyId, code: '5110', isActive: true, isGroup: false
  });

  const gstAccount = debitNote.taxAmount > 0
    ? await ChartOfAccount.findOne({ companyId, code: '1410', isActive: true, isGroup: false })
    : null;

  if (!payableAccount || !purchaseAccount || (debitNote.taxAmount > 0 && !gstAccount)) {
    throw fail(
      'Unable to post debit note journal entry — required COA accounts are unavailable. ' +
      'Ensure Purchase account (5110), Input GST account (1410), and the supplier payable account exist.',
      500,
      'DEBIT_NOTE_JOURNAL_ENTRY_FAILED'
    );
  }

  const lines = [
    // Dr Supplier Payable (reduces amount owed to supplier)
    {
      accountId: payableAccount._id,
      debit:     debitNote.totalAmount,
      credit:    0,
      remarks:   'Supplier payable reduction (debit note)'
    },
    // Cr Purchase / Inventory (reverses purchase cost)
    {
      accountId: purchaseAccount._id,
      debit:     0,
      credit:    debitNote.subTotal,
      remarks:   'Purchase cost reversal (debit note)'
    }
  ];

  // Cr Input GST reversal
  if (gstAccount && debitNote.taxAmount > 0) {
    lines.push({
      accountId: gstAccount._id,
      debit:     0,
      credit:    debitNote.taxAmount,
      remarks:   'Input GST reversal (debit note)'
    });
  }

  return journalService.createJournalEntry({
    companyId,
    financialYearId,
    // branchId dimension to be passed when Module 12 JournalEntry model gains it.
    entryDate:   debitNote.date,
    reference:   debitNote.reference || `DN-${debitNote._id}`,
    narration:   `Debit note ${debitNote.reference || debitNote._id} — ${debitNote.reason}`,
    lines
  }, userId);
};

// ─── Purchase linkage ─────────────────────────────────────────────────────────

/**
 * Reduce linked purchase's balanceDue by the debit note totalAmount.
 *
 * TODO: Full purchase linkage integration should be finalised with Module 10
 * when payment-application flow is solidified. The current implementation
 * writes directly to the Purchase document.
 */
const applyToPurchase = async (debitNote, userId) => {
  if (!debitNote.originalPurchaseId) return;

  const purchase = await Purchase.findById(debitNote.originalPurchaseId);
  if (!purchase || purchase.status === 'CANCELLED') return;

  const newBalance = Math.max(0, (purchase.balanceDue || 0) - debitNote.totalAmount);
  purchase.balanceDue = newBalance;

  if (newBalance === 0 && purchase.status !== 'PAID') {
    purchase.status = 'PAID';
  } else if (newBalance < purchase.grandTotal && purchase.status === 'POSTED') {
    purchase.status = 'PARTIALLY_PAID';
  }

  purchase.updatedBy = userId;
  await purchase.save();
};

// ─── Shape helpers ────────────────────────────────────────────────────────────

const shape = (doc, detail = false) => ({
  id:                  id(doc._id),
  companyId:           id(doc.companyId),
  branchId:            id(doc.branchId),
  financialYearId:     id(doc.financialYearId),
  supplierId:          doc.supplierId?._id ? id(doc.supplierId._id) : id(doc.supplierId),
  supplierName:        doc.supplierId?.name || null,
  originalPurchaseId:  doc.originalPurchaseId ? id(doc.originalPurchaseId) : null,
  date:                doc.date,
  reason:              doc.reason,
  reference:           doc.reference || '',
  ...(detail ? { lineItems: doc.lineItems } : {}),
  subTotal:            doc.subTotal,
  taxAmount:           doc.taxAmount,
  totalAmount:         doc.totalAmount,
  status:              doc.status,
  journalEntryId:      doc.journalEntryId ? id(doc.journalEntryId) : null,
  reversalJournalEntryId: doc.reversalJournalEntryId ? id(doc.reversalJournalEntryId) : null,
  createdAt:           doc.createdAt,
  updatedAt:           doc.updatedAt
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new debit note:
 *   1. Validate totals consistency.
 *   2. Validate company, branch, FY, supplier, purchase, taxes.
 *   3. Save DebitNote.
 *   4. Post journal entry (Module 12).
 *   5. Optionally reduce linked purchase balanceDue.
 */
const createDebitNote = async (data, userId) => {
  validateTotals(data);
  const { supplier } = await validateReferences(data);

  const debitNote = await DebitNote.create({
    ...data,
    date:   new Date(data.date),
    status: 'POSTED',
    createdBy: userId,
    updatedBy: userId
  });

  try {
    const journalEntry = await postDebitNoteJournalEntry(
      { ...debitNote.toObject() },
      supplier,
      userId
    );
    debitNote.journalEntryId = journalEntry._id;
    debitNote.updatedBy = userId;
    await debitNote.save();

    await applyToPurchase(debitNote, userId);

    const populated = await DebitNote.findById(debitNote._id).populate('supplierId', 'name').lean();
    return shape(populated, true);
  } catch (error) {
    await DebitNote.deleteOne({ _id: debitNote._id });
    throw error;
  }
};

/**
 * List debit notes with company + optional branch filter.
 * branchId is optional — when omitted, all branches for the company are returned.
 */
const listDebitNotes = async (q) => {
  const filter = { companyId: q.companyId };

  if (q.branchId)        filter.branchId        = q.branchId;
  if (q.financialYearId) filter.financialYearId  = q.financialYearId;
  if (q.supplierId)      filter.supplierId        = q.supplierId;
  if (q.status)          filter.status            = q.status;

  if (q.from || q.to) {
    filter.date = {};
    if (q.from) filter.date.$gte = new Date(q.from);
    if (q.to)   filter.date.$lte = new Date(q.to);
  }

  const page  = Number(q.page  || 1);
  const limit = Number(q.limit || 20);

  const [items, total] = await Promise.all([
    DebitNote.find(filter)
      .populate('supplierId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DebitNote.countDocuments(filter)
  ]);

  return {
    items: items.map((doc) => shape(doc)),
    pagination: { page, limit, total }
  };
};

/**
 * Find a debit note document by ID (Mongoose doc, not lean).
 */
const getDebitNoteDocument = async (noteId) => {
  if (!mongoose.isValidObjectId(noteId))
    throw fail('Debit note not found', 404, 'DEBIT_NOTE_NOT_FOUND');
  const doc = await DebitNote.findById(noteId);
  if (!doc) throw fail('Debit note not found', 404, 'DEBIT_NOTE_NOT_FOUND');
  return doc;
};

module.exports = { createDebitNote, listDebitNotes, getDebitNoteDocument, shape };
