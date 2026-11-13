jest.mock('../models/Branch', () => ({ findOne: jest.fn() }));

const { checkBranchAccess } = require('../middleware/branchAccess');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const USER_BRANCH_ID = '6ac8a921e6b91ab589aa3002';
const BANK_BRANCH_ID = '6ac8a921e6b91ab589aa3003';
const USER_ID = '6ac8a921e6b91ab589aa3004';

test('rejects a branch-restricted user opening a bank ledger from another branch', async () => {
  const req = {
    originalUrl: '/api/bank-account/account-id/ledger',
    method: 'GET',
    company: { _id: COMPANY_ID },
    bankAccount: { branchId: BANK_BRANCH_ID },
    user: {
      _id: USER_ID,
      role: 'finance',
      companyAccess: [{ isActive: true, companyId: COMPANY_ID, role: 'finance', branchId: USER_BRANCH_ID }],
    },
    query: {},
    headers: {},
    body: {},
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();

  await checkBranchAccess(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    errorCode: 'BRANCH_ACCESS_DENIED',
  }));
  expect(next).not.toHaveBeenCalled();
});
