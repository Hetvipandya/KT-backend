const mongoose = require('mongoose');
const Purchase = require('../models/Purchase'); const PurchaseOrder = require('../models/PurchaseOrder'); const PurchaseReturn = require('../models/PurchaseReturn'); const Supplier = require('../models/Supplier'); const FinancialYear = require('../models/FinancialYear'); const Tax = require('../models/Tax'); const ChartOfAccount = require('../models/ChartOfAccount'); const journal = require('./journalEntry.service');
const EPSILON = 0.01; const id = (value) => { if (!value) return null; if (typeof value === 'object' && value._id) return value._id.toString(); return value.toString(); }; const fail = (message, statusCode = 400, errorCode) => Object.assign(new Error(message), { statusCode, errorCode });
const validateTotals = (data) => { const sub = data.lineItems.reduce((sum, item) => sum + item.amount, 0); const tax = data.lineItems.reduce((sum, item) => sum + item.taxAmount, 0); if (Math.abs(data.subTotal - sub) > EPSILON || Math.abs(data.taxTotal - tax) > EPSILON || Math.abs(data.grandTotal - (data.subTotal - data.discountTotal + data.taxTotal + data.roundOff)) > EPSILON || data.balanceDue - data.grandTotal > EPSILON) throw fail('Purchase totals are inconsistent', 400, 'INVALID_TOTALS'); for (const line of data.lineItems) if (Math.abs(line.totalAmount - (line.amount + line.taxAmount)) > EPSILON) throw fail('Purchase line total is inconsistent', 400, 'INVALID_LINE_TOTAL'); };
const validateRefs = async (data) => { const fy = await FinancialYear.findById(data.financialYearId); if (!fy || id(fy.companyId) !== id(data.companyId)) throw fail('Financial year does not belong to the specified company', 400, 'INVALID_FINANCIAL_YEAR_COMPANY'); if (fy.isLocked) throw fail('Cannot create purchase in a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED'); const billDate = new Date(data.billDate); if (billDate < fy.startDate || billDate > fy.endDate) throw fail('billDate must fall within the selected financial year', 400, 'BILL_DATE_OUTSIDE_FINANCIAL_YEAR'); const supplier = await Supplier.findOne({ _id: data.supplierId, companyId: data.companyId, isActive: true }); if (!supplier) throw fail('Supplier not found for this company', 404, 'SUPPLIER_NOT_FOUND'); if (data.purchaseOrderId) { const po = await PurchaseOrder.findOne({ _id: data.purchaseOrderId, companyId: data.companyId, supplierId: data.supplierId }); if (!po) { throw fail('Purchase order not found for this company and supplier.', 404); } if (po.status !== 'APPROVED') { throw fail('This purchase order is pending approval or has been rejected. Purchase bill cannot be created.', 400); } } const taxes = [...new Set(data.lineItems.filter((line) => line.taxRateId).map((line) => line.taxRateId))]; if (taxes.length && await Tax.countDocuments({ _id: { $in: taxes }, companyId: data.companyId, isActive: true }) !== taxes.length) throw fail('One or more tax rates are invalid for this company', 400, 'INVALID_TAX_RATE'); return supplier; };
const shape = (p, detail = false) => {
  const supp = p.supplierId && typeof p.supplierId === 'object' ? p.supplierId : null;
  const sName = supp?.name || '';
  const sGstin = supp?.gstin || null;
  const bName = p.branchId && typeof p.branchId === 'object' ? p.branchId.branchName : null;
  const fyLabel = p.financialYearId && typeof p.financialYearId === 'object' ? p.financialYearId.yearLabel : null;

  return {
    id: id(p._id),
    companyId: id(p.companyId),
    branchId: p.branchId ? id(p.branchId?._id || p.branchId) : null,
    branchName: bName,
    branch: bName ? { id: id(p.branchId?._id || p.branchId), branchName: bName, code: p.branchId?.code } : null,
    financialYearId: id(p.financialYearId?._id || p.financialYearId),
    financialYearLabel: fyLabel,
    financialYear: fyLabel ? { id: id(p.financialYearId?._id || p.financialYearId), yearLabel: fyLabel } : null,
    supplierId: id(p.supplierId?._id || p.supplierId),
    supplierName: sName,
    supplierGstin: sGstin,
    supplier: supp ? {
      id: id(supp._id),
      name: supp.name,
      email: supp.email || null,
      phone: supp.phone || null,
      gstin: supp.gstin || null,
      pan: supp.pan || null,
      billingAddress: supp.billingAddress || null,
      shippingAddress: supp.shippingAddress || null,
      contactPerson: supp.contactPerson || null
    } : (sName ? { id: id(p.supplierId?._id || p.supplierId), name: sName } : null),
    purchaseOrderId: p.purchaseOrderId ? id(p.purchaseOrderId) : null,
    billNumber: p.billNumber,
    billDate: p.billDate,
    dueDate: p.dueDate || null,
    status: p.status,
    subTotal: p.subTotal || 0,
    discountTotal: p.discountTotal || 0,
    taxTotal: p.taxTotal || 0,
    gstTotal: p.taxTotal || 0,
    roundOff: p.roundOff || 0,
    grandTotal: p.grandTotal,
    balanceDue: p.balanceDue,
    notes: p.notes || '',
    ...(detail ? {
      lineItems: (p.lineItems || []).map((line) => {
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
      warehouseId: p.warehouseId ? id(p.warehouseId) : null,
      journalEntryId: p.journalEntryId ? id(p.journalEntryId) : null,
      reversalJournalEntryId: p.reversalJournalEntryId ? id(p.reversalJournalEntryId) : null
    } : {}),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
};
const postJournal = async (purchase, supplier, userId) => { const payable = supplier.payableAccountId ? await ChartOfAccount.findById(supplier.payableAccountId) : await ChartOfAccount.findOne({ companyId: purchase.companyId, code: '2310', isActive: true, isGroup: false }); const purchaseAccount = await ChartOfAccount.findOne({ companyId: purchase.companyId, code: '5110', isActive: true, isGroup: false }); const gst = purchase.taxTotal > 0 ? await ChartOfAccount.findOne({ companyId: purchase.companyId, code: '1410', isActive: true, isGroup: false }) : null; if (!payable || !purchaseAccount || (purchase.taxTotal > 0 && !gst)) throw fail('Required purchase, input GST, or supplier payable COA account is unavailable', 500, 'PURCHASE_JOURNAL_ENTRY_FAILED'); const lines = [{ accountId: purchaseAccount._id, debit: purchase.subTotal - purchase.discountTotal, credit: 0, remarks: 'Purchase / inventory' }, ...(purchase.taxTotal ? [{ accountId: gst._id, debit: purchase.taxTotal, credit: 0, remarks: 'Input GST' }] : []), { accountId: payable._id, debit: 0, credit: purchase.grandTotal, remarks: 'Supplier payable' }]; return journal.createJournalEntry({ companyId: purchase.companyId, branchId: purchase.branchId || null, financialYearId: purchase.financialYearId, entryDate: purchase.billDate, reference: purchase.billNumber, narration: `Purchase bill ${purchase.billNumber}`, lines }, userId); };
const createPurchase = async (data, userId) => { validateTotals(data); const supplier = await validateRefs(data); const purchase = await Purchase.create({ ...data, billDate: new Date(data.billDate), dueDate: data.dueDate ? new Date(data.dueDate) : null, status: 'POSTED', createdBy: userId, updatedBy: userId }); try { const entry = await postJournal(purchase, supplier, userId); purchase.journalEntryId = entry._id; await purchase.save(); const populated = await Purchase.findById(purchase._id).populate('supplierId', 'name gstin').populate('branchId', 'branchName').populate('financialYearId', 'yearLabel').lean(); return shape(populated, true); } catch (error) { await Purchase.deleteOne({ _id: purchase._id }); throw error; } };
const listPurchases = async (companyId, q) => { const filter = { companyId }; if (q.branchId) filter.branchId = q.branchId; for (const key of ['supplierId', 'financialYearId', 'status']) if (q[key]) filter[key] = q[key]; if (q.from || q.to) { filter.billDate = {}; if (q.from) filter.billDate.$gte = new Date(q.from); if (q.to) filter.billDate.$lte = new Date(q.to); } if (q.search) filter.$or = [{ billNumber: new RegExp(q.search, 'i') }, { notes: new RegExp(q.search, 'i') }]; const [items, total] = await Promise.all([Purchase.find(filter).populate('supplierId', 'name gstin').populate('branchId', 'branchName').populate('financialYearId', 'yearLabel').sort({ billDate: -1, createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), Purchase.countDocuments(filter)]); return { items: items.map((item) => shape(item)), pagination: { page: q.page, limit: q.limit, total } }; };
const getPurchaseDocument = async (value) => {
  if (!mongoose.isValidObjectId(value)) throw fail('Purchase not found', 404, 'PURCHASE_NOT_FOUND');
  const purchase = await Purchase.findById(value)
    .populate('supplierId', 'name email phone gstin pan billingAddress shippingAddress contactPerson')
    .populate('branchId', 'branchName code address')
    .populate('financialYearId', 'yearLabel startDate endDate')
    .populate('lineItems.productId', 'name code hsn sac unit')
    .populate('lineItems.taxRateId', 'name rate type')
    .lean();
  if (!purchase) throw fail('Purchase not found', 404, 'PURCHASE_NOT_FOUND');
  return purchase;
};
const updatePurchase = async (purchase, changes, userId) => { if (['PAID', 'CANCELLED', 'PARTIALLY_PAID'].includes(purchase.status)) throw fail('Purchase cannot be edited after payment or cancellation', 409, 'PURCHASE_NOT_EDITABLE'); const data = { ...purchase.toObject(), ...changes, companyId: id(purchase.companyId), financialYearId: id(purchase.financialYearId), supplierId: id(purchase.supplierId), purchaseOrderId: purchase.purchaseOrderId ? id(purchase.purchaseOrderId) : null, billNumber: purchase.billNumber }; validateTotals(data); const supplier = await validateRefs(data); if (purchase.journalEntryId) { const reversed = await journal.reverseJournalEntry(purchase.journalEntryId, userId); purchase.reversalJournalEntryId = reversed.reversal._id; } Object.assign(purchase, changes, { billDate: new Date(data.billDate), dueDate: data.dueDate ? new Date(data.dueDate) : null, balanceDue: data.grandTotal, updatedBy: userId }); const entry = await postJournal(purchase, supplier, userId); purchase.journalEntryId = entry._id; await purchase.save(); return { id: id(purchase._id), status: purchase.status, grandTotal: purchase.grandTotal, balanceDue: purchase.balanceDue, updatedAt: purchase.updatedAt }; };
const createReturn = async (purchase, data, userId) => { if (purchase.status === 'CANCELLED') throw fail('Cancelled purchase cannot be returned', 409, 'PURCHASE_CANCELLED'); const prior = await PurchaseReturn.find({ purchaseId: purchase._id }).lean(); const returned = new Map(); prior.flatMap((r) => r.lineItems).forEach((line) => returned.set(id(line.purchaseLineItemId), (returned.get(id(line.purchaseLineItemId)) || 0) + line.quantity)); const requested = (data.lineItems || purchase.lineItems.map((line) => ({ purchaseLineItemId: id(line._id), quantity: line.quantity - (returned.get(id(line._id)) || 0) }))).filter((item) => item.quantity > EPSILON); if (!requested.length) throw fail('There is no remaining quantity to return', 400, 'NOTHING_TO_RETURN'); const lines = requested.map((item) => { const original = purchase.lineItems.id(item.purchaseLineItemId); if (!original || item.quantity + (returned.get(item.purchaseLineItemId) || 0) - original.quantity > EPSILON) throw fail('Return quantity exceeds purchased quantity', 400, 'RETURN_QUANTITY_EXCEEDED'); const ratio = item.quantity / original.quantity; return { purchaseLineItemId: original._id, productId: original.productId, quantity: item.quantity, amount: original.amount * ratio, taxAmount: original.taxAmount * ratio, totalAmount: original.totalAmount * ratio }; }); const total = lines.reduce((sum, line) => sum + line.totalAmount, 0); if (total - purchase.balanceDue > EPSILON) throw fail('Return amount cannot exceed outstanding purchase balance', 400, 'RETURN_EXCEEDS_BALANCE'); const supplier = await Supplier.findById(purchase.supplierId); const purchaseAccount = await ChartOfAccount.findOne({ companyId: purchase.companyId, code: '5110', isActive: true, isGroup: false }); const payable = supplier.payableAccountId ? await ChartOfAccount.findById(supplier.payableAccountId) : null; const gst = lines.some((line) => line.taxAmount) ? await ChartOfAccount.findOne({ companyId: purchase.companyId, code: '1410', isActive: true, isGroup: false }) : null; if (!supplier || !payable || !purchaseAccount || (lines.some((line) => line.taxAmount) && !gst)) throw fail('Required COA account is unavailable for purchase return', 500, 'PURCHASE_RETURN_JOURNAL_FAILED'); const entry = await journal.createJournalEntry({ companyId: purchase.companyId, financialYearId: purchase.financialYearId, entryDate: new Date(data.returnDate), reference: `RET-${purchase.billNumber}`, narration: `Purchase return for ${purchase.billNumber}`, lines: [{ accountId: payable._id, debit: total, credit: 0, remarks: 'Reduce supplier payable' }, { accountId: purchaseAccount._id, debit: 0, credit: lines.reduce((sum, line) => sum + line.amount, 0), remarks: 'Reverse purchase' }, ...(gst ? [{ accountId: gst._id, debit: 0, credit: lines.reduce((sum, line) => sum + line.taxAmount, 0), remarks: 'Reverse input GST' }] : [])] }, userId); const record = await PurchaseReturn.create({ companyId: purchase.companyId, branchId: data.branchId || purchase.branchId || null, purchaseId: purchase._id, returnDate: new Date(data.returnDate), reason: data.reason, warehouseId: data.warehouseId || null, lineItems: lines, totalAmount: total, journalEntryId: entry._id, createdBy: userId }); purchase.balanceDue = Math.max(0, purchase.balanceDue - total); if (!purchase.balanceDue) purchase.status = 'PAID'; purchase.updatedBy = userId; await purchase.save(); // TODO: Module 18 stock-out and Module 24 Debit Note wiring.
  return { purchaseId: id(purchase._id), returnId: id(record._id), returnDate: record.returnDate, note: 'Stock-out and Debit Note integration remain pending Modules 18 and 24.' }; };
module.exports = { createPurchase, listPurchases, getPurchaseDocument, updatePurchase, createReturn, shape };
