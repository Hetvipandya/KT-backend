const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const ChartOfAccount = require('../models/ChartOfAccount');
const customerService = require('../services/customer.service');
const coaService = require('../services/coa.service');
const bankAccountService = require('../services/bankAccount.service');

/**
 * POST /api/customer
 * Create a new customer 
 */
const createCustomer = async (req, res, next) => {
  try {
    const {
      companyId,
      name, 
      gstin,
      email,
      phone,
      billingAddress,
      shippingAddress,
      creditLimit,
      creditPeriodDays,
      openingBalance,
      openingBalanceType
    } = req.body;

    const branchId = req.branchId || (req.body && req.body.branchId) || (req.user && req.user.branchId) || null;

    // Validate GSTIN format if provided
    if (gstin) {
      customerService.validateGstin(gstin);

      // Check for duplicate GSTIN within the same company/branch for active customers
      const duplicateFilter = {
        companyId,
        gstin: gstin.toUpperCase(),
        isActive: true
      };
      if (branchId) duplicateFilter.branchId = branchId;

      const duplicate = await Customer.findOne(duplicateFilter);
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Another active customer with the same GSTIN already exists'
        });
      }
    }

    // Auto-create/link corresponding COA ledger account under Sundry Debtors
    const coaAccountId = await customerService.createLinkedCoaAccount(companyId, name);

    const customer = await Customer.create({
      companyId,
      branchId,
      name,
      gstin: gstin ? gstin.toUpperCase() : null,
      pan: req.body.pan ? req.body.pan.toUpperCase() : null,
      email,
      phone,
      billingAddress,
      shippingAddress: shippingAddress || billingAddress,
      creditLimit,
      creditPeriodDays,
      coaAccountId,
      openingBalance,
      openingBalanceType,
      isActive: true
    });

    return res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customer
 * List/search customers (paginated)
 */
