jest.mock('../models/Lending', () => ({
  create: jest.fn(),
  deleteOne: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));
jest.mock('../models/Branch', () => ({ findOne: jest.fn() }));
jest.mock('../models/Customer', () => ({ findOne: jest.fn() }));
jest.mock('../models/FinancialYear', () => ({ findById: jest.fn() }));
jest.mock('../models/BankAccount', () => ({ findOne: jest.fn() }));
jest.mock('../models/ChartOfAccount', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../services/coa.service', () => ({ generateNextCode: jest.fn() }));
jest.mock('../services/bankAccount.service', () => ({ getAccountBalance: jest.fn() }));
jest.mock('../services/journalEntry.service', () => ({
  createJournalEntry: jest.fn(),
  reverseJournalEntry: jest.fn(),
}));
jest.mock('../services/autoCoaMapping.service', () => ({ ensureIncomeLedger: jest.fn() }));

const Lending = require('../models/Lending');
const Branch = require('../models/Branch');
const Customer = require('../models/Customer');
const FinancialYear = require('../models/FinancialYear');
const BankAccount = require('../models/BankAccount');
const ChartOfAccount = require('../models/ChartOfAccount');
const coaService = require('../services/coa.service');
const bankAccountService = require('../services/bankAccount.service');
const journalService = require('../services/journalEntry.service');
const { ensureIncomeLedger } = require('../services/autoCoaMapping.service');
const { createLending, createRepayment } = require('../services/lending.service');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const BRANCH_ID = '6ac8a921e6b91ab589aa3002';
const YEAR_ID = '6ac8a921e6b91ab589aa3003';
const CUSTOMER_ID = '6ac8a921e6b91ab589aa3004';
const BANK_ACCOUNT_ID = '6ac8a921e6b91ab589aa3005';
const BANK_COA_ID = '6ac8a921e6b91ab589aa3006';
const LENDING_ID = '6ac8a921e6b91ab589aa3007';
const RECEIVABLE_COA_ID = '6ac8a921e6b91ab589aa3008';
const INTEREST_COA_ID = '6ac8a921e6b91ab589aa3009';
const JOURNAL_ID = '6ac8a921e6b91ab589aa3010';
const USER_ID = '6ac8a921e6b91ab589aa3011';

const bankAccount = {
  _id: BANK_ACCOUNT_ID,
  accountName: 'Operating Bank',
  coaAccountId: BANK_COA_ID,
};

const makeLending = (overrides = {}) => ({
  _id: LENDING_ID,
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  financialYearId: YEAR_ID,
  customerId: CUSTOMER_ID,
  customerName: 'Example Customer',
  principalAmount: 1000,
  principalOutstanding: 1000,
  annualInterestRatePercent: 8,
  startDate: new Date('2026-04-02'),
  disbursementBankAccountId: BANK_ACCOUNT_ID,
  disbursementAccountName: bankAccount.accountName,
  receivableAccountId: RECEIVABLE_COA_ID,
  totalPrincipalRepaid: 0,
  totalInterestReceived: 0,
  status: 'ACTIVE',
  repayments: [],
  save: jest.fn().mockResolvedValue(undefined),
  toObject() {
    return { ...this };
  },
  ...overrides,
});

const repaymentData = (overrides = {}) => ({
  companyId: COMPANY_ID,
  financialYearId: YEAR_ID,
  paymentDate: '2026-04-10',
  principalAmount: 200,
  interestAmount: 40,
  bankAccountId: BANK_ACCOUNT_ID,
  reference: 'RCPT-001',
  notes: '',
  ...overrides,
});

describe('Customer lending accounting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Branch.findOne.mockResolvedValue({ _id: BRANCH_ID });
    FinancialYear.findById.mockResolvedValue({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      isLocked: false,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
    });
    Customer.findOne.mockResolvedValue({ _id: CUSTOMER_ID, name: 'Example Customer', phone: '1234567890' });
    BankAccount.findOne.mockResolvedValue(bankAccount);
    ChartOfAccount.findOne.mockImplementation(async (filter) => (
      filter.autoMapKey ? null : { _id: '6ac8a921e6b91ab589aa3012' }
    ));
    ChartOfAccount.create.mockResolvedValue({ _id: RECEIVABLE_COA_ID });
    coaService.generateNextCode.mockResolvedValue('1201');
    bankAccountService.getAccountBalance.mockResolvedValue(10000);
    ensureIncomeLedger.mockResolvedValue({ _id: INTEREST_COA_ID });
    journalService.createJournalEntry.mockResolvedValue({ _id: JOURNAL_ID });
    journalService.reverseJournalEntry.mockResolvedValue({});
  });

  test('records a loan disbursement with balanced receivable and bank lines', async () => {
    const lending = makeLending();
    Lending.create.mockResolvedValue(lending);

    await createLending({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      financialYearId: YEAR_ID,
      customerId: CUSTOMER_ID,
      principalAmount: 1000,
      annualInterestRatePercent: 8,
      startDate: '2026-04-02',
      disbursementBankAccountId: BANK_ACCOUNT_ID,
    }, USER_ID);

    const journal = journalService.createJournalEntry.mock.calls[0][0];
    expect(journal.lines).toEqual([
      expect.objectContaining({ accountId: RECEIVABLE_COA_ID, debit: 1000, credit: 0 }),
      expect.objectContaining({ accountId: BANK_COA_ID, debit: 0, credit: 1000 }),
    ]);
    expect(journal.lines.reduce((sum, line) => sum + line.debit, 0))
      .toBe(journal.lines.reduce((sum, line) => sum + line.credit, 0));
    expect(lending.receivableAccountId).toBe(RECEIVABLE_COA_ID);
    expect(lending.initialJournalEntryId).toBe(JOURNAL_ID);
  });

  test('rejects disbursement when the selected account balance is insufficient', async () => {
    bankAccountService.getAccountBalance.mockResolvedValue(999);

    await expect(createLending({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      financialYearId: YEAR_ID,
      customerId: CUSTOMER_ID,
      principalAmount: 1000,
      annualInterestRatePercent: 8,
      startDate: '2026-04-02',
      disbursementBankAccountId: BANK_ACCOUNT_ID,
    }, USER_ID)).rejects.toMatchObject({ errorCode: 'INSUFFICIENT_FUNDS' });

    expect(Lending.create).not.toHaveBeenCalled();
    expect(journalService.createJournalEntry).not.toHaveBeenCalled();
  });

  test('posts received principal and interest separately and reduces outstanding principal', async () => {
    Lending.findOne.mockResolvedValue(makeLending());
    Lending.findOneAndUpdate.mockResolvedValue(makeLending({
      principalOutstanding: 800,
      totalPrincipalRepaid: 200,
      totalInterestReceived: 40,
      repayments: [{ _id: 'repayment-id' }],
    }));

    await createRepayment(LENDING_ID, repaymentData(), USER_ID);

    const journal = journalService.createJournalEntry.mock.calls[0][0];
    expect(journal.lines).toEqual([
      expect.objectContaining({ accountId: BANK_COA_ID, debit: 240, credit: 0 }),
      expect.objectContaining({ accountId: RECEIVABLE_COA_ID, debit: 0, credit: 200 }),
      expect.objectContaining({ accountId: INTEREST_COA_ID, debit: 0, credit: 40 }),
    ]);
    expect(journal.lines.reduce((sum, line) => sum + line.debit, 0))
      .toBe(journal.lines.reduce((sum, line) => sum + line.credit, 0));
    expect(Lending.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ principalOutstanding: 1000 }),
      expect.objectContaining({
        $inc: {
          principalOutstanding: -200,
          totalPrincipalRepaid: 200,
          totalInterestReceived: 40,
        },
      }),
      expect.any(Object),
    );
  });

  test('rejects principal repayment beyond the outstanding balance without posting', async () => {
    Lending.findOne.mockResolvedValue(makeLending());

    await expect(createRepayment(
      LENDING_ID,
      repaymentData({ principalAmount: 1001, interestAmount: 0 }),
      USER_ID,
    )).rejects.toMatchObject({ errorCode: 'PRINCIPAL_REPAYMENT_EXCEEDS_BALANCE' });
    expect(journalService.createJournalEntry).not.toHaveBeenCalled();
  });

  test('reverses the journal when a concurrent repayment changes the balance', async () => {
    Lending.findOne.mockResolvedValue(makeLending());
    Lending.findOneAndUpdate.mockResolvedValue(null);

    await expect(createRepayment(LENDING_ID, repaymentData(), USER_ID))
      .rejects.toMatchObject({ errorCode: 'LENDING_BALANCE_CHANGED' });
    expect(journalService.reverseJournalEntry).toHaveBeenCalledWith(JOURNAL_ID, USER_ID);
  });
});
