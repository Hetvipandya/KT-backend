const SupplierPayment = require('../models/SupplierPayment');
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const FinancialYear = require('../models/FinancialYear');
const BankAccount = require('../models/BankAccount');
const ChartOfAccount = require('../models/ChartOfAccount');
const bankAccountService = require('./bankAccount.service');
const journal = require('./journalEntry.service');

const EPSILON = 0.01;
const BANK_PAYMENT_MODES = new Set(['BANK_TRANSFER', 'CHEQUE', 'UPI']);
const CASH_ACCOUNT_TYPES = new Set(['Cash', 'Wallet']);
const id = (value) => value?.toString();
const fail = (message, statusCode = 400, errorCode) => Object.assign(
  new Error(message),
  { statusCode, errorCode }
);

const shape = (payment) => ({
  id: id(payment._id),
  companyId: id(payment.companyId),
  branchId: payment.branchId ? id(payment.branchId) : null,
  financialYearId: id(payment.financialYearId),
  supplierId: id(payment.supplierId),
  paymentNumber: payment.paymentNumber,
  paymentDate: payment.paymentDate,
  mode: payment.mode,
  bankAccountId: payment.bankAccountId ? id(payment.bankAccountId) : null,
  reference: payment.reference,
  totalAmount: payment.totalAmount,
  allocations: payment.allocations.map((item) => ({
    purchaseId: id(item.purchaseId),
    allocatedAmount: item.allocatedAmount
  })),
  status: payment.status,
  journalEntryId: payment.journalEntryId ? id(payment.journalEntryId) : null,
  reversalJournalEntryId: payment.reversalJournalEntryId ? id(payment.reversalJournalEntryId) : null,
  notes: payment.notes,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt
});

const nextNumber = async (companyId, financialYearId) => {
  const last = await SupplierPayment.findOne({ companyId, financialYearId })
    .sort({ paymentSequence: -1 })
    .select('paymentSequence');
  const paymentSequence = (last?.paymentSequence || 0) + 1;
  return { paymentSequence, paymentNumber: `SP-${String(paymentSequence).padStart(4, '0')}` };
};

const validateFundingAccount = async (data) => {
  const requiresAccount = BANK_PAYMENT_MODES.has(data.mode) || data.mode === 'CASH';
  if (requiresAccount && !data.bankAccountId) {
    throw fail(`A bank or cash account is required for ${data.mode} payments`, 400, 'BANK_ACCOUNT_REQUIRED');
  }
  if (!data.bankAccountId) return null;

  const account = await BankAccount.findOne({
    _id: data.bankAccountId,
    companyId: data.companyId,
    branchId: data.branchId ? { $in: [data.branchId, null] } : null,
    isActive: true
  });
  if (!account) {
    throw fail('Bank or cash account not found for this company', 404, 'BANK_ACCOUNT_NOT_FOUND');
  }

  const isCashAccount = CASH_ACCOUNT_TYPES.has(account.accountType);
  if (data.mode === 'CASH' && !isCashAccount) {
    throw fail('Select a Cash or Wallet account for a cash payment', 400, 'INVALID_PAYMENT_ACCOUNT_TYPE');
  }
  if (BANK_PAYMENT_MODES.has(data.mode) && (isCashAccount || account.accountType === 'CreditCard')) {
    throw fail('Select an active bank account for this payment method', 400, 'INVALID_PAYMENT_ACCOUNT_TYPE');
  }

  const availableBalance = Number(await bankAccountService.getAccountBalance(account.coaAccountId));
  if (!Number.isFinite(availableBalance)) {
    throw fail('Could not verify the selected account balance. Try again before recording payment.', 503, 'ACCOUNT_BALANCE_UNAVAILABLE');
  }
  if (availableBalance + EPSILON < data.totalAmount) {
    throw fail(
      `Insufficient funds in ${account.accountName}. Available: ${Math.max(availableBalance, 0).toFixed(2)}; required: ${data.totalAmount.toFixed(2)}.`,
      409,
      'INSUFFICIENT_FUNDS'
    );
  }
  return account;
};

