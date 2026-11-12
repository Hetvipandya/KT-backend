const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Tax = require('../models/Tax');
const FinancialYear = require('../models/FinancialYear');
const ChartOfAccount = require('../models/ChartOfAccount');
const Product = require('../models/Product');
const journalService = require('./journalEntry.service');
const { ensureIncomeLedger } = require('./autoCoaMapping.service');
const { recordAuditEvent } = require('./auditLog.service');
const { createNotification } = require('./notification.service');
const pdfService = require('./invoicePdf.service');
const cloudinaryService = require('./cloudinary.service');
const EPSILON = 0.01;

const fail = (message, statusCode = 400, errorCode) => Object.assign(new Error(message), { statusCode, errorCode });
const id = (v) => v?.toString();

const roundMoney = (value) => {
  const amount = Number(value) || 0;
  const factor = 100;
  return Math.round((amount + Math.sign(amount) * Number.EPSILON) * factor) / factor;
};

const normalizeInvoiceTotals = (data) => {
  const lines = (data.lineItems || []).map((line) => {
    const quantity = Number(line.quantity || 0);
    const rate = Number(line.rate || 0);
    const lineDiscount = Number(line.discount || 0);
    const taxableAmount = roundMoney(quantity * rate - lineDiscount);
    const taxAmount = roundMoney(Number(line.taxAmount || 0));

    return {
      ...line,
      taxableAmount,
      taxAmount,
      totalAmount: roundMoney(taxableAmount + taxAmount),
    };
  });

  const subTotal = roundMoney(lines.reduce((sum, line) => sum + line.taxableAmount, 0));
  const taxTotal = roundMoney(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const discountTotal = roundMoney(data.discountTotal || 0);
  const roundOff = roundMoney(data.roundOff || 0);
  const grandTotal = roundMoney(subTotal - discountTotal + taxTotal + roundOff);

  return { ...data, lineItems: lines, subTotal, discountTotal, taxTotal, roundOff, grandTotal };
};

const validateTotals = (data) => {
  if (!data.lineItems || data.lineItems.length === 0) {
    throw fail('At least one line item is required', 400, 'INVALID_TOTALS');
  }
  if (data.grandTotal <= 0) throw fail('grandTotal must be greater than zero', 400, 'INVALID_TOTALS');
};

const validateReferences = async (data) => {
  const fy = await FinancialYear.findById(data.financialYearId);
  if (!fy || id(fy.companyId) !== id(data.companyId)) throw fail('Financial year does not belong to the specified company', 400, 'INVALID_FINANCIAL_YEAR_COMPANY');
  if (fy.isLocked) throw fail('Cannot create invoice in a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED');
  const invoiceDate = new Date(data.invoiceDate);
  if (invoiceDate < fy.startDate || invoiceDate > fy.endDate) throw fail('invoiceDate must fall within the selected financial year', 400, 'INVOICE_DATE_OUTSIDE_FINANCIAL_YEAR');
  const customer = await Customer.findOne({ _id: data.customerId, companyId: data.companyId, isActive: true });
  if (!customer) throw fail('Customer not found for this company', 404, 'CUSTOMER_NOT_FOUND');

  const taxIds = [...new Set(data.lineItems.filter((line) => line.taxRateId).map((line) => line.taxRateId))];
  if (taxIds.length > 0) {
    const count = await Tax.countDocuments({ _id: { $in: taxIds }, companyId: data.companyId, isActive: true });
    if (count !== taxIds.length) throw fail('One or more tax rates are invalid for this company', 400, 'INVALID_TAX_RATE');
  }

  const productIds = [...new Set(data.lineItems.filter((line) => line.productId).map((line) => id(line.productId)))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, companyId: data.companyId, isActive: true })
    : [];
  if (products.length !== productIds.length) {
    throw fail('One or more products or services are unavailable for this company', 400, 'INVALID_PRODUCT');
  }
  return { fy, customer, products };
};

