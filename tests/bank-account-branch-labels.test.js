jest.mock('../models/BankAccount', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn()
}));
jest.mock('../models/BankReconciliation', () => ({}));
jest.mock('../models/ChartOfAccount', () => ({
  find: jest.fn(),
  findById: jest.fn()
}));
jest.mock('../services/bankAccount.service', () => ({
  getAccountBalance: jest.fn(),
  maskAccountNumber: jest.fn((accountNumber) => accountNumber),
  createLinkedCoaAccount: jest.fn()
}));

const BankAccount = require('../models/BankAccount');
const ChartOfAccount = require('../models/ChartOfAccount');
const bankAccountService = require('../services/bankAccount.service');
const { createBankAccount, listBankAccounts } = require('../controllers/bankAccount.controller');

describe('bank account branch labels', () => {
  beforeEach(() => {
    BankAccount.findOne.mockResolvedValue(null);
    BankAccount.create.mockImplementation(async (data) => ({
      ...data,
      toObject: () => data
    }));
    bankAccountService.createLinkedCoaAccount.mockResolvedValue('coa-id');
    ChartOfAccount.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'coa-id', name: 'Operating Account', code: '1221' })
      })
    });
  });

  test('returns separate bank-branch and company-branch names', async () => {
    const account = {
      _id: 'account-id',
      companyId: 'company-id',
      branchId: { _id: 'company-branch-id', branchName: 'Head Office' },
      branchName: 'Central Bank Branch',
      accountNumber: '••••1234',
      accountName: 'Operating Account',
      accountType: 'Current',
      coaAccountId: 'coa-id',
      openingBalance: 500,
      isActive: true
    };
    BankAccount.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([account])
    });
    ChartOfAccount.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: 'coa-id', name: 'Operating Account', code: '1221' }])
      })
    });
    bankAccountService.getAccountBalance.mockResolvedValue(700);

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await listBankAccounts({ query: { companyId: 'company-id' } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data[0]).toEqual(expect.objectContaining({
      branchName: 'Head Office',
      companyBranchName: 'Head Office',
      bankBranchName: 'Central Bank Branch'
    }));
  });

  test('allows an admin to create an account shared across branches', async () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await createBankAccount({
      body: {
        companyId: 'company-id',
        branchId: null,
        accountType: 'Cash',
        accountName: 'Shared cash drawer',
        openingBalance: 0
      },
      branchId: 'assigned-branch',
      company: { _id: 'company-id', createdBy: 'owner-id' },
      user: { _id: 'admin-id', role: 'admin', branchId: 'assigned-branch' }
    }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(BankAccount.create).toHaveBeenCalledWith(expect.objectContaining({ branchId: null }));
  });

  test('keeps a null branch request scoped for a branch-assigned non-admin', async () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await createBankAccount({
      body: {
        companyId: 'company-id',
        branchId: null,
        accountType: 'Cash',
        accountName: 'Branch cash drawer',
        openingBalance: 0
      },
      branchId: 'assigned-branch',
      company: { _id: 'company-id', createdBy: 'owner-id' },
      user: {
        _id: 'employee-id',
        role: 'employee',
        branchId: 'assigned-branch',
        companyAccess: [{
          isActive: true,
          companyId: 'company-id',
          branchId: 'assigned-branch',
          role: 'employee'
        }]
      }
    }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(BankAccount.create).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'assigned-branch' }));
  });
});
