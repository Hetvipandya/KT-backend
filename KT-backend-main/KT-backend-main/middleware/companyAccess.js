const Company = require('../models/Company');
const Branch = require('../models/Branch');
const FinancialYear = require('../models/FinancialYear');

/**
 * Middleware to enforce company-level data isolation.
 * Checks if the authenticated user has access to the target company's data.
 */
const checkCompanyAccess = async (req, res, next) => {
  try {
    let companyId = null;
    const baseUrl = req.baseUrl || '';

    // Determine target companyId based on the route and request parameters
    if (req.params.id) {
      if (baseUrl.includes('company')) {
        companyId = req.params.id;
      } else if (baseUrl.includes('branch')) {
        const branch = await Branch.findById(req.params.id);
        if (!branch) {
          return res.status(404).json({
            success: false,
            message: 'Branch not found',
            errorCode: 'BRANCH_NOT_FOUND'
          });
        }
        companyId = branch.companyId;
        req.branch = branch; // cache branch document
      } else if (baseUrl.includes('financial-year')) {
        const fy = await FinancialYear.findById(req.params.id);
        if (!fy) {
          return res.status(404).json({
            success: false,
            message: 'Financial year not found',
            errorCode: 'FINANCIAL_YEAR_NOT_FOUND'
          });
        }
        companyId = fy.companyId;
        req.financialYear = fy; // cache financialYear document
      } else if (baseUrl.includes('purchase-order')) {
        const PurchaseOrder = require('../models/PurchaseOrder');
        const purchaseOrder = await PurchaseOrder.findById(req.params.id);
        if (!purchaseOrder) {
          return res.status(404).json({ success: false, message: 'Purchase order not found', errorCode: 'PURCHASE_ORDER_NOT_FOUND' });
        }
        companyId = purchaseOrder.companyId;
        req.purchaseOrder = purchaseOrder;
      } else if (baseUrl.includes('purchase')) {
        const Purchase = require('../models/Purchase');
        const purchase = await Purchase.findById(req.params.id);
        if (!purchase) {
          return res.status(404).json({ success: false, message: 'Purchase not found', errorCode: 'PURCHASE_NOT_FOUND' });
        }
        companyId = purchase.companyId;
        req.purchase = purchase;
      } else if (baseUrl.includes('expense')) {
        const Expense = require('../models/Expense');
        const expense = await Expense.findById(req.params.id);
        if (!expense) return res.status(404).json({ success: false, message: 'Expense not found', errorCode: 'EXPENSE_NOT_FOUND' });
        companyId = expense.companyId;
        req.expense = expense;
      } else if (baseUrl.includes('employee')) {
        const Employee = require('../models/Employee');
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found', errorCode: 'EMPLOYEE_NOT_FOUND' });
        companyId = employee.companyId;
        req.employee = employee;
      } else if (baseUrl.includes('gst/return')) {
        const GSTReturn = require('../models/GSTReturn');
        const gstReturn = await GSTReturn.findById(req.params.id);
        if (!gstReturn) return res.status(404).json({ success: false, message: 'GST return not found', errorCode: 'GST_RETURN_NOT_FOUND' });
        companyId = gstReturn.companyId;
        req.gstReturn = gstReturn;
      } else if (baseUrl.includes('coa')) {
        const ChartOfAccount = require('../models/ChartOfAccount');
        const coa = await ChartOfAccount.findById(req.params.id);
        if (!coa) {
          return res.status(404).json({
            success: false,
            message: 'Account not found',
            errorCode: 'ACCOUNT_NOT_FOUND'
          });
        }
        companyId = coa.companyId;
        req.coa = coa; // cache coa document
      } else if (baseUrl.includes('bank-account')) {
        const BankAccount = require('../models/BankAccount');
        const AccountTransfer = require('../models/AccountTransfer');
        let bankAccount = await BankAccount.findById(req.params.id);
        if (!bankAccount) {
          bankAccount = await BankAccount.findOne({ coaAccountId: req.params.id });
        }
        if (bankAccount) {
          companyId = bankAccount.companyId;
          req.bankAccount = bankAccount; // cache bankAccount document
        } else {
          const transfer = await AccountTransfer.findById(req.params.id);
          if (transfer) {
            companyId = transfer.companyId;
            req.accountTransfer = transfer; // cache accountTransfer document
          } else {
            return res.status(404).json({
              success: false,
              message: 'Resource not found',
              errorCode: 'NOT_FOUND'
            });
          }
        }
      } else if (baseUrl.includes('customer')) {
        const Customer = require('../models/Customer');
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
          return res.status(404).json({
            success: false,
            message: 'Customer not found',
            errorCode: 'CUSTOMER_NOT_FOUND'
          });
        }
        companyId = customer.companyId;
        req.customer = customer; // cache customer document
      } else if (baseUrl.includes('supplier')) {
        const Supplier = require('../models/Supplier');
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
          return res.status(404).json({
            success: false,
            message: 'Supplier not found',
            errorCode: 'SUPPLIER_NOT_FOUND'
          });
        }
        companyId = supplier.companyId;
        req.supplier = supplier; // cache supplier document
      } else if (baseUrl.includes('role')) {
        const Role = require('../models/Role');
        const role = await Role.findById(req.params.id);
        if (!role) {
          return res.status(404).json({
            success: false,
            message: 'Role not found',
            errorCode: 'ROLE_NOT_FOUND'
          });
        }
        companyId = role.companyId;
        req.role = role; // cache role document
      } else if (baseUrl.includes('invoice')) {
        const Invoice = require('../models/Invoice');
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found', errorCode: 'INVOICE_NOT_FOUND' });
        companyId = invoice.companyId;
        req.invoice = invoice;
      } else if (baseUrl.includes('payment')) {
        const Payment = require('../models/Payment');
        const payment = await Payment.findById(req.params.id);
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found', errorCode: 'PAYMENT_NOT_FOUND' });
        companyId = payment.companyId;
        req.payment = payment;
      } else if (baseUrl.includes('product')) {
        const Product = require('../models/Product');
        const product = await Product.findById(req.params.id);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: 'Product not found',
            errorCode: 'PRODUCT_NOT_FOUND'
          });
        }
        companyId = product.companyId;
        req.product = product; // cache product document
      } else if (baseUrl.includes('audit-log')) {
        const AuditLog = require('../models/AuditLog');
        const auditLog = await AuditLog.findById(req.params.id);
        if (!auditLog) {
          return res.status(404).json({
            success: false,
            message: 'Audit log not found',
            errorCode: 'AUDIT_LOG_NOT_FOUND'
          });
        }
        companyId = auditLog.companyId;
        req.auditLog = auditLog; // cache auditLog document
      }
    } else {
      // Financial years are selected branch-wise. Resolve the company from the
      // supplied branch so callers do not need to send a companyId as well.
      if (baseUrl.includes('financial-year') && req.method === 'GET' && req.query.branchId) {
        const branch = await Branch.findById(req.query.branchId);
        if (!branch) {
          return res.status(404).json({
            success: false,
            message: 'Branch not found',
            errorCode: 'BRANCH_NOT_FOUND'
          });
        }
        companyId = branch.companyId;
        req.branch = branch;
      } else {
        // Method-based parameter priority (query parameter prioritized on GET)
        if (req.method === 'GET') {
          companyId = (req.query && req.query.companyId) || (req.body && req.body.companyId) || (req.user && req.user.companyId);
        } else {
          companyId = (req.body && req.body.companyId) || (req.query && req.query.companyId) || (req.user && req.user.companyId);
        }

        // Fallback 1: check active companyAccess entries on user if companyId is missing/empty
        if ((!companyId || companyId === '') && req.user && Array.isArray(req.user.companyAccess) && req.user.companyAccess.length > 0) {
          const activeAccess = req.user.companyAccess.find((a) => a.isActive);
          if (activeAccess) {
            companyId = activeAccess.companyId;
          }
        }

        // Fallback 2: check if user created a company directly
        if (!companyId || companyId === '') {
          const createdCompany = await Company.findOne({ createdBy: req.user._id });
          if (createdCompany) {
            companyId = createdCompany._id;
          }
        }
      }
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required for access validation',
        errorCode: 'COMPANY_ID_REQUIRED'
      });
    }

    // Fetch the company to check the creator
    let company = await Company.findById(companyId);
    if (!company && req.user) {
      // Fallback lookup by user creator if passed companyId failed to find a document
      company = await Company.findOne({ createdBy: req.user._id });
    }

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
        errorCode: 'COMPANY_NOT_FOUND'
      });
    }

    const isOwner = company.createdBy.toString() === req.user._id.toString();
    const isLegacyMember = req.user.companyId && req.user.companyId.toString() === company.id;
    const isCompanyAccessMember = (req.user.companyAccess || []).some(
      (access) => access.isActive && access.companyId.toString() === company.id
    );
    const isMember = isLegacyMember || isCompanyAccessMember;

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this company\'s data',
        errorCode: 'FORBIDDEN'
      });
    }

    // Attach company to the request object for downstream controllers
    req.company = company;

    // Chain branch access resolution and isolation
    const { checkBranchAccess } = require('./branchAccess');
    return checkBranchAccess(req, res, next);
  } catch (error) {
    next(error);
  }
};

module.exports = checkCompanyAccess;
