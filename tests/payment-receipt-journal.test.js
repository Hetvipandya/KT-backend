jest.mock('../models/Payment', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../models/FinancialYear', () => ({
  findById: jest.fn(),
}));
jest.mock('../models/Customer', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/Invoice', () => ({
  find: jest.fn(),
}));
jest.mock('../models/BankAccount', () => ({
  findOne: jest.fn(),
}));
jest.mock('../services/journalEntry.service', () => ({
  createJournalEntry: jest.fn(),
}));
jest.mock('../services/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

const Payment = require('../models/Payment');
const FinancialYear = require('../models/FinancialYear');
const Customer = require('../models/Customer');
const BankAccount = require('../models/BankAccount');
const { createPayment } = require('../services/payment.service');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const BRANCH_ID = '6ac8a921e6b91ab589aa3002';
const YEAR_ID = '6ac8a921e6b91ab589aa3003';
const CUSTOMER_ID = '6ac8a921e6b91ab589aa3004';

describe('Customer receipt journal requirement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FinancialYear.findById.mockResolvedValue({
      companyId: COMPANY_ID,
      isLocked: false,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
    });
    Customer.findOne.mockResolvedValue({ _id: CUSTOMER_ID, isActive: true });
    BankAccount.findOne.mockResolvedValue(null);
  });

  test('rejects a receipt if no compatible active account is available for automatic posting', async () => {
    await expect(createPayment({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      financialYearId: YEAR_ID,
      customerId: CUSTOMER_ID,
      paymentDate: '2026-04-10',
      mode: 'CASH',
      totalAmount: 100,
      allocations: [],
    }, 'user-id')).rejects.toMatchObject({
      errorCode: 'PAYMENT_ACCOUNT_REQUIRED',
      statusCode: 400,
    });

    expect(Payment.create).not.toHaveBeenCalled();
  });
});
