const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const FinancialYear = require('../models/FinancialYear');
const Tax = require('../models/Tax');
const PURCHASE_ORDER_APPROVAL_THRESHOLD = Number(process.env.PURCHASE_ORDER_APPROVAL_THRESHOLD || 50000);
const EPSILON = 0.01;
const id = (value) => value?.toString();
const fail = (message, statusCode = 400, errorCode) => Object.assign(new Error(message), { statusCode, errorCode });

const validateTotals = (data) => { const subTotal = data.lineItems.reduce((total, item) => total + item.amount, 0); if (Math.abs(data.subTotal - subTotal) > EPSILON || Math.abs(data.totalAmount - (data.subTotal + data.taxAmount)) > EPSILON) throw fail('Purchase order totals are inconsistent', 400, 'INVALID_TOTALS'); };
const validateRefs = async (data) => {
  const fy = await FinancialYear.findById(data.financialYearId); if (!fy || id(fy.companyId) !== id(data.companyId)) throw fail('Financial year does not belong to the specified company', 400, 'INVALID_FINANCIAL_YEAR_COMPANY'); if (fy.isLocked) throw fail('Cannot create a purchase order in a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED');
  const poDate = new Date(data.poDate); if (poDate < fy.startDate || poDate > fy.endDate) throw fail('poDate must fall within the selected financial year', 400, 'PO_DATE_OUTSIDE_FINANCIAL_YEAR');
  const supplier = await Supplier.findOne({ _id: data.supplierId, companyId: data.companyId, isActive: true }); if (!supplier) throw fail('Supplier not found for this company', 404, 'SUPPLIER_NOT_FOUND');
  const taxIds = [...new Set(data.lineItems.filter((line) => line.taxRateId).map((line) => line.taxRateId))]; if (taxIds.length && await Tax.countDocuments({ _id: { $in: taxIds }, companyId: data.companyId, isActive: true }) !== taxIds.length) throw fail('One or more tax rates are invalid for this company', 400, 'INVALID_TAX_RATE');
  // TODO: validate productIds once Module 7 Product/Service model is available.
  return fy;
};
const shape = (po, detail = false) => {
  const supp = po.supplierId && typeof po.supplierId === 'object' ? po.supplierId : null;
  const sName = supp?.name || null;
  const sGstin = supp?.gstin || null;
  const bName = po.branchId && typeof po.branchId === 'object' ? po.branchId.branchName : null;
  const fyLabel = po.financialYearId && typeof po.financialYearId === 'object' ? po.financialYearId.yearLabel : null;

  return {
    id: id(po._id),
    companyId: id(po.companyId),
    branchId: po.branchId ? id(po.branchId?._id || po.branchId) : null,
    branchName: bName,
    branch: bName ? { id: id(po.branchId?._id || po.branchId), branchName: bName, code: po.branchId?.code } : null,
    financialYearId: id(po.financialYearId?._id || po.financialYearId),
    financialYearLabel: fyLabel,
    financialYear: fyLabel ? { id: id(po.financialYearId?._id || po.financialYearId), yearLabel: fyLabel } : null,
    supplierId: id(po.supplierId?._id || po.supplierId),
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
    } : (sName ? { id: id(po.supplierId?._id || po.supplierId), name: sName } : null),
    poNumber: po.poNumber,
    poDate: po.poDate,
    expectedDeliveryDate: po.expectedDeliveryDate || null,
    status: po.status,
    approvalRequired: po.approvalRequired !== undefined ? po.approvalRequired : false,
    autoApproved: po.autoApproved !== undefined ? po.autoApproved : true,
    approvedBy: po.approvedBy ? id(po.approvedBy) : null,
    approvedAt: po.approvedAt || null,
    rejectedBy: po.rejectedBy ? id(po.rejectedBy) : null,
    rejectedAt: po.rejectedAt || null,
    rejectionReason: po.rejectionReason || null,
    subTotal: po.subTotal || 0,
    taxAmount: po.taxAmount || 0,
    gstTotal: po.taxAmount || 0,
    totalAmount: po.totalAmount,
    reference: po.reference || '',
    ...(detail ? {
      lineItems: (po.lineItems || []).map((line) => {
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
      })
    } : {}),
    createdAt: po.createdAt,
    updatedAt: po.updatedAt
  };
};
const nextNumber = async (companyId, financialYearId, label) => { const last = await PurchaseOrder.findOne({ companyId }).sort({ poSequence: -1 }).select('poSequence'); const sequence = (last?.poSequence || 0) + 1; return { sequence, poNumber: `PO-${label.replace(/\s+/g, '')}-${String(sequence).padStart(4, '0')}` }; };
const createPurchaseOrder = async (data, userId) => {
  validateTotals(data);
  const fy = await validateRefs(data);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const numbering = await nextNumber(data.companyId, data.financialYearId, fy.yearLabel);
    try {
      const requiresApproval = Number(data.totalAmount) > PURCHASE_ORDER_APPROVAL_THRESHOLD;
      const approvalData = requiresApproval ? {
        status: 'PENDING_APPROVAL',
        approvalRequired: true,
        autoApproved: false,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null
      } : {
        status: 'APPROVED',
        approvalRequired: false,
        autoApproved: true,
        approvedBy: userId,
        approvedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null
      };

      const po = await PurchaseOrder.create({
        ...data,
        poDate: new Date(data.poDate),
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        poNumber: numbering.poNumber,
        poSequence: numbering.sequence,
        createdBy: userId,
        updatedBy: userId,
        ...approvalData
      });

      try {
        const { createNotification } = require('./notification.service');
        createNotification({
          userId,
          companyId: data.companyId,
          type: 'PURCHASE_ORDER_CREATED',
          title: 'Purchase Order Created',
          message: `Purchase Order ${numbering.poNumber} for ₹${data.totalAmount} has been created${requiresApproval ? ' and requires approval' : ''}.`,
          channel: 'PUSH',
          meta: { poId: id(po._id), poNumber: numbering.poNumber }
        }).catch(() => {});
      } catch (notifErr) {}

      const populated = await PurchaseOrder.findById(po._id).populate('supplierId', 'name').populate('branchId', 'branchName').populate('financialYearId', 'yearLabel').lean();
      return shape(populated, true);
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    }
  }
};
const listPurchaseOrders = async (companyId, query) => {
  const filter = { companyId };
  if (query.branchId) filter.branchId = query.branchId;
  for (const key of ['supplierId', 'financialYearId', 'status']) {
    if (query[key]) filter[key] = query[key];
  }
  if (query.approvalRequired !== undefined) {
    filter.approvalRequired = query.approvalRequired === 'true' || query.approvalRequired === true;
  }
  if (query.from || query.to) {
    filter.poDate = {};
    if (query.from) filter.poDate.$gte = new Date(query.from);
    if (query.to) filter.poDate.$lte = new Date(query.to);
  }
  const [items, total] = await Promise.all([
    PurchaseOrder.find(filter).populate('supplierId', 'name').populate('branchId', 'branchName').populate('financialYearId', 'yearLabel').sort({ poDate: -1, createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    PurchaseOrder.countDocuments(filter)
  ]);
  return { items: items.map((item) => shape(item)), pagination: { page: query.page, limit: query.limit, total } };
};
const getPurchaseOrderDocument = async (poId) => {
  if (!mongoose.isValidObjectId(poId)) throw fail('Purchase order not found', 404, 'PURCHASE_ORDER_NOT_FOUND');
  const po = await PurchaseOrder.findById(poId)
    .populate('supplierId', 'name email phone gstin pan billingAddress shippingAddress contactPerson')
    .populate('branchId', 'branchName code address')
    .populate('financialYearId', 'yearLabel startDate endDate')
    .populate('lineItems.productId', 'name code hsn sac unit')
    .populate('lineItems.taxRateId', 'name rate type')
    .lean();
  if (!po) throw fail('Purchase order not found', 404, 'PURCHASE_ORDER_NOT_FOUND');
  return shape(po, true);
};
const getPurchaseOrderDetails = async (poId) => getPurchaseOrderDocument(poId);
const approvePurchaseOrder = async (po, userId, reason = null) => {
  if (po.status === 'APPROVED') {
    throw fail('Purchase order is already approved.', 400, 'ALREADY_APPROVED');
  }
  if (po.status === 'REJECTED') {
    throw fail('Rejected purchase order cannot be approved. Create a new purchase order if required.', 400, 'REJECTED_CANNOT_BE_APPROVED');
  }
  if (po.status !== 'PENDING_APPROVAL') {
    throw fail('Only pending purchase orders can be approved', 400, 'PURCHASE_ORDER_NOT_APPROVABLE');
  }

  po.status = 'APPROVED';
  po.approvalRequired = true;
  po.autoApproved = false;
  po.approvedBy = userId;
  po.approvedAt = new Date();
  po.rejectedBy = null;
  po.rejectedAt = null;
  po.rejectionReason = null;
  po.updatedBy = userId;
  await po.save();

  // Record audit event and send notification
  try {
    const { recordAuditEvent } = require('./auditLog.service');
    if (recordAuditEvent) {
      await recordAuditEvent({
        companyId: po.companyId,
        userId,
        module: 'PURCHASE_ORDER',
        actionType: 'APPROVE',
        entityId: po._id,
        entityType: 'PurchaseOrder',
        description: `Purchase order ${po.poNumber} approved`,
        metadata: { reason: reason || null }
      });
    }
  } catch (err) {}

  try {
    const { createNotification } = require('./notification.service');
    createNotification({
      userId: po.createdBy,
      companyId: po.companyId,
      type: 'PURCHASE_ORDER_APPROVED',
      title: 'Purchase Order Approved',
      message: `Purchase Order ${po.poNumber} for ₹${po.totalAmount} has been approved.`,
      channel: 'PUSH',
      meta: { poId: id(po._id), poNumber: po.poNumber }
    }).catch(() => {});
  } catch (notifErr) {}

  return {
    id: id(po._id),
    status: po.status,
    approvalRequired: po.approvalRequired,
    autoApproved: po.autoApproved,
    approvedBy: id(po.approvedBy),
    approvedAt: po.approvedAt,
    message: 'Purchase order approved successfully.'
  };
};

const rejectPurchaseOrder = async (po, userId, reason) => {
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    throw fail('Rejection reason is required', 400, 'REJECTION_REASON_REQUIRED');
  }
  if (po.status !== 'PENDING_APPROVAL') {
    throw fail('Only pending purchase orders can be rejected', 400, 'PURCHASE_ORDER_NOT_REJECTABLE');
  }

  po.status = 'REJECTED';
  po.approvalRequired = true;
  po.autoApproved = false;
  po.rejectedBy = userId;
  po.rejectedAt = new Date();
  po.rejectionReason = reason;
  po.approvedBy = null;
  po.approvedAt = null;
  po.updatedBy = userId;
  await po.save();

  // Record audit event and send notification
  try {
    const { recordAuditEvent } = require('./auditLog.service');
    if (recordAuditEvent) {
      await recordAuditEvent({
        companyId: po.companyId,
        userId,
        module: 'PURCHASE_ORDER',
        actionType: 'REJECT',
        entityId: po._id,
        entityType: 'PurchaseOrder',
        description: `Purchase order ${po.poNumber} rejected`,
        metadata: { reason }
      });
    }
  } catch (err) {}

  try {
    const { createNotification } = require('./notification.service');
    createNotification({
      userId: po.createdBy,
      companyId: po.companyId,
      type: 'PURCHASE_ORDER_REJECTED',
      title: 'Purchase Order Rejected',
      message: `Purchase Order ${po.poNumber} for ₹${po.totalAmount} was rejected: ${reason}`,
      channel: 'PUSH',
      meta: { poId: id(po._id), poNumber: po.poNumber, reason }
    }).catch(() => {});
  } catch (notifErr) {}

  return {
    id: id(po._id),
    status: po.status,
    rejectedBy: id(po.rejectedBy),
    rejectedAt: po.rejectedAt,
    rejectionReason: po.rejectionReason,
    message: 'Purchase order rejected successfully.'
  };
};

module.exports = { createPurchaseOrder, listPurchaseOrders, getPurchaseOrderDocument, approvePurchaseOrder, rejectPurchaseOrder, shape };
