const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const ChartOfAccount = require('../models/ChartOfAccount');
const FinancialYear = require('../models/FinancialYear');
const JournalEntry = require('../models/JournalEntry');
require('../models/BankAccount');
require('../models/Expense');
require('../models/Payment');
require('../models/SupplierPayment');
require('../models/Salary');
const journalService = require('../services/journalEntry.service');
const ledgerService = require('../services/ledger.service');

jest.setTimeout(60000);

let mongo;
let companyId;
let yearId;
let userId;
let expenseAccount;
let bankAccount;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    ChartOfAccount.deleteMany({}),
    FinancialYear.deleteMany({}),
    JournalEntry.deleteMany({})
  ]);
  companyId = new mongoose.Types.ObjectId();
  userId = new mongoose.Types.ObjectId();
  const year = await FinancialYear.create({
    companyId,
    startDate: new Date('2026-04-01T00:00:00.000Z'),
    endDate: new Date('2027-03-31T23:59:59.999Z'),
    yearLabel: '2026-27'
  });
  yearId = year._id;
  [expenseAccount, bankAccount] = await ChartOfAccount.create([
    { companyId, name: 'Test Expense', code: '5101', type: 'Expense', isGroup: false },
    { companyId, name: 'Test Bank', code: '1101', type: 'Asset', isGroup: false }
  ]);
});

const createBalancedJournal = () => journalService.createJournalEntry({
  companyId,
  financialYearId: yearId,
  entryDate: new Date('2026-04-10T00:00:00.000Z'),
  reference: 'TEST-JE-001',
  narration: 'Disposable accounting integration test',
  lines: [
    { accountId: expenseAccount._id, debit: 1250, credit: 0 },
    { accountId: bankAccount._id, debit: 0, credit: 1250 }
  ]
}, userId);

describe('Journal posting and reversal accounting', () => {
  test('rejects unbalanced entries without persisting a journal', async () => {
    await expect(journalService.createJournalEntry({
      companyId,
      financialYearId: yearId,
      entryDate: new Date('2026-04-10T00:00:00.000Z'),
      lines: [
        { accountId: expenseAccount._id, debit: 1250, credit: 0 },
        { accountId: bankAccount._id, debit: 0, credit: 1200 }
      ]
    }, userId)).rejects.toMatchObject({ errorCode: 'UNBALANCED_JOURNAL_ENTRY' });

    await expect(JournalEntry.countDocuments()).resolves.toBe(0);
  });

  test('posts balanced lines to the ledger and retains history on reversal', async () => {
    const journal = await createBalancedJournal();
    expect(journal.totalDebit).toBe(1250);
    expect(journal.totalCredit).toBe(1250);

    const before = await ledgerService.getLedgerHistory(expenseAccount._id, {
      companyId: companyId.toString()
    });
    expect(before.closingBalance).toBe(1250);

    const { original, reversal } = await journalService.reverseJournalEntry(journal._id, userId);
    expect(original.isReversed).toBe(true);
    expect(reversal.lines[0].debit).toBe(0);
    expect(reversal.lines[0].credit).toBe(1250);
    expect(await JournalEntry.countDocuments()).toBe(2);

    const after = await ledgerService.getLedgerHistory(expenseAccount._id, {
      companyId: companyId.toString()
    });
    expect(after.closingBalance).toBe(0);
    expect(after.entries).toHaveLength(2);
  });

  test('allows at most one reversal when requests race', async () => {
    const journal = await createBalancedJournal();
    const attempts = await Promise.allSettled([
      journalService.reverseJournalEntry(journal._id, userId),
      journalService.reverseJournalEntry(journal._id, userId)
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(await JournalEntry.countDocuments({ reversedFrom: journal._id })).toBe(1);
    expect(await JournalEntry.countDocuments()).toBe(2);
  });
});
