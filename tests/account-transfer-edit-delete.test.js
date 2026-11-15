jest.mock('../models/BankAccount', () => ({ findOne: jest.fn() }));
jest.mock('../models/ChartOfAccount', () => ({ findOne: jest.fn() }));
jest.mock('../models/FinancialYear', () => ({ findOne: jest.fn() }));
jest.mock('../models/AccountTransfer', () => ({
  findOne: jest.fn(),
  findById: jest.fn()
}));
jest.mock('../services/journalEntry.service', () => ({
  createJournalEntry: jest.fn(),
  reverseJournalEntry: jest.fn()
}));
jest.mock('../services/auditLog.service', () => ({
  recordAuditEvent: jest.fn()
}));

const BankAccount = require('../models/BankAccount');
const FinancialYear = require('../models/FinancialYear');
const AccountTransfer = require('../models/AccountTransfer');
const journalEntryService = require('../services/journalEntry.service');
const auditLogService = require('../services/auditLog.service');
const { deleteTransfer, updateTransfer } = require('../services/accountTransfer.service');

const COMPANY_ID = '64f0a2c1c4b8d30000000001';
const TRANSFER_ID = '64f0a2c1c4b8d30000000002';
const FROM_ID = '64f0a2c1c4b8d30000000003';
const TO_ID = '64f0a2c1c4b8d30000000004';
const NEW_FROM_ID = '64f0a2c1c4b8d30000000005';
const NEW_TO_ID = '64f0a2c1c4b8d30000000006';
const OLD_JOURNAL_ID = '64f0a2c1c4b8d30000000007';
const NEW_JOURNAL_ID = '64f0a2c1c4b8d30000000008';
const REVERSAL_ID = '64f0a2c1c4b8d30000000009';
const FINANCIAL_YEAR_ID = '64f0a2c1c4b8d30000000010';

const makeTransfer = (status = 'Completed') => {
  const transfer = {
    _id: TRANSFER_ID,
    companyId: COMPANY_ID,
    branchId: null,
    financialYearId: FINANCIAL_YEAR_ID,
    transferType: 'BANK_TO_BANK',
    fromAccountId: FROM_ID,
    toAccountId: TO_ID,
    contraAccountId: null,
    amount: 100,
    transferDate: new Date('2026-04-15T00:00:00.000Z'),
    paymentMode: 'NEFT',
    referenceNo: 'OLD-REF',
    narration: 'Original movement',
    journalEntryId: OLD_JOURNAL_ID,
    status,
    toObject: () => ({ ...transfer }),
    save: jest.fn().mockResolvedValue(null)
  };
  return transfer;
};

const makePopulatedResult = () => {
  const result = {
    _id: TRANSFER_ID,
    populate: jest.fn(() => result),
    lean: jest.fn().mockResolvedValue({ _id: TRANSFER_ID })
  };
  return result;
};

describe('account transfer edit and delete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FinancialYear.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: FINANCIAL_YEAR_ID, isLocked: false })
    });
    journalEntryService.createJournalEntry.mockResolvedValue({ _id: NEW_JOURNAL_ID });
    journalEntryService.reverseJournalEntry.mockResolvedValue({
      original: {
        companyId: COMPANY_ID,
        branchId: null,
        financialYearId: FINANCIAL_YEAR_ID,
        entryDate: new Date('2026-04-15T00:00:00.000Z'),
        reference: 'OLD-REF',
        narration: 'Original movement',
        entrySource: 'AUTOMATIC',
        lines: []
      },
      reversal: { _id: REVERSAL_ID }
    });
    auditLogService.recordAuditEvent.mockResolvedValue(undefined);
  });

  test('reposts the journal with edited transfer values and preserves the transfer record', async () => {
    const transfer = makeTransfer();
    AccountTransfer.findOne.mockResolvedValue(transfer);
    AccountTransfer.findById.mockReturnValue(makePopulatedResult());
    BankAccount.findOne
      .mockResolvedValueOnce({ _id: NEW_FROM_ID, accountName: 'New source', accountType: 'Savings', coaAccountId: 'coa-from' })
      .mockResolvedValueOnce({ _id: NEW_TO_ID, accountName: 'New destination', accountType: 'Current', coaAccountId: 'coa-to' });

    await updateTransfer(TRANSFER_ID, COMPANY_ID, {
      fromAccountId: NEW_FROM_ID,
      toAccountId: NEW_TO_ID,
      amount: 250,
      transferDate: '2026-05-01T00:00:00.000Z',
      paymentMode: 'RTGS',
      referenceNo: 'NEW-REF',
      narration: 'Revised movement'
    }, 'user-id');

    expect(journalEntryService.reverseJournalEntry).toHaveBeenCalledWith(OLD_JOURNAL_ID, 'user-id');
    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      companyId: COMPANY_ID,
      reference: 'NEW-REF',
      narration: 'Revised movement',
      lines: expect.arrayContaining([
        expect.objectContaining({ accountId: 'coa-to', debit: 250, credit: 0 }),
        expect.objectContaining({ accountId: 'coa-from', debit: 0, credit: 250 })
      ])
    }), 'user-id');
    expect(transfer.amount).toBe(250);
    expect(transfer.fromAccountId).toBe(NEW_FROM_ID);
    expect(transfer.toAccountId).toBe(NEW_TO_ID);
    expect(transfer.journalEntryId).toBe(NEW_JOURNAL_ID);
    expect(transfer.reversalJournalEntryId).toBe(REVERSAL_ID);
    expect(transfer.save).toHaveBeenCalled();
    expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'ACCOUNT_TRANSFER_UPDATE'
    }));
  });

  test('deletes a completed transfer by reversing and archiving it', async () => {
    const transfer = makeTransfer();
    AccountTransfer.findOne.mockResolvedValue(transfer);
    AccountTransfer.findById.mockReturnValue(makePopulatedResult());

    await deleteTransfer(TRANSFER_ID, COMPANY_ID, 'user-id');

    expect(journalEntryService.reverseJournalEntry).toHaveBeenCalledWith(OLD_JOURNAL_ID, 'user-id');
    expect(transfer.status).toBe('Cancelled');
    expect(transfer.isDeleted).toBe(true);
    expect(transfer.reversalJournalEntryId).toBe(REVERSAL_ID);
    expect(transfer.deletedBy).toBe('user-id');
    expect(transfer.save).toHaveBeenCalled();
    expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'ACCOUNT_TRANSFER_DELETE'
    }));
  });
});