const shape = (invoice, detail = false) => {
  const cust = invoice.customerId && typeof invoice.customerId === 'object' ? invoice.customerId : null;
  const cName = cust?.name || invoice.customerName || null;
  const bName = invoice.branchId && typeof invoice.branchId === 'object' ? invoice.branchId.branchName : null;
  const fyLabel = invoice.financialYearId && typeof invoice.financialYearId === 'object' ? invoice.financialYearId.yearLabel : null;

  return {
    id: id(invoice._id),
    companyId: id(invoice.companyId),
    branchId: invoice.branchId ? id(invoice.branchId?._id || invoice.branchId) : null,
    branchName: bName,
    branch: bName ? { id: id(invoice.branchId?._id || invoice.branchId), branchName: bName, code: invoice.branchId?.code } : null,
    financialYearId: id(invoice.financialYearId?._id || invoice.financialYearId),
    financialYearLabel: fyLabel,
    financialYear: fyLabel ? { id: id(invoice.financialYearId?._id || invoice.financialYearId), yearLabel: fyLabel } : null,
    customerId: id(invoice.customerId?._id || invoice.customerId),
    customerName: cName,
    customerGstin: cust?.gstin || null,
    customer: cust ? {
      id: id(cust._id),
      name: cust.name,
      email: cust.email || null,
      phone: cust.phone || null,
      gstin: cust.gstin || null,
      pan: cust.pan || null,
      billingAddress: cust.billingAddress || null,
      shippingAddress: cust.shippingAddress || null,
      contactPerson: cust.contactPerson || null
    } : (cName ? { id: id(invoice.customerId?._id || invoice.customerId), name: cName } : null),
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate || null,
    status: invoice.status === 'PAID' ? 'SUCCESS' : (invoice.status === 'POSTED' ? 'APPROVED' : (invoice.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING')),
    rawStatus: invoice.status,
    statusLabel: invoice.status === 'PAID' ? 'SUCCESS' : (invoice.status === 'POSTED' ? 'APPROVED' : (invoice.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING')),
    paymentStatus: invoice.status === 'PAID' ? 'SUCCESS' : (invoice.status === 'POSTED' ? 'APPROVED' : (invoice.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING')),
    displayStatus: invoice.status === 'PAID' ? 'SUCCESS' : (invoice.status === 'POSTED' ? 'APPROVED' : (invoice.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING')),
    subTotal: invoice.subTotal || 0,
    discountTotal: invoice.discountTotal || 0,
    taxTotal: invoice.taxTotal || 0,
    gstTotal: invoice.taxTotal || 0,
    roundOff: invoice.roundOff || 0,
    grandTotal: invoice.grandTotal,
    amountReceived: invoice.amountReceived || 0,
    balanceDue: invoice.balanceDue,
    pdfUrl: invoice.pdfUrl || null,
    reference: invoice.reference || '',
    notes: invoice.notes || '',
    ...(detail ? {
      lineItems: (invoice.lineItems || []).map((line) => {
        const prod = line.productId && typeof line.productId === 'object' ? line.productId : null;
        const taxRateObj = line.taxRateId && typeof line.taxRateId === 'object' ? line.taxRateId : null;
        return {
          ...line,
          productId: prod ? id(prod._id) : id(line.productId),
          productName: prod?.name || line.description || null,
          productCode: prod?.code || null,
          hsnCode: prod?.hsn || prod?.sac || null,
          unit: prod?.unit || null,
          product: prod ? { id: id(prod._id), name: prod.name, code: prod.code, hsn: prod.hsn } : null,
          taxRateId: taxRateObj ? id(taxRateObj._id) : id(line.taxRateId),
          taxRateName: taxRateObj?.name || null,
          taxRatePercent: taxRateObj?.rate || 0,
          taxRate: taxRateObj ? { id: id(taxRateObj._id), name: taxRateObj.name, rate: taxRateObj.rate } : null
        };
      }),
      meta: invoice.meta || {},
      journalEntryId: invoice.journalEntryId ? id(invoice.journalEntryId) : null,
      reversalJournalEntryId: invoice.reversalJournalEntryId ? id(invoice.reversalJournalEntryId) : null
    } : {}),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt
  };
};

const nextNumber = async (companyId, financialYearId, label) => {
  const last = await Invoice.findOne({ companyId, financialYearId }).sort({ invoiceSequence: -1 }).select('invoiceSequence');
  const sequence = (last?.invoiceSequence || 0) + 1;
  const invoiceNumber = `INV-${label.replace(/\s+/g, '')}-${String(sequence).padStart(4, '0')}`;
  return { sequence, invoiceNumber };
};

const createJournalEntryForInvoice = async (invoice, userId) => {
  const customerAccountId = invoice.customer?.coaAccountId;
  const customerAccount = customerAccountId
    ? await ChartOfAccount.findOne({
      _id: customerAccountId,
      companyId: invoice.companyId,
      type: 'Asset',
      isActive: true,
      isGroup: false,
    })
    : null;
  if (!customerAccount) {
    throw fail('Customer receivable COA account is unavailable', 500, 'INVOICE_JOURNAL_ENTRY_FAILED');
  }

  const productsById = new Map((invoice.products || []).map((product) => [id(product._id), product]));
  let defaultSalesAccount = null;
  const getDefaultSalesAccount = async () => {
    if (!defaultSalesAccount) {
      defaultSalesAccount = await ChartOfAccount.findOne({
        companyId: invoice.companyId,
        branchId: null,
        code: '4110',
        type: 'Income',
        isActive: true,
        isGroup: false,
      }) || await ensureIncomeLedger(invoice.companyId, 'Sales Revenue', 'income:default:sales');
    }
    return defaultSalesAccount;
  };

  const revenueTotal = roundMoney(invoice.subTotal - invoice.discountTotal + (invoice.roundOff || 0));
  if (revenueTotal < 0) {
    throw fail('Invoice discounts cannot exceed the revenue total', 400, 'INVALID_TOTALS');
  }
  const revenueByAccount = new Map();
  let allocatedRevenue = 0;
  for (let index = 0; index < invoice.lineItems.length; index += 1) {
    const item = invoice.lineItems[index];
    let incomeAccount = null;
    if (item.productId) {
      const product = productsById.get(id(item.productId));
      if (!product) {
        throw fail('Product or service is unavailable for this invoice', 400, 'INVALID_PRODUCT');
      }
      incomeAccount = product.incomeAccountId
        ? await ChartOfAccount.findOne({
          _id: product.incomeAccountId,
          companyId: invoice.companyId,
          type: 'Income',
          isActive: true,
          isGroup: false,
        })
        : null;
      if (!incomeAccount) {
        incomeAccount = await ensureIncomeLedger(
          invoice.companyId,
          product.name,
          `income:product:${id(product._id)}`
        );
        product.incomeAccountId = incomeAccount._id;
        await product.save();
      }
    } else {
      incomeAccount = await getDefaultSalesAccount();
    }

    const isLastLine = index === invoice.lineItems.length - 1;
    const lineRevenue = isLastLine
      ? roundMoney(revenueTotal - allocatedRevenue)
      : (invoice.subTotal > 0
        ? roundMoney(revenueTotal * (item.taxableAmount / invoice.subTotal))
        : 0);
    allocatedRevenue = roundMoney(allocatedRevenue + lineRevenue);
    if (lineRevenue > 0) {
      const accountKey = id(incomeAccount._id);
      revenueByAccount.set(accountKey, {
        accountId: incomeAccount._id,
        credit: roundMoney((revenueByAccount.get(accountKey)?.credit || 0) + lineRevenue),
      });
    }
  }

  if (revenueTotal > 0 && !revenueByAccount.size) {
    const salesAccount = await getDefaultSalesAccount();
    revenueByAccount.set(id(salesAccount._id), {
      accountId: salesAccount._id,
      credit: revenueTotal,
    });
  }

  const gstAccount = invoice.taxTotal > 0
    ? await ChartOfAccount.findOne({
      companyId: invoice.companyId,
      branchId: null,
      code: '2200',
      type: 'Liability',
      isActive: true,
      isGroup: false,
    })
    : null;
  if (invoice.taxTotal > 0 && !gstAccount) {
    throw fail('Output GST COA account is unavailable', 500, 'INVOICE_JOURNAL_ENTRY_FAILED');
  }

  const lines = [
    { accountId: customerAccount._id, debit: invoice.grandTotal, credit: 0, remarks: 'Sales invoice receivable' },
    ...[...revenueByAccount.values()].map((item) => ({
      accountId: item.accountId,
      debit: 0,
      credit: item.credit,
      remarks: 'Sales revenue',
    })),
    ...(gstAccount ? [{ accountId: gstAccount._id, debit: 0, credit: invoice.taxTotal, remarks: 'Output GST' }] : []),
  ];

  const journalEntry = await journalService.createJournalEntry({
    companyId: invoice.companyId,
    financialYearId: invoice.financialYearId,
    entryDate: invoice.invoiceDate,
    reference: invoice.invoiceNumber,
    narration: `Sales invoice ${invoice.invoiceNumber}`,
    lines
  }, userId);

  return journalEntry;
};

const createInvoice = async (data, userId) => {
  data = normalizeInvoiceTotals(data);
  validateTotals(data);
  const { fy, customer, products } = await validateReferences(data);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { sequence, invoiceNumber } = await nextNumber(data.companyId, data.financialYearId, fy.yearLabel);
    try {
      const invoiceDoc = await Invoice.create({
        ...data,
        companyId: data.companyId,
        financialYearId: data.financialYearId,
        customerId: data.customerId,
        customerName: customer.name,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        invoiceSequence: sequence,
        invoiceNumber,
        amountReceived: 0,
        balanceDue: data.grandTotal,
        status: 'POSTED',
        createdBy: userId,
        updatedBy: userId
      });

      try {
        const journalEntry = await createJournalEntryForInvoice({ ...invoiceDoc.toObject(), customer, products }, userId);
        invoiceDoc.journalEntryId = journalEntry._id;
        invoiceDoc.updatedBy = userId;
        await invoiceDoc.save();

        createNotification({
          userId,
          companyId: data.companyId,
          type: 'INVOICE_CREATED',
          title: 'Invoice Created',
          message: `Sales Invoice ${invoiceNumber} for Rs.${data.grandTotal} has been created for ${customer.name}.`,
          channel: 'PUSH',
          meta: { invoiceId: id(invoiceDoc._id), invoiceNumber }
        }).catch(() => {});

        // Generate PDF and upload to Cloudinary
        try {
          const pdfBuffer = await pdfService.generateInvoicePdf(invoiceDoc);
          const uploadResult = await cloudinaryService.uploadInvoicePdf(invoiceDoc._id.toString(), pdfBuffer);
          
          invoiceDoc.pdfUrl = uploadResult.secure_url;
          invoiceDoc.cloudinaryPublicId = uploadResult.public_id;
          invoiceDoc.cloudinaryResourceType = uploadResult.resource_type;
          await invoiceDoc.save();
        } catch (uploadError) {
          console.error('Failed to generate/upload invoice PDF to Cloudinary:', uploadError);
        }

        recordAuditEvent({
          companyId: invoiceDoc.companyId,
          userId,
          module: 'INVOICE',
          actionType: 'CREATE',
          entityId: invoiceDoc._id,
          entityType: 'Invoice',
          description: `Created invoice ${invoiceDoc.invoiceNumber} with grand total ${invoiceDoc.grandTotal}`,
          metadata: { invoiceNumber: invoiceDoc.invoiceNumber, grandTotal: invoiceDoc.grandTotal }
        }).catch(err => console.error('Failed to log audit:', err));

        await invoiceDoc.populate('customerId', 'name');
        return shape(invoiceDoc.toObject(), true);
      } catch (journalError) {
        await Invoice.deleteOne({ _id: invoiceDoc._id });
        throw journalError;
      }
    } catch (error) {
      if (error?.code !== 11000 || attempt === 2) throw error;
    }
  }
};

const listInvoices = async (companyId, q = {}) => {
  const filter = { companyId };
  if (q.branchId) filter.branchId = q.branchId;
  if (q.customerId) filter.customerId = q.customerId;
  if (q.status) {
    filter.status = { $in: q.status.split(',') };
  } else if (q.unpaidOnly === 'true') {
    filter.status = { $in: ['POSTED', 'PARTIALLY_PAID'] };
    filter.balanceDue = { $gt: 0.01 };
  }
  if (q.from || q.to) {
    filter.invoiceDate = {};
    if (q.from) filter.invoiceDate.$gte = new Date(q.from);
    if (q.to) filter.invoiceDate.$lte = new Date(q.to);
  }
  if (q.search) {
    filter.$or = [{ invoiceNumber: new RegExp(q.search, 'i') }, { reference: new RegExp(q.search, 'i') }];
  }

  const page = Number(q.page || 1);
  const limit = Number(q.limit || 20);
  const [items, total] = await Promise.all([
    Invoice.find(filter).populate('customerId', 'name').populate('branchId', 'branchName').populate('financialYearId', 'yearLabel').sort({ invoiceDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Invoice.countDocuments(filter)
  ]);

  return {
    items: items.map((item) => shape(item)),
    pagination: { page, limit, total }
  };
};

const getInvoice = async (idValue) => {
  if (!mongoose.isValidObjectId(idValue)) throw fail('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  const invoice = await Invoice.findById(idValue).populate('customerId', 'name').lean();
  if (!invoice) throw fail('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  return invoice;
};

const getInvoiceDocument = async (idValue) => {
  if (!mongoose.isValidObjectId(idValue)) throw fail('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  const invoice = await Invoice.findById(idValue);
  if (!invoice) throw fail('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  return invoice;
};

const updateInvoice = async (invoice, data, userId) => {
  if (invoice.status === 'CANCELLED') throw fail('Cancelled invoice cannot be edited', 400, 'INVOICE_CANCELLED');
  if (invoice.status === 'PAID' || invoice.status === 'PARTIALLY_PAID' || (invoice.appliedPayments || []).length || (invoice.amountReceived || 0) > 0) throw fail('Invoice cannot be edited after payment.', 400, 'INVOICE_HAS_PAYMENT');

  const existing = typeof invoice.toObject === 'function' ? invoice.toObject() : { ...invoice };
  data = normalizeInvoiceTotals({ ...existing, ...data });
  validateTotals(data);
  const { customer, products } = await validateReferences({
    ...data,
    companyId: id(invoice.companyId),
    financialYearId: id(invoice.financialYearId),
    customerId: id(invoice.customerId)
  });

  const oldPublicId = invoice.cloudinaryPublicId;
  const oldResourceType = invoice.cloudinaryResourceType;
  let reversalJournalEntry = null;
  let replacementJournalEntry = null;

  try {
    if (invoice.journalEntryId) {
      const reversed = await journalService.reverseJournalEntry(invoice.journalEntryId, userId);
      reversalJournalEntry = reversed.reversal;
    }

    Object.assign(invoice, data, {
      customerName: customer.name,
      invoiceDate: new Date(data.invoiceDate),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      balanceDue: data.grandTotal,
      journalEntryId: null,
      reversalJournalEntryId: reversalJournalEntry?._id || invoice.reversalJournalEntryId,
      updatedBy: userId
    });
    await invoice.save();

    replacementJournalEntry = await createJournalEntryForInvoice({
      ...invoice.toObject(),
      customer,
      products
    }, userId);
    invoice.journalEntryId = replacementJournalEntry._id;
    await invoice.save();
  } catch (error) {
    const recoveryErrors = [];
    if (replacementJournalEntry) {
      try {
        await journalService.reverseJournalEntry(replacementJournalEntry._id, userId);
      } catch (recoveryError) {
        recoveryErrors.push(recoveryError);
      }
    }
    if (reversalJournalEntry) {
      try {
        const restored = await journalService.reverseJournalEntry(reversalJournalEntry._id, userId);
        Object.assign(invoice, existing, {
          journalEntryId: restored.reversal._id,
          reversalJournalEntryId: existing.reversalJournalEntryId || null,
          updatedBy: userId
        });
        await invoice.save();
      } catch (recoveryError) {
        recoveryErrors.push(recoveryError);
      }
    } else if (!recoveryErrors.length) {
      Object.assign(invoice, existing, { updatedBy: userId });
      await invoice.save();
    }
    if (recoveryErrors.length) {
      error.message = `${error.message}. Invoice accounting recovery also failed: ${recoveryErrors.map((item) => item.message).join('; ')}`;
      error.statusCode = 500;
    }
    throw error;
  }

  // Generate new PDF and upload to Cloudinary, then delete old PDF
  try {
    const pdfBuffer = await pdfService.generateInvoicePdf(invoice);
    const uploadResult = await cloudinaryService.uploadInvoicePdf(invoice._id.toString(), pdfBuffer);
    
    invoice.pdfUrl = uploadResult.secure_url;
    invoice.cloudinaryPublicId = uploadResult.public_id;
    invoice.cloudinaryResourceType = uploadResult.resource_type;
    await invoice.save();

    if (oldPublicId) {
      await cloudinaryService.deleteInvoicePdf(oldPublicId, oldResourceType).catch(err => 
        console.error('Failed to delete old invoice PDF from Cloudinary:', err)
      );
    }
  } catch (uploadError) {
    console.error('Failed to regenerate/upload invoice PDF to Cloudinary during update:', uploadError);
  }

  recordAuditEvent({
    companyId: invoice.companyId,
    userId,
    module: 'INVOICE',
    actionType: 'UPDATE',
    entityId: invoice._id,
    entityType: 'Invoice',
    description: `Updated invoice ${invoice.invoiceNumber}`,
    metadata: { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal }
  }).catch(err => console.error('Failed to log audit:', err));

  return { id: id(invoice._id), status: invoice.status, grandTotal: invoice.grandTotal, balanceDue: invoice.balanceDue, pdfUrl: invoice.pdfUrl || null, updatedAt: invoice.updatedAt };
};

const cancelInvoice = async (invoice, userId) => {
  if (invoice.status === 'CANCELLED') throw fail('Invoice is already cancelled', 409, 'INVOICE_ALREADY_CANCELLED');
  if (invoice.status === 'PAID' || invoice.status === 'PARTIALLY_PAID' || (invoice.appliedPayments || []).length || (invoice.amountReceived || 0) > 0) throw fail('Invoice cannot be cancelled after payment.', 400, 'INVOICE_HAS_PAYMENT');

  let reversalJournalEntry = null;
  if (invoice.journalEntryId) {
    const reversal = await journalService.reverseJournalEntry(invoice.journalEntryId, userId);
    reversalJournalEntry = reversal.reversal;
  }

  invoice.status = 'CANCELLED';
  invoice.cancelledAt = new Date();
  invoice.cancelledBy = userId;
  invoice.reversalJournalEntryId = reversalJournalEntry ? reversalJournalEntry._id : null;
  invoice.updatedBy = userId;
  await invoice.save();

  // Regenerate PDF and upload to Cloudinary to reflect CANCELLED status
  try {
    const pdfBuffer = await pdfService.generateInvoicePdf(invoice);
    const uploadResult = await cloudinaryService.uploadInvoicePdf(invoice._id.toString(), pdfBuffer);
    
    invoice.pdfUrl = uploadResult.secure_url;
    invoice.cloudinaryPublicId = uploadResult.public_id;
    invoice.cloudinaryResourceType = uploadResult.resource_type;
    await invoice.save();
  } catch (uploadError) {
    console.error('Failed to regenerate/upload cancelled invoice PDF to Cloudinary:', uploadError);
  }

  recordAuditEvent({
    companyId: invoice.companyId,
    userId,
    module: 'INVOICE',
    actionType: 'DELETE',
    entityId: invoice._id,
    entityType: 'Invoice',
    description: `Cancelled invoice ${invoice.invoiceNumber}`,
    metadata: { invoiceNumber: invoice.invoiceNumber }
  }).catch(err => console.error('Failed to log audit:', err));

  return { id: id(invoice._id), status: invoice.status, cancelledAt: invoice.cancelledAt, reversalJournalEntryId: invoice.reversalJournalEntryId ? id(invoice.reversalJournalEntryId) : null, pdfUrl: invoice.pdfUrl || null };
};

module.exports = { createInvoice, listInvoices, getInvoice, getInvoiceDocument, updateInvoice, cancelInvoice, shape };
