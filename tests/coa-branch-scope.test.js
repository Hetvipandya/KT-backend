const ChartOfAccount = require('../models/ChartOfAccount');
const { createAccount } = require('../controllers/coa.controller');

const invokeCreate = async ({ user, branchId, requestedBranchId }) => {
  const savedAccount = { _id: 'created-account' };
  jest.spyOn(ChartOfAccount, 'findOne').mockResolvedValue(null);
  const createSpy = jest.spyOn(ChartOfAccount, 'create').mockResolvedValue(savedAccount);
  const req = {
    body: {
      companyId: 'company-id',
      name: 'Test account',
      type: 'Asset',
      isGroup: false,
      code: '1501',
      branchId: requestedBranchId,
    },
    user,
    branchId,
    company: { _id: 'company-id' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();

  await createAccount(req, res, next);

  return { createSpy, res, next };
};

describe('COA account branch scope', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows an admin to create a company-shared account when branchId is explicitly null', async () => {
    const { createSpy, res, next } = await invokeCreate({
      user: { _id: 'admin-id', role: 'admin', branchId: 'assigned-branch' },
      branchId: 'assigned-branch',
      requestedBranchId: null,
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ branchId: null }));
  });

  it('keeps an assigned user on their branch when a shared scope is requested', async () => {
    const { createSpy, res, next } = await invokeCreate({
      user: { _id: 'member-id', role: 'employee', branchId: 'assigned-branch' },
      branchId: 'assigned-branch',
      requestedBranchId: null,
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'assigned-branch' }));
  });
});
