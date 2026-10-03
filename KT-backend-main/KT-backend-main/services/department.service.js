const Department = require('../models/Department');

const fail = (message, statusCode = 400, errorCode) =>
  Object.assign(new Error(message), { statusCode, errorCode });

const shape = (d) => ({
  id: d._id.toString(),
  companyId: d.companyId.toString(),
  name: d.name,
  code: d.code || null,
  description: d.description || null,
  isActive: d.isActive,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt
});

const createDepartment = async (data) => {
  const { companyId, name, code, description } = data;

  // 1. Check name uniqueness per company (case-insensitive)
  const existingName = await Department.findOne({
    companyId,
    name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
  });
  if (existingName) {
    throw fail('Department name already exists for this company', 400, 'DUPLICATE_DEPARTMENT_NAME');
  }

  // 2. Check code uniqueness per company (case-insensitive/uppercase) if code is provided
  if (code && code.trim() !== '') {
    const existingCode = await Department.findOne({
      companyId,
      code: code.trim().toUpperCase()
    });
    if (existingCode) {
      throw fail('Department code already exists for this company', 400, 'DUPLICATE_DEPARTMENT_CODE');
    }
  }

  const dept = await Department.create({
    companyId,
    name: name.trim(),
    code: code && code.trim() !== '' ? code.trim().toUpperCase() : null,
    description: description ? description.trim() : null
  });

  return shape(dept);
};

const listDepartments = async (companyId, query = {}) => {
  const filter = { companyId };
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  const items = await Department.find(filter).sort({ name: 1 }).lean();
  return items.map(shape);
};

module.exports = {
  createDepartment,
  listDepartments,
  shape
};
