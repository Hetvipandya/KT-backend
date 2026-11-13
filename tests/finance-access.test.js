const mongoose = require('mongoose');
const {
  READ_ROLES,
  WRITE_ROLES,
  hasFinanceCompanyAccess,
  hasFinanceRole,
  requireFinanceCompanyAccess,
  requireFinanceRole
} = require('../middleware/financeAccess');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const OTHER_COMPANY_ID = '6ac8a921e6b91ab589aa3002';
const USER_ID = '6ac8a921e6b91ab589aa3003';

const invoke = async (middleware, req) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  const next = jest.fn();

  await middleware(req, res, next);
  return { res, next };
};

describe('Finance company-scoped role access', () => {
  test('allows HR report reads but denies Finance write operations', async () => {
    const user = {
      _id: USER_ID,
      companyAccess: [{ companyId: COMPANY_ID, role: 'HR', isActive: true }]
    };
    const req = { user, company: { _id: COMPANY_ID }, query: { companyId: COMPANY_ID } };

    const companyAccess = await invoke(requireFinanceCompanyAccess, req);
    const reportRead = await invoke(requireFinanceRole(READ_ROLES), req);
    const financeWrite = await invoke(requireFinanceRole(WRITE_ROLES), req);

    expect(companyAccess.next).toHaveBeenCalledTimes(1);
    expect(reportRead.next).toHaveBeenCalledTimes(1);
    expect(financeWrite.res.statusCode).toBe(403);
    expect(financeWrite.res.body.errorCode).toBe('FINANCE_ROLE_FORBIDDEN');
  });

  test('does not let an employee read Finance ledgers or reports', async () => {
    const user = {
      _id: USER_ID,
      companyAccess: [{ companyId: COMPANY_ID, role: 'employee', isActive: true }]
    };

    expect(hasFinanceRole(user, COMPANY_ID, READ_ROLES)).toBe(false);
  });

  test('does not let a role assigned to one company access another company', async () => {
    const user = {
      _id: USER_ID,
      role: 'admin',
      companyAccess: [{ companyId: COMPANY_ID, role: 'admin', isActive: true }]
    };
    const req = { user, company: { _id: OTHER_COMPANY_ID }, query: { companyId: OTHER_COMPANY_ID } };
    const access = await invoke(requireFinanceCompanyAccess, req);

    expect(access.res.statusCode).toBe(403);
    expect(access.next).not.toHaveBeenCalled();
    expect(hasFinanceRole(user, OTHER_COMPANY_ID, WRITE_ROLES)).toBe(false);
  });

  test('uses the company-specific role instead of a broader global role', () => {
    const user = {
      _id: USER_ID,
      role: 'admin',
      companyAccess: [{ companyId: COMPANY_ID, role: 'employee', isActive: true }]
    };

    expect(hasFinanceRole(user, COMPANY_ID, WRITE_ROLES)).toBe(false);
  });

  test('allows super admin access across companies', async () => {
    const user = { _id: USER_ID, role: 'Super Admin', companyAccess: [] };
    const req = { user, company: { _id: OTHER_COMPANY_ID } };
    const access = await invoke(requireFinanceCompanyAccess, req);
    const write = await invoke(requireFinanceRole(WRITE_ROLES), req);

    expect(access.next).toHaveBeenCalledTimes(1);
    expect(write.next).toHaveBeenCalledTimes(1);
    expect(hasFinanceCompanyAccess(user, OTHER_COMPANY_ID)).toBe(true);
  });

  test('matches Mongo ObjectId company references in membership and role checks', async () => {
    const companyId = new mongoose.Types.ObjectId();
    const user = {
      _id: new mongoose.Types.ObjectId(),
      companyAccess: [{ companyId, role: 'accountant', isActive: true }]
    };
    const req = { user, company: { _id: companyId } };
    const access = await invoke(requireFinanceCompanyAccess, req);
    const read = await invoke(requireFinanceRole(READ_ROLES), req);
    const write = await invoke(requireFinanceRole(WRITE_ROLES), req);

    expect(access.next).toHaveBeenCalledTimes(1);
    expect(read.next).toHaveBeenCalledTimes(1);
    expect(write.res.statusCode).toBe(403);
  });
});