const createSupplierPayment = async (data, userId) => {
  const fy = await FinancialYear.findById(data.financialYearId);
  if (!fy || id(fy.companyId) !== id(data.companyId)) {
    throw fail('Financial year does not belong to the specified company', 400, 'INVALID_FINANCIAL_YEAR_COMPANY');
  }
  if (fy.isLocked) {
    throw fail('Cannot pay supplier in a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED');
  }
  const paymentDate = new Date(data.paymentDate);
  if (paymentDate < fy.startDate || paymentDate > fy.endDate) {
    throw fail('paymentDate must fall within the selected financial year', 400, 'PAYMENT_DATE_OUTSIDE_FINANCIAL_YEAR');
  }

  const supplier = await Supplier.findOne({
    _id: data.supplierId,
    companyId: data.companyId,
    isActive: true
  });
  if (!supplier) {
    throw fail('Supplier not found for this company', 404, 'SUPPLIER_NOT_FOUND');
  }

  const fundingAccount = await validateFundingAccount(data);
  const purchaseIds = data.allocations.map((item) => item.purchaseId);
  const purchases = await Purchase.find({
    _id: { $in: purchaseIds },
    companyId: data.companyId,
    supplierId: data.supplierId
  });
  if (purchases.length !== purchaseIds.length) {
    throw fail('One or more purchases do not belong to this supplier and company', 400, 'INVALID_ALLOCATION_PURCHASE');
  }

  const byId = new Map(purchases.map((purchase) => [id(purchase._id), purchase]));
  for (const allocation of data.allocations) {
    const purchase = byId.get(allocation.purchaseId);
    if (!purchase || !['POSTED', 'PARTIALLY_PAID'].includes(purchase.status)) {
      throw fail('Only posted purchases can receive supplier payments', 400, 'PURCHASE_NOT_PAYABLE');
    }
    if (allocation.allocatedAmount - purchase.balanceDue > EPSILON) {
      throw fail('Allocation exceeds purchase balance due', 400, 'ALLOCATION_EXCEEDS_BALANCE');
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const numbering = await nextNumber(data.companyId, data.financialYearId);
    let payment;
    try {
      payment = await SupplierPayment.create({
        ...data,
        ...numbering,
        paymentDate,
        bankAccountId: data.bankAccountId || null,
        createdBy: userId,
        updatedBy: userId
      });

      if (fundingAccount) {
        const payable = supplier.payableAccountId
          ? await ChartOfAccount.findById(supplier.payableAccountId)
          : null;
        if (!payable) {
          throw fail('Supplier payable account is unavailable', 500, 'SUPPLIER_PAYMENT_JOURNAL_FAILED');
        }
        const isCashAccount = CASH_ACCOUNT_TYPES.has(fundingAccount.accountType);
        const entry = await journal.createJournalEntry({
          companyId: data.companyId,
          branchId: data.branchId || null,
          financialYearId: data.financialYearId,
          entryDate: paymentDate,
          reference: data.reference || payment.paymentNumber,
          narration: `Supplier payment ${payment.paymentNumber}`,
          lines: [
            {
              accountId: payable._id,
              debit: data.totalAmount,
              credit: 0,
              remarks: 'Supplier payment / advance'
            },
            {
              accountId: fundingAccount.coaAccountId,
              debit: 0,
              credit: data.totalAmount,
              remarks: isCashAccount ? 'Cash payment' : 'Bank payment'
            }
          ]
        }, userId);
        payment.journalEntryId = entry._id;
        await payment.save();
      }

      for (const allocation of data.allocations) {
        const purchase = byId.get(allocation.purchaseId);
        purchase.balanceDue = Math.max(0, purchase.balanceDue - allocation.allocatedAmount);
        purchase.status = purchase.balanceDue <= EPSILON ? 'PAID' : 'PARTIALLY_PAID';
        purchase.updatedBy = userId;
        await purchase.save();
      }
      return shape(payment);
    } catch (error) {
      if (payment && !payment.journalEntryId) {
        await SupplierPayment.deleteOne({ _id: payment._id });
      }
      if (error.code !== 11000 || attempt === 2) throw error;
    }
  }
};

module.exports = { createSupplierPayment, shape, validateFundingAccount };