const listCustomers = async (req, res, next) => {
  try {
    const { companyId, search, page, limit, includeInactive, isActive } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID query parameter is required'
      });
    }

    const filter = { companyId };
    if (req.branchId) {
      filter.branchId = req.branchId;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    } else if (includeInactive === 'false') {
      filter.isActive = true;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { name: searchRegex },
        { gstin: searchRegex },
        { phone: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skipNum = (pageNum - 1) * limitNum;

    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .populate('branchId', 'branchName')
      .populate('coaAccountId', 'name code')
      .sort({ name: 1 })
      .skip(skipNum)
      .limit(limitNum)
      .lean();

    const formattedCustomers = customers.map((c) => ({
      ...c,
      branchId: c.branchId?._id?.toString() || (typeof c.branchId === 'string' ? c.branchId : c.branchId?.toString()) || null,
      branchName: c.branchId?.branchName || null,
      coaAccountId: c.coaAccountId?._id?.toString() || (typeof c.coaAccountId === 'string' ? c.coaAccountId : c.coaAccountId?.toString()) || null,
      coaAccountName: c.coaAccountId?.name || null,
      coaAccountCode: c.coaAccountId?.code || null
    }));

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      data: formattedCustomers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customer/:id
 * Retrieve single customer details
 */
const getCustomerDetails = async (req, res, next) => {
  try {
    const customer = req.customer.toObject();

    const [currentBalance, branchDoc, coaDoc] = await Promise.all([
      coaService.getAccountBalance(customer.coaAccountId),
      customer.branchId ? mongoose.model('Branch').findById(customer.branchId).select('branchName').lean() : null,
      customer.coaAccountId ? mongoose.model('ChartOfAccount').findById(customer.coaAccountId).select('name code').lean() : null
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...customer,
        branchId: customer.branchId ? customer.branchId.toString() : null,
        branchName: branchDoc?.branchName || null,
        coaAccountId: customer.coaAccountId ? customer.coaAccountId.toString() : null,
        coaAccountName: coaDoc?.name || null,
        coaAccountCode: coaDoc?.code || null,
        currentBalance
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/customer/:id
 * Update customer details
 */
const updateCustomer = async (req, res, next) => {
  try {
    const customer = req.customer; // loaded and cached by middleware
    const updates = req.body;

    // Reject changes to coaAccountId
    if ('coaAccountId' in updates) {
      return res.status(400).json({
        success: false,
        message: 'coaAccountId cannot be changed after creation'
      });
    }

    // Validate GSTIN if it is being changed
    if (updates.gstin !== undefined && updates.gstin !== customer.gstin) {
      if (updates.gstin) {
        customerService.validateGstin(updates.gstin);

        // Check for duplicate GSTIN within the same company for active customers
        const duplicate = await Customer.findOne({
          companyId: customer.companyId,
          gstin: updates.gstin.toUpperCase(),
          isActive: true,
          _id: { $ne: customer._id }
        });
        if (duplicate) {
          return res.status(409).json({
            success: false,
            message: 'Another active customer with the same GSTIN already exists'
          });
        }
        customer.gstin = updates.gstin.toUpperCase();
      } else {
        customer.gstin = null;
      }
    }

    // Update fields and sync to COA ledger
    if (updates.name !== undefined) {
      customer.name = updates.name;
      await ChartOfAccount.findByIdAndUpdate(customer.coaAccountId, { name: updates.name });
    }

    if (updates.pan !== undefined) customer.pan = updates.pan ? updates.pan.toUpperCase() : null;
    if (updates.email !== undefined) customer.email = updates.email;
    if (updates.phone !== undefined) customer.phone = updates.phone;
    if (updates.billingAddress !== undefined) customer.billingAddress = updates.billingAddress;
    if (updates.shippingAddress !== undefined) customer.shippingAddress = updates.shippingAddress;
    if (updates.creditLimit !== undefined) customer.creditLimit = updates.creditLimit;
    if (updates.creditPeriodDays !== undefined) customer.creditPeriodDays = updates.creditPeriodDays;

    if (updates.isActive !== undefined) {
      customer.isActive = updates.isActive;
      await ChartOfAccount.findByIdAndUpdate(customer.coaAccountId, { isActive: updates.isActive });
    }

    const saved = await customer.save();

    return res.status(200).json({
      success: true,
      data: saved
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/customer/:id
 * Deactivate/delete customer (always soft delete)
 */
const deactivateCustomer = async (req, res, next) => {
  try {
    const customer = req.customer; // loaded and cached by middleware
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

    // Soft delete to maintain historical integrity
    customer.isActive = false;
    await customer.save();

    // Sync active state to the linked COA account
    await ChartOfAccount.findByIdAndUpdate(customer.coaAccountId, { isActive: false });

    return res.status(200).json({
      success: true,
      message: 'Customer deactivated successfully',
      data: {
        id: customer._id,
        isActive: customer.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customer/:id/ledger
 * Return ledger transaction history
 */
const getCustomerLedger = async (req, res, next) => {
  try {
    const customer = req.customer;
    const { from, to } = req.query;

    const ledgerService = require('../services/ledger.service');
    const history = await ledgerService.getLedgerHistory(customer.coaAccountId.toString(), {
      companyId: customer.companyId.toString(),
      from,
      to
    });

    return res.status(200).json({
      success: true,
      data: {
        customerId: customer._id,
        outstandingBalance: Math.abs(history.closingBalance),
        balanceType: history.closingBalance >= 0 ? 'DR' : 'CR',
        transactions: history.entries
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customer/:id/invoices
 * Return customer invoices list (placeholder)
 */
const getCustomerInvoices = async (req, res, next) => {
  try {
    const customer = req.customer;
    let invoices = [];

    // Fallback block to check if Invoice model exists, keeping it crash-proof before Module 8 is implemented
    try {
      if (mongoose.models.Invoice) {
        const Invoice = mongoose.model('Invoice');
        const invoiceService = require('../services/invoice.service');
        const items = await Invoice.find({ customerId: customer._id }).populate('customerId', 'name').lean();
        invoices = items.map(item => invoiceService.shape(item));
      }
    } catch (err) {
      // noop
    }

    return res.status(200).json({
      success: true,
      data: invoices
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCustomer,
  listCustomers,
  getCustomerDetails,
  updateCustomer,
  deactivateCustomer,
  getCustomerLedger,
  getCustomerInvoices
};
