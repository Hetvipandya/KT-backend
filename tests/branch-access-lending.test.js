jest.mock('../models/Branch', () => ({ findOne: jest.fn() }));

const Branch = require('../models/Branch');
const { checkBranchAccess } = require('../middleware/branchAccess');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const USER_BRANCH_ID = '6ac8a921e6b91ab589aa3002';
const LENDING_BRANCH_ID = '6ac8a921e6b91ab589aa3003';
const USER_ID = '6ac8a921e6b91ab589aa3004';

const createRequest = (role, branchId) => ({
  originalUrl: '/api/lending/lending-id/repayments',
  method: 'POST',
  company: { _id: COMPANY_ID },
  lending: { branchId: LENDING_BRANCH_ID },
  user: {
    _id: USER_ID,
    role,
    companyAccess: [{ isActive: true, companyId: COMPANY_ID, role, branchId: USER_BRANCH_ID }],
  },
  query: {},
  headers: {},
  body: {},
});

describe('Lending branch access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses the lending record branch when an admin records a repayment', async () => {
    Branch.findOne.mockResolvedValue({ _id: LENDING_BRANCH_ID });
    const req = createRequest('admin', USER_BRANCH_ID);
    const next = jest.fn();

    await checkBranchAccess(req, { status: jest.fn(), json: jest.fn() }, next);

    expect(Branch.findOne).toHaveBeenCalledWith({
      _id: LENDING_BRANCH_ID,
      companyId: COMPANY_ID,
    });
    expect(req.branchId).toBe(LENDING_BRANCH_ID);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rejects a branch-restricted user when the lending record belongs to another branch', async () => {
    const req = createRequest('finance', USER_BRANCH_ID);
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
});
