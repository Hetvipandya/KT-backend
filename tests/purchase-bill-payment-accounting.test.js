jest.mock('../models/BankAccount', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/ChartOfAccount', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../models/SupplierPayment', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
}));
jest.mock('../models/Supplier', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/Purchase', () => ({
  find: jest.fn(),
}));
jest.mock('../models/FinancialYear', () => ({
  findById: jest.fn(),
}));
jest.mock('../services/bankAccount.service', () => ({
  getAccountBalance: jest.fn(),
}));
jest.mock('../services/journalEntry.service', () => ({
  createJournalEntry: jest.fn(),
}));
jest.mock('../services/autoCoaMapping.service', () => ({
  ensureExpenseLedger: jest.fn(),
  ensureIncomeLedger: jest.fn(),
}));

const BankAccount = require('../models/BankAccount');
const ChartOfAccount = require('../models/ChartOfAccount');
const SupplierPayment = require('../models/SupplierPayment');
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const FinancialYear = require('../models/FinancialYear');
const bankAccountService = require('../services/bankAccount.service');
const journal = require('../services/journalEntry.service');
const autoCoaMapping = require('../services/autoCoaMapping.service');
const { validateFundingAccount, createSupplierPayment } = require('../services/paySupplier.service');
const { paySupplierSchema } = require('../validators/purchase.validators');
const { postJournal } = require('../services/purchase.service');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const BRANCH_ID = '6ac8a921e6b91ab589aa3002';
const ACCOUNT_ID = '6ac8a921e6b91ab589aa3003';
const COA_ID = '6ac8a921e6b91ab589aa3004';
const SUPPLIER_COA_ID = '6ac8a921e6b91ab589aa3005';

