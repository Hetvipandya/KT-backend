jest.mock('../services/loan.service', () => ({
  listLoans: jest.fn(),
}));

const service = require('../services/loan.service');
const controller = require('../controllers/loan.controller');

describe('Loan controller branch scoping', () => {
  test('uses the branch resolved by branch-access middleware when listing loans', async () => {
    const companyId = '6ac8a921e6b91ab589aa3001';
    const branchId = '6ac8a921e6b91ab589aa3002';
    const req = { query: { companyId }, branchId };
    const res = { json: jest.fn() };
    const next = jest.fn();
    service.listLoans.mockResolvedValue({ items: [], pagination: { page: 1, limit: 20, total: 0 } });

    await controller.list(req, res, next);

    expect(service.listLoans).toHaveBeenCalledWith({ companyId, branchId });
    expect(next).not.toHaveBeenCalled();
  });
});
