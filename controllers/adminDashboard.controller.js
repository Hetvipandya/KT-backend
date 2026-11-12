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
    const {
      branchId: queryBranchId,
      financialYearId,
      startDate: queryStartDate,
      endDate: queryEndDate,
    } = req.query;
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
    const hasStartDate = queryStartDate !== undefined && queryStartDate !== '';
    const hasEndDate = queryEndDate !== undefined && queryEndDate !== '';
    if (
      (hasStartDate && typeof queryStartDate !== 'string') ||
      (hasEndDate && typeof queryEndDate !== 'string')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Start and end dates must be valid date strings',
        errorCode: 'INVALID_DATE_RANGE',
      });
    }

    const startDate = hasStartDate ? new Date(queryStartDate) : null;
    const endDate = hasEndDate ? new Date(queryEndDate) : null;
    const hasInvalidCalendarDate = [queryStartDate, queryEndDate].some((value) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value;
    });
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(queryEndDate)) {
      endDate.setUTCHours(23, 59, 59, 999);
    }
    if (
      (startDate && Number.isNaN(startDate.getTime())) ||
      (endDate && Number.isNaN(endDate.getTime())) ||
      hasInvalidCalendarDate ||
      (startDate && endDate && startDate > endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Provide a valid date range with the start date on or before the end date',
        errorCode: 'INVALID_DATE_RANGE',
      });
    }

    const dateMatch = (field) => {
      const range = {};
      if (startDate) range.$gte = startDate;
      if (endDate) range.$lte = endDate;
      return Object.keys(range).length ? { [field]: range } : {};
    };

    const companyIdObj = new mongoose.Types.ObjectId(companyId);
    const branchIdObj = effectiveBranchId ? new mongoose.Types.ObjectId(effectiveBranchId) : null;
    const financialYearIdObj = financialYearId ? new mongoose.Types.ObjectId(financialYearId) : null;

    // Build base aggregation matches
    const baseMatch = { companyId: companyIdObj };
    if (branchIdObj) baseMatch.branchId = branchIdObj;
    if (financialYearIdObj) baseMatch.financialYearId = financialYearIdObj;

    const invoiceMatch = { ...baseMatch, status: { $ne: 'CANCELLED' } };
    const purchaseMatch = { ...baseMatch, status: { $ne: 'CANCELLED' } };
    const invoiceDateMatch = { ...invoiceMatch, ...dateMatch('invoiceDate') };
    const purchaseDateMatch = { ...purchaseMatch, ...dateMatch('billDate') };
    const expenseDateMatch = { ...baseMatch, ...dateMatch('expenseDate') };
    const salaryDateMatch = { ...baseMatch, ...dateMatch('periodStart') };

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
      recentAuditLogs,
      expenseCategoriesAgg,
      recentExpenses,
      recentSalaries,
      branchSalesAgg,
      branchPurchaseAgg,
      branchExpenseAgg,
      branchSalaryAgg,
      branchReceivablesAgg,
    ] = await Promise.all([
      // Sales (Invoices) aggregation
      Invoice.aggregate([ 
        { $match: invoiceDateMatch },
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
        { $match: purchaseDateMatch },
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
        { $match: expenseDateMatch },
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
        { $match: salaryDateMatch },
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
        { $match: { ...invoiceDateMatch, balanceDue: { $gt: 0 } } },
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
        { $match: { ...purchaseDateMatch, balanceDue: { $gt: 0 } } },
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
      Invoice.find(invoiceDateMatch)
        .sort({ invoiceDate: -1, createdAt: -1 })
        .limit(5)
        .populate('customerId', 'name email')
        .lean(),
      Purchase.find(purchaseDateMatch)
        .sort({ billDate: -1, createdAt: -1 })
        .limit(5)
        .populate('supplierId', 'name email')
        .lean(),
      AuditLog.find({ companyId: companyIdObj })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .lean(),
      Expense.aggregate([
        { $match: expenseDateMatch },
        {
          $group: {
            _id: '$category',
            totalAmount: { $sum: { $ifNull: ['$totalAmount', '$amount'] } },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
      Expense.find(expenseDateMatch)
        .sort({ expenseDate: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      Salary.find(salaryDateMatch)
        .sort({ periodStart: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      Invoice.aggregate([
        { $match: invoiceDateMatch },
        { $group: { _id: '$branchId', totalAmount: { $sum: '$grandTotal' } } },
      ]),
      Purchase.aggregate([
        { $match: purchaseDateMatch },
        { $group: { _id: '$branchId', totalAmount: { $sum: '$grandTotal' } } },
      ]),
      Expense.aggregate([
        {
          $match: expenseDateMatch,
        },
        {
          $group: {
            _id: '$branchId',
            totalAmount: { $sum: { $ifNull: ['$totalAmount', '$amount'] } },
          },
        },
      ]),
      Salary.aggregate([
        { $match: salaryDateMatch },
        { $group: { _id: '$branchId', totalAmount: { $sum: '$netPayable' } } },
      ]),
      Invoice.aggregate([
        { $match: { ...invoiceDateMatch, balanceDue: { $gt: 0 } } },
        { $group: { _id: '$branchId', totalAmount: { $sum: '$balanceDue' } } },
      ]),
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
    const totalOutflow = purchases.totalAmount + expenses.totalAmount + salaries.totalAmount;
    const expenseBreakdown = [
      { name: 'Salaries', amount: salaries.totalAmount },
      { name: 'Purchases', amount: purchases.totalAmount },
      ...expenseCategoriesAgg.map((item) => ({
        name: item._id || 'Other expenses',
        amount: item.totalAmount,
      })),
    ].filter((item) => item.amount > 0);

    const branchTotals = new Map();
    const addBranchTotals = (rows, field) => {
      rows.forEach(({ _id, totalAmount }) => {
        const key = _id ? _id.toString() : 'unassigned';
        const current = branchTotals.get(key) || {
          branchId: _id ? _id.toString() : null,
          revenue: 0,
          purchases: 0,
          expenses: 0,
          salaries: 0,
          receivables: 0,
        };
        current[field] = totalAmount || 0;
        branchTotals.set(key, current);
      });
    };
    addBranchTotals(branchSalesAgg, 'revenue');
    addBranchTotals(branchPurchaseAgg, 'purchases');
    addBranchTotals(branchExpenseAgg, 'expenses');
    addBranchTotals(branchSalaryAgg, 'salaries');
    addBranchTotals(branchReceivablesAgg, 'receivables');
    const branchPerformance = Array.from(branchTotals.values()).map((branch) => ({
      ...branch,
      totalExpenses: branch.purchases + branch.expenses + branch.salaries,
      netProfit: branch.revenue - branch.purchases - branch.expenses - branch.salaries,
    }));

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
          totalOutflow,
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
          expenses: recentExpenses.map((expense) => ({
            id: expense._id.toString(),
            description: expense.description || expense.category || 'Expense',
            category: expense.category || 'Other expenses',
            expenseDate: expense.expenseDate,
            amount: expense.totalAmount || expense.amount || 0,
          })),
          salaries: recentSalaries.map((salary) => ({
            id: salary._id.toString(),
            employeeName: salary.employeeName || salary.employee?.name || 'Salary payment',
            periodStart: salary.periodStart,
            amount: salary.netPayable || 0,
            paymentMode: salary.paymentMode || '',
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
        },
        expenseBreakdown,
        branchPerformance
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboard
};
