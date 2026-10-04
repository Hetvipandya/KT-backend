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
  const trimmedName = (name || '').trim();
  const trimmedCode = code && code.trim() !== '' ? code.trim().toUpperCase() : null;

  if (!trimmedName) {
    throw fail('Department name is required', 400);
  }

  // 1. Check name uniqueness per company (case-insensitive)
  const existingName = await Department.findOne({
    companyId,
    $or: [
      { name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } },
      { departmentName: { $regex: new RegExp(`^${trimmedName}$`, 'i') } }
    ]
  });
  if (existingName) {
    throw fail('Department name already exists for this company', 400, 'DUPLICATE_DEPARTMENT_NAME');
  }

  // 2. Check code uniqueness per company (case-insensitive/uppercase) if code is provided
  if (trimmedCode) {
    const existingCode = await Department.findOne({
      companyId,
      code: trimmedCode
    });
    if (existingCode) {
      throw fail('Department code already exists for this company', 400, 'DUPLICATE_DEPARTMENT_CODE');
    }
  }

  try {
    const dept = await Department.create({
      companyId,
      departmentName: trimmedName,
      name: trimmedName,
      code: trimmedCode,
      description: description ? description.trim() : null
    });

    return shape(dept);
  } catch (error) {
    if (error.code === 11000) {
      throw fail('Department name or code already exists for this company', 400, 'DUPLICATE_DEPARTMENT');
    }
    throw error;
  }
};

const updateDepartment = async (departmentId, data) => {
  const dept = await Department.findById(departmentId);
  if (!dept) {
    throw fail('Department not found', 404);
  }

  const companyId = data.companyId || dept.companyId;

  if (data.name || data.departmentName) {
    const newName = (data.name || data.departmentName).trim();
    const existingName = await Department.findOne({
      companyId,
      _id: { $ne: departmentId },
      $or: [
        { name: { $regex: new RegExp(`^${newName}$`, 'i') } },
        { departmentName: { $regex: new RegExp(`^${newName}$`, 'i') } }
      ]
    });
    if (existingName) {
      throw fail('Department name already exists for this company', 400, 'DUPLICATE_DEPARTMENT_NAME');
    }
    dept.name = newName;
    dept.departmentName = newName;
  }

  if (data.code !== undefined) {
    const newCode = data.code && data.code.trim() !== '' ? data.code.trim().toUpperCase() : null;
    if (newCode) {
      const existingCode = await Department.findOne({
        companyId,
        _id: { $ne: departmentId },
        code: newCode
      });
      if (existingCode) {
        throw fail('Department code already exists for this company', 400, 'DUPLICATE_DEPARTMENT_CODE');
      }
    }
    dept.code = newCode;
  }

  if (data.description !== undefined) {
    dept.description = data.description ? data.description.trim() : null;
  }
  if (data.isActive !== undefined) {
    dept.isActive = data.isActive;
    dept.status = data.isActive;
  }

  try {
    await dept.save();
    return shape(dept);
  } catch (error) {
    if (error.code === 11000) {
      throw fail('Department name or code already exists for this company', 400, 'DUPLICATE_DEPARTMENT');
    }
    throw error;
  }
};

const listDepartments = async (companyId, query = {}) => {
  const filter = {};
  if (companyId) {
    filter.companyId = companyId;
  }
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  const items = await Department.find(filter).sort({ name: 1 }).lean();
  return items.map((d) => shape({ ...d, companyId: d.companyId || companyId || '' }));
};

module.exports = {
  createDepartment,
  updateDepartment,
  listDepartments,
  shape
};
