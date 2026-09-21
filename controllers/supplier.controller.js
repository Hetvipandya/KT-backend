const ChartOfAccount = require('../models/ChartOfAccount');
const Supplier = require('../models/Supplier');
const supplierService = require('../services/supplier.service');

const createError = (message, statusCode = 400, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
};

const serializeSupplier = (supplier) => {
  const item = typeof supplier.toObject === 'function' ? supplier.toObject() : supplier;
  const { _id, __v, ...data } = item;

  const branchName = data.branchId && typeof data.branchId === 'object' ? data.branchId.branchName : null;
  const payableAccountName = data.payableAccountId && typeof data.payableAccountId === 'object' ? data.payableAccountId.name : null;
  const payableAccountCode = data.payableAccountId && typeof data.payableAccountId === 'object' ? data.payableAccountId.code : null;

  return {
    id: _id,
    ...data,
    branchId: data.branchId ? (data.branchId._id ? data.branchId._id.toString() : data.branchId.toString()) : null,
    branchName,
    payableAccountId: data.payableAccountId ? (data.payableAccountId._id ? data.payableAccountId._id.toString() : data.payableAccountId.toString()) : null,
    payableAccountName,
    payableAccountCode
  };
};

const validatePayableAccount = async (payableAccountId, companyId) => {
  if (!payableAccountId) return;
  const account = await ChartOfAccount.findOne({ _id: payableAccountId, companyId });
  if (!account) {
    throw createError(
      'Payable account does not belong to the specified company',
      400,
      'INVALID_PAYABLE_ACCOUNT_COMPANY'
    );
  }
};

const createSupplier = async (req, res, next) => {
  try {
    const { companyId, payableAccountId, autoCreateLedger, ...fields } = req.body;
    await validatePayableAccount(payableAccountId, companyId);

    let resolvedPayableAccountId = payableAccountId || null;
    const shouldAutoCreate = autoCreateLedger === true || autoCreateLedger === 'true' || autoCreateLedger === undefined;
    if (!resolvedPayableAccountId && shouldAutoCreate) {
      resolvedPayableAccountId = await supplierService.createLinkedCoaAccount(companyId, fields.name);
    }

    const branchId = req.branchId || (req.body && req.body.branchId) || (req.user && req.user.branchId) || null;

    const supplier = await Supplier.create({
      companyId,
      branchId,
      ...fields,
      payableAccountId: resolvedPayableAccountId,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    return res.status(201).json({ success: true, data: serializeSupplier(supplier) });
  } catch (error) {
    next(error);
  }
};

const listSuppliers = async (req, res, next) => {
  try {
    const { companyId, search, isActive, page, limit } = req.query;
    if (!companyId) throw createError('Company ID query parameter is required', 400, 'COMPANY_ID_REQUIRED');
    if (isActive !== undefined && !['true', 'false'].includes(isActive)) {
      throw createError('isActive must be true or false', 400, 'INVALID_IS_ACTIVE');
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const filter = { companyId };
    if (req.branchId) filter.branchId = req.branchId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: searchRegex }, { code: searchRegex }, { email: searchRegex }, { phone: searchRegex }
      ];
    }

    const [items, total] = await Promise.all([
      Supplier.find(filter).populate('branchId', 'branchName').populate('payableAccountId', 'name code').sort({ name: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      Supplier.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        companyId,
        items: items.map(serializeSupplier),
        pagination: { page: pageNum, limit: limitNum, total }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getSupplier = async (req, res, next) => {
  try {
    const populated = await Supplier.findById(req.supplier._id).populate('branchId', 'branchName').populate('payableAccountId', 'name code').lean();
    return res.status(200).json({ success: true, data: serializeSupplier(populated || req.supplier) });
  } catch (error) {
    next(error);
  }
};

const updateSupplier = async (req, res, next) => {
  try {
    const supplier = req.supplier;
    if (req.body.payableAccountId !== undefined) {
      await validatePayableAccount(req.body.payableAccountId, supplier.companyId);
    }

    Object.assign(supplier, req.body, { updatedBy: req.user._id });
    const saved = await supplier.save();
    return res.status(200).json({ success: true, data: serializeSupplier(saved) });
  } catch (error) {
    next(error);
  }
};

const getSupplierLedger = async (req, res, next) => {
  try {
    const data = await supplierService.getSupplierLedgerWithBalance(req.supplier, {
      companyId: req.query.companyId || req.supplier.companyId.toString(),
      financialYearId: req.query.financialYearId,
      from: req.query.from,
      to: req.query.to
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = req.supplier;
    const user = req.user;
    const company = req.company; // loaded by checkCompanyAccess middleware

    // Check permissions: Owner, Admin, or Accountant
    const isOwner = company.createdBy.toString() === user._id.toString();
    const accessEntry = (user.companyAccess || []).find(
      (access) => access.isActive && access.companyId.toString() === company.id
    );
    const hasAllowedRole = accessEntry && ['admin', 'accountant'].includes(accessEntry.role.toLowerCase());

    if (!isOwner && !hasAllowedRole) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only owners, admins, or accountants are allowed to perform this action',
        errorCode: 'FORBIDDEN'
      });
    }

    supplier.isActive = false;
    supplier.updatedBy = user._id;
    await supplier.save();

    return res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully',
      data: {
        id: supplier._id,
        isActive: supplier.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createSupplier, listSuppliers, getSupplier, updateSupplier, getSupplierLedger, deleteSupplier };
