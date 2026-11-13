jest.mock('../services/lending.service', () => ({
  listLendings: jest.fn(),
  getLending: jest.fn(),
  createRepayment: jest.fn(),
}));

const service = require('../services/lending.service');
const controller = require('../controllers/lending.controller');
const { lendingQuerySchema } = require('../validators/lending.validators');

const LENDING_ID = '6af6bf3eef791ee7fde2eb28';
const COMPANY_ID = '6af31bf7735c5f69c36ac566';
const OTHER_COMPANY_ID = '6af31bf7735c5f69c36ac567';
const BRANCH_ID = '6af31bf7735c5f69c36ac568';

describe('Lending controller resource scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('accepts all branches and specific branch IDs in the lending query', () => {
    const baseQuery = { companyId: COMPANY_ID, page: 1, limit: 20 };

    expect(lendingQuerySchema.safeParse({ ...baseQuery, branchId: 'all' }).success).toBe(true);
    expect(lendingQuerySchema.safeParse({ ...baseQuery, branchId: BRANCH_ID }).success).toBe(true);
  });

  test('loads details using the company resolved from the lending record', async () => {
    const req = {
      params: { id: LENDING_ID },
      query: { companyId: OTHER_COMPANY_ID },
      lending: { companyId: COMPANY_ID },
      branchId: BRANCH_ID,
    };
    const res = { json: jest.fn() };
    const next = jest.fn();
    service.getLending.mockResolvedValue({ id: LENDING_ID });

    await controller.get(req, res, next);

    expect(service.getLending).toHaveBeenCalledWith(LENDING_ID, COMPANY_ID, BRANCH_ID);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: LENDING_ID } });
    expect(next).not.toHaveBeenCalled();
  });

  test('lists all branches when the all-branches option is selected', async () => {
    const req = {
      query: { companyId: COMPANY_ID, branchId: 'all', page: 1, limit: 20 },
      branchId: null,
    };
    const res = { json: jest.fn() };
    const next = jest.fn();
    service.listLendings.mockResolvedValue({ items: [], pagination: {}, summary: {} });

    await controller.list(req, res, next);

    expect(service.listLendings).toHaveBeenCalledWith(expect.objectContaining({
      companyId: COMPANY_ID,
      branchId: undefined,
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('keeps the selected branch filter when a branch is requested', async () => {
    const req = {
      query: { companyId: COMPANY_ID, branchId: BRANCH_ID, page: 1, limit: 20 },
      branchId: BRANCH_ID,
    };
    const res = { json: jest.fn() };
    const next = jest.fn();
    service.listLendings.mockResolvedValue({ items: [], pagination: {}, summary: {} });

    await controller.list(req, res, next);

    expect(service.listLendings).toHaveBeenCalledWith(expect.objectContaining({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('uses the validated company context when middleware did not attach the lending record', async () => {
    const req = {
      params: { id: LENDING_ID },
      query: { companyId: OTHER_COMPANY_ID },
      company: { _id: COMPANY_ID },
      branchId: BRANCH_ID,
    };
    const res = { json: jest.fn() };
    const next = jest.fn();
    service.getLending.mockResolvedValue({ id: LENDING_ID });

    await controller.get(req, res, next);

    expect(service.getLending).toHaveBeenCalledWith(LENDING_ID, COMPANY_ID, BRANCH_ID);
    expect(next).not.toHaveBeenCalled();
  });

  test('records repayments against the company resolved from the lending record', async () => {
    const body = { companyId: OTHER_COMPANY_ID, financialYearId: 'year-id' };
    const req = {
      params: { id: LENDING_ID },
      body,
      lending: { companyId: COMPANY_ID },
      branchId: BRANCH_ID,
      user: { _id: 'user-id' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();
    service.createRepayment.mockResolvedValue({ id: LENDING_ID });

    await controller.repay(req, res, next);

    expect(service.createRepayment).toHaveBeenCalledWith(
      LENDING_ID,
      { ...body, companyId: COMPANY_ID },
      'user-id',
      BRANCH_ID,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });
});
