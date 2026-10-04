const mongoose = require('mongoose');
const Department = require('../models/Department');
const { createDepartment, updateDepartment } = require('../services/department.service');

describe('Finance Department Company-Level Uniqueness Tests', () => {
  const company1 = new mongoose.Types.ObjectId();
  const company2 = new mongoose.Types.ObjectId();

  beforeEach(async () => {
    jest.restoreAllMocks();
  });

  it('allows creating department with unique name and code in Company 1', async () => {
    jest.spyOn(Department, 'findOne').mockResolvedValue(null);
    jest.spyOn(Department, 'create').mockImplementation(async (payload) => ({
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const res = await createDepartment({
      companyId: company1.toString(),
      name: 'Finance',
      code: 'FIN01',
      description: 'Finance department',
    });

    expect(res.name).toBe('Finance');
    expect(res.code).toBe('FIN01');
    expect(res.companyId).toBe(company1.toString());
  });

  it('blocks duplicate department name within the same company', async () => {
    jest.spyOn(Department, 'findOne').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      companyId: company1,
      name: 'Finance',
    });

    await expect(
      createDepartment({
        companyId: company1.toString(),
        name: 'FINANCE', // case insensitive check
        code: 'FIN02',
      })
    ).rejects.toThrow('Department name already exists for this company');
  });

  it('blocks duplicate department code within the same company', async () => {
    // First query for name returns null, second query for code returns existing dept
    jest.spyOn(Department, 'findOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        companyId: company1,
        code: 'FIN01',
      });

    await expect(
      createDepartment({
        companyId: company1.toString(),
        name: 'Accounts',
        code: 'fin01', // case insensitive code check
      })
    ).rejects.toThrow('Department code already exists for this company');
  });

  it('allows the same department name and code in a DIFFERENT company', async () => {
    // Querying for Company 2 returns null (no conflict in Company 2)
    jest.spyOn(Department, 'findOne').mockResolvedValue(null);
    jest.spyOn(Department, 'create').mockImplementation(async (payload) => ({
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const resCompany2 = await createDepartment({
      companyId: company2.toString(),
      name: 'Finance',
      code: 'FIN01',
    });

    expect(resCompany2.name).toBe('Finance');
    expect(resCompany2.code).toBe('FIN01');
    expect(resCompany2.companyId).toBe(company2.toString());
  });

  it('blocks updating a department to a duplicate name or code in the same company', async () => {
    const deptId = new mongoose.Types.ObjectId();
    const mockDept = {
      _id: deptId,
      companyId: company1,
      name: 'Taxation',
      code: 'TAX01',
      save: jest.fn(),
    };

    jest.spyOn(Department, 'findById').mockResolvedValue(mockDept);
    jest.spyOn(Department, 'findOne').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      companyId: company1,
      name: 'Audit',
    });

    await expect(
      updateDepartment(deptId.toString(), {
        name: 'Audit',
      })
    ).rejects.toThrow('Department name already exists for this company');
  });
});