describe('Purchase bill payment funding and journal balancing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('cash supplier payments require a selected cash account', () => {
    const result = paySupplierSchema.safeParse({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      financialYearId: ACCOUNT_ID,
      supplierId: COA_ID,
      paymentDate: '2026-04-02',
      mode: 'CASH',
      totalAmount: 100,
      allocations: [],
    });

    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['bankAccountId'] }),
    ]));
  });

  test('rejects a payment that exceeds the selected account balance', async () => {
    BankAccount.findOne.mockResolvedValue({
      _id: ACCOUNT_ID,
      accountName: 'Main Cash',
      accountType: 'Cash',
      coaAccountId: COA_ID,
    });
    bankAccountService.getAccountBalance.mockResolvedValue(99);

    await expect(validateFundingAccount({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      bankAccountId: ACCOUNT_ID,
      mode: 'CASH',
      totalAmount: 100,
    })).rejects.toMatchObject({ errorCode: 'INSUFFICIENT_FUNDS', statusCode: 409 });
  });

  test('does not allow a bank account to be used for a cash payment', async () => {
    BankAccount.findOne.mockResolvedValue({
      _id: ACCOUNT_ID,
      accountName: 'Main Bank',
      accountType: 'Current',
      coaAccountId: COA_ID,
    });

    await expect(validateFundingAccount({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      bankAccountId: ACCOUNT_ID,
      mode: 'CASH',
      totalAmount: 100,
    })).rejects.toMatchObject({ errorCode: 'INVALID_PAYMENT_ACCOUNT_TYPE', statusCode: 400 });
    expect(bankAccountService.getAccountBalance).not.toHaveBeenCalled();
  });

  test('accepts a funded cash account and returns it for cash ledger posting', async () => {
    const account = {
      _id: ACCOUNT_ID,
      accountName: 'Main Cash',
      accountType: 'Cash',
      coaAccountId: COA_ID,
    };
    BankAccount.findOne.mockResolvedValue(account);
    bankAccountService.getAccountBalance.mockResolvedValue(500);

    await expect(validateFundingAccount({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      bankAccountId: ACCOUNT_ID,
      mode: 'CASH',
      totalAmount: 100,
    })).resolves.toBe(account);
  });

  test('posts funded cash supplier payments against the selected cash ledger', async () => {
    const purchase = {
      _id: 'purchase-id',
      balanceDue: 100,
      status: 'POSTED',
      save: jest.fn().mockResolvedValue(undefined),
    };
    const payment = {
      _id: 'payment-id',
      createdAt: new Date('2026-04-02'),
      updatedAt: new Date('2026-04-02'),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const numberQuery = {
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(null),
    };
    FinancialYear.findById.mockResolvedValue({
      companyId: COMPANY_ID,
      isLocked: false,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
    });
    Supplier.findOne.mockResolvedValue({ payableAccountId: SUPPLIER_COA_ID });
    BankAccount.findOne.mockResolvedValue({
      _id: ACCOUNT_ID,
      accountName: 'Main Cash',
      accountType: 'Cash',
      coaAccountId: COA_ID,
    });
    bankAccountService.getAccountBalance.mockResolvedValue(500);
    Purchase.find.mockResolvedValue([purchase]);
    SupplierPayment.findOne.mockReturnValue(numberQuery);
    SupplierPayment.create.mockImplementation(async (data) => Object.assign(payment, data));
    ChartOfAccount.findById.mockResolvedValue({ _id: SUPPLIER_COA_ID });
    journal.createJournalEntry.mockResolvedValue({ _id: 'journal-id' });

    await expect(createSupplierPayment({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      financialYearId: ACCOUNT_ID,
      supplierId: SUPPLIER_COA_ID,
      paymentDate: '2026-04-02',
      mode: 'CASH',
      bankAccountId: ACCOUNT_ID,
      totalAmount: 100,
      allocations: [{ purchaseId: 'purchase-id', allocatedAmount: 100 }],
    }, 'user-id')).resolves.toMatchObject({
      journalEntryId: 'journal-id',
      mode: 'CASH',
    });

    expect(journal.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ accountId: COA_ID, credit: 100, remarks: 'Cash payment' }),
        ]),
      }),
      'user-id'
    );
    expect(payment.journalEntryId).toBe('journal-id');
    expect(purchase.status).toBe('PAID');
    expect(purchase.save).toHaveBeenCalledTimes(1);
  });

  test.each([
    { roundOff: 0.25, grandTotal: 100.25, accountType: 'Expense', accountId: 'rounding-expense' },
    { roundOff: -0.25, grandTotal: 99.75, accountType: 'Income', accountId: 'rounding-income' },
  ])('balances a purchase journal with round off $roundOff', async ({ roundOff, grandTotal, accountType, accountId }) => {
    ChartOfAccount.findById.mockResolvedValue({ _id: SUPPLIER_COA_ID });
    ChartOfAccount.findOne.mockResolvedValue({ _id: 'purchase-coa' });
    autoCoaMapping.ensureExpenseLedger.mockResolvedValue({ _id: 'rounding-expense' });
    autoCoaMapping.ensureIncomeLedger.mockResolvedValue({ _id: 'rounding-income' });
    journal.createJournalEntry.mockImplementation(async (payload) => payload);

    await postJournal({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      financialYearId: ACCOUNT_ID,
      billDate: new Date('2026-04-02'),
      billNumber: 'B-001',
      subTotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal,
      roundOff,
    }, { payableAccountId: SUPPLIER_COA_ID }, 'user-id');

    const { lines } = journal.createJournalEntry.mock.calls[0][0];
    expect(lines.reduce((sum, line) => sum + line.debit, 0))
      .toBeCloseTo(lines.reduce((sum, line) => sum + line.credit, 0), 2);
    expect(lines).toContainEqual(expect.objectContaining({
      accountId: accountId,
      debit: accountType === 'Expense' ? 0.25 : 0,
      credit: accountType === 'Income' ? 0.25 : 0,
    }));
    if (accountType === 'Expense') {
      expect(autoCoaMapping.ensureExpenseLedger).toHaveBeenCalledWith(COMPANY_ID, 'Purchase Round Off');
    } else {
      expect(autoCoaMapping.ensureIncomeLedger).toHaveBeenCalledWith(
        COMPANY_ID,
        'Purchase Round Off',
        'purchase:round-off:income'
      );
    }
  });
});
