const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const Salary = require('../models/Salary');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Employee = require('../models/Employee');
const Product = require('../models/Product');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * GET /api/admin/dashboard
 * Fetches admin dashboard statistics, counts, and recent activities.
 */
const getAdminDashboard = async (req, res, next) => {
  try {
    const companyId = req.company._id;
    const { branchId: queryBranchId, financialYearId } = req.query;
    const effectiveBranchId = req.branchId || queryBranchId || null;

    // Validate ObjectIds if supplied
    if (effectiveBranchId && !mongoose.Types.ObjectId.isValid(effectiveBranchId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid branch ID format',
        errorCode: 'INVALID_BRANCH_ID'
      });
    }
    if (financialYearId && !mongoose.Types.ObjectId.isValid(financialYearId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid financial year ID format',
        errorCode: 'INVALID_FINANCIAL_YEAR_ID'
      });
    }

    const companyIdObj = new mongoose.Types.ObjectId(companyId);
    const branchIdObj = effectiveBranchId ? new mongoose.Types.ObjectId(effectiveBranchId) : null;
    const financialYearIdObj = financialYearId ? new mongoose.Types.ObjectId(financialYearId) : null;

    // Build base aggregation matches
    const baseMatch = { companyId: companyIdObj };
    if (branchIdObj) baseMatch.branchId = branchIdObj;
    if (financialYearIdObj) baseMatch.financialYearId = financialYearIdObj;

    const invoiceMatch = { ...baseMatch, status: { $ne: 'CANCELLED' } };
    const purchaseMatch = { ...baseMatch, status: { $ne: 'CANCELLED' } };

    const entityMatch = { companyId: companyIdObj };
    if (branchIdObj) entityMatch.branchId = branchIdObj;

    // Run aggregations and counts in parallel
    const [
      salesAgg,
      purchaseAgg,
      expenseAgg,
      salaryAgg,
      receivablesAgg,
      payablesAgg,
      customersCount,
      suppliersCount,
      employeesCount,
      productsCount,
      usersCount,
      recentInvoices,
      recentPurchases,
      recentAuditLogs
    ] = await Promise.all([
      // Sales (Invoices) aggregation
      Invoice.aggregate([
        { $match: invoiceMatch },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$grandTotal' },
            totalReceived: { $sum: '$amountReceived' },
            count: { $sum: 1 }
          }
        }
      ]),
      // Purchases aggregation
      Purchase.aggregate([
        { $match: purchaseMatch },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$grandTotal' },
            count: { $sum: 1 }
          }
        }
      ]),
      // Expenses aggregation
      Expense.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ]),
      // Salaries aggregation
      Salary.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$netPayable' },
            count: { $sum: 1 }
          }
        }
      ]),
      // Receivables aggregation (outstanding invoice balances)
      Invoice.aggregate([
        { $match: { ...invoiceMatch, balanceDue: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$balanceDue' },
            count: { $sum: 1 }
          }
        }
      ]),
      // Payables aggregation (outstanding purchase balances)
      Purchase.aggregate([
        { $match: { ...purchaseMatch, balanceDue: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$balanceDue' },
            count: { $sum: 1 }
          }
        }
      ]),
      // Entity counts
      Customer.countDocuments(entityMatch),
      Supplier.countDocuments(entityMatch),
      Employee.countDocuments(entityMatch),
      Product.countDocuments(entityMatch),
      User.countDocuments({
        $or: [
          { companyId: companyIdObj },
          { 'companyAccess.companyId': companyIdObj }
        ]
      }),
      // Recent activities
      Invoice.find(invoiceMatch)
        .sort({ invoiceDate: -1, createdAt: -1 })
        .limit(5)
        .populate('customerId', 'name email')
        .lean(),
      Purchase.find(purchaseMatch)
        .sort({ billDate: -1, createdAt: -1 })
        .limit(5)
        .populate('supplierId', 'name email')
        .lean(),
      AuditLog.find({ companyId: companyIdObj })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .lean()
    ]);

    // Live Real-Time Bank & Cash Balances
    const BankAccount = require('../models/BankAccount');
    const bankAccountService = require('../services/bankAccount.service');

    const bankFilter = { companyId: companyIdObj, isActive: true };
    if (branchIdObj) {
      bankFilter.$or = [{ branchId: branchIdObj }, { branchId: null }];
    }

    const bankAccounts = await BankAccount.find(bankFilter).lean();

    let totalCashBalance = 0;
    let totalBankBalance = 0;

    await Promise.all(
      bankAccounts.map(async (acc) => {
        const balance = await bankAccountService.getAccountBalance(acc.coaAccountId);
        if (acc.accountType === 'Cash') {
          totalCashBalance += balance;
        } else {
          totalBankBalance += balance;
        }
      })
    );

    // Format aggregation results
    const sales = salesAgg[0] || { totalAmount: 0, totalReceived: 0, count: 0 };
    const purchases = purchaseAgg[0] || { totalAmount: 0, count: 0 };
    const expenses = expenseAgg[0] || { totalAmount: 0, count: 0 };
    const salaries = salaryAgg[0] || { totalAmount: 0, count: 0 };
    const receivables = receivablesAgg[0] || { totalAmount: 0, count: 0 };
    const payables = payablesAgg[0] || { totalAmount: 0, count: 0 };

    // Net Profit: Sales - (Purchases + Expenses + Salaries)
    const netProfit = sales.totalAmount - (purchases.totalAmount + expenses.totalAmount + salaries.totalAmount);

    return res.status(200).json({
      success: true,
      data: {
        company: {
          id: req.company._id.toString(),
          name: req.company.name
        },
        balances: {
          cash: totalCashBalance,
          bank: totalBankBalance,
          total: totalCashBalance + totalBankBalance
        },
        statistics: {
          sales: {
            totalAmount: sales.totalAmount,
            totalReceived: sales.totalReceived,
            count: sales.count
          },
          purchases: {
            totalAmount: purchases.totalAmount,
            count: purchases.count
          },
          expenses: {
            totalAmount: expenses.totalAmount,
            count: expenses.count
          },
          salaries: {
            totalAmount: salaries.totalAmount,
            count: salaries.count
          },
          receivables: {
            totalAmount: receivables.totalAmount,
            count: receivables.count
          },
          payables: {
            totalAmount: payables.totalAmount,
            count: payables.count
          },
          cashBalance: totalCashBalance,
          bankBalance: totalBankBalance,
          liquidBalance: totalCashBalance + totalBankBalance,
          totalCash: totalCashBalance,
          totalBank: totalBankBalance,
          totalSales: sales.totalAmount,
          totalPurchases: purchases.totalAmount,
          totalExpenses: expenses.totalAmount,
          totalSalaries: salaries.totalAmount,
          totalReceivables: receivables.totalAmount,
          totalPayables: payables.totalAmount,
          netProfit
        },
        counts: {
          customers: customersCount,
          suppliers: suppliersCount,
          employees: employeesCount,
          products: productsCount,
          users: usersCount
        },
        recentActivity: {
          invoices: recentInvoices.map((inv) => ({
            id: inv._id.toString(),
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate,
            grandTotal: inv.grandTotal,
            status: inv.status,
            customerName: inv.customerName,
            customer: inv.customerId ? {
              id: inv.customerId._id.toString(),
              name: inv.customerId.name,
              email: inv.customerId.email
            } : null
          })),
          purchases: recentPurchases.map((pur) => ({
            id: pur._id.toString(),
            billNumber: pur.billNumber,
            billDate: pur.billDate,
            grandTotal: pur.grandTotal,
            status: pur.status,
            supplier: pur.supplierId ? {
              id: pur.supplierId._id.toString(),
              name: pur.supplierId.name,
              email: pur.supplierId.email
            } : null
          })),
          auditLogs: recentAuditLogs.map((log) => ({
            id: log._id.toString(),
            module: log.module,
            actionType: log.actionType,
            description: log.description,
            createdAt: log.createdAt,
            user: log.userId ? {
              id: log.userId._id.toString(),
              name: log.userId.name,
              email: log.userId.email
            } : null
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboard
};
