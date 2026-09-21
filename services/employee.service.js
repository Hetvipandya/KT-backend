const Employee = require('../models/Employee');
const Department = require('../models/Department');
const User = require('../models/User');
const mongoose = require('mongoose');

const fail = (message, statusCode = 400, errorCode) =>
  Object.assign(new Error(message), { statusCode, errorCode });

const id = (val) => val?.toString() || null;

const shape = (emp, detail = false) => ({
  id: id(emp._id),
  companyId: id(emp.companyId),
  employeeCode: emp.employeeCode,
  firstName: emp.firstName,
  middleName: emp.middleName || '',
  lastName: emp.lastName || '',
  fullName: emp.fullName,
  email: emp.email || null,
  phone: emp.phone || null,
  dateOfJoining: emp.dateOfJoining,
  designation: emp.designation || null,
  departmentId: id(emp.departmentId),
  userId: id(emp.userId),
  status: emp.status,
  createdAt: emp.createdAt,
  updatedAt: emp.updatedAt,
  ...(detail ? {
    address: emp.address || {},
    emergencyContact: emp.emergencyContact || {}
  } : {})
});

const createEmployee = async (data, creatorId) => {
  const {
    companyId,
    employeeCode,
    firstName,
    middleName,
    lastName,
    email,
    phone,
    dateOfJoining,
    designation,
    departmentId,
    userId,
    status,
    address,
    emergencyContact
  } = data;

  // 1. Verify unique employeeCode in this company
  const existingCode = await Employee.findOne({
    companyId,
    employeeCode: employeeCode.trim().toUpperCase()
  });
  if (existingCode) {
    throw fail('Employee code already exists for this company', 400, 'DUPLICATE_EMPLOYEE_CODE');
  }

  // 2. Verify unique email in this company if email is provided
  if (email && email.trim() !== '') {
    const existingEmail = await Employee.findOne({
      companyId,
      email: email.trim().toLowerCase()
    });
    if (existingEmail) {
      throw fail('Employee email already exists for this company', 400, 'DUPLICATE_EMPLOYEE_EMAIL');
    }
  }

  // 3. Verify departmentId belongs to the same company if provided
  if (departmentId) {
    const dept = await Department.findOne({ _id: departmentId, companyId });
    if (!dept) {
      throw fail('Department not found or does not belong to this company', 400, 'INVALID_DEPARTMENT');
    }
  }

  // 4. Verify userId exists and has access to the company if provided
  if (userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw fail('Linked user not found', 400, 'INVALID_USER');
    }
    const hasAccess =
      id(user.companyId) === id(companyId) ||
      (user.companyAccess || []).some((a) => id(a.companyId) === id(companyId));
    if (!hasAccess) {
      throw fail('Linked user does not have access to this company', 400, 'INVALID_USER_COMPANY');
    }
  }

  const emp = await Employee.create({
    companyId,
    employeeCode: employeeCode.trim().toUpperCase(),
    firstName: firstName.trim(),
    middleName: middleName ? middleName.trim() : '',
    lastName: lastName ? lastName.trim() : '',
    email: email && email.trim() !== '' ? email.trim().toLowerCase() : null,
    phone: phone ? phone.trim() : null,
    dateOfJoining: new Date(dateOfJoining),
    designation: designation ? designation.trim() : null,
    departmentId: departmentId || null,
    userId: userId || null,
    status: status || 'ACTIVE',
    address: address || {},
    emergencyContact: emergencyContact || {}
  });

  return shape(emp, true);
};

const listEmployees = async (companyId, query = {}) => {
  const filter = { companyId };
  if (query.status) {
    filter.status = query.status;
  }
  if (query.departmentId) {
    filter.departmentId = query.departmentId;
  }

  const page = query.page || 1;
  const limit = query.limit || 20;

  const [items, total] = await Promise.all([
    Employee.find(filter)
      .sort({ firstName: 1, lastName: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Employee.countDocuments(filter)
  ]);

  return {
    items: items.map((item) => shape(item)),
    pagination: { page, limit, total }
  };
};

const getEmployeeDocument = async (empId) => {
  if (!mongoose.isValidObjectId(empId)) {
    throw fail('Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
  }
  const emp = await Employee.findById(empId);
  if (!emp) {
    throw fail('Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
  }
  return emp;
};

const updateEmployee = async (emp, changes) => {
  const companyId = emp.companyId;

  // 1. Verify unique email if email is being updated
  if (changes.email && changes.email.trim().toLowerCase() !== id(emp.email)) {
    const existingEmail = await Employee.findOne({
      companyId,
      email: changes.email.trim().toLowerCase()
    });
    if (existingEmail) {
      throw fail('Employee email already exists for this company', 400, 'DUPLICATE_EMPLOYEE_EMAIL');
    }
  }

  // 2. Verify departmentId if it is being updated
  if (changes.departmentId && id(changes.departmentId) !== id(emp.departmentId)) {
    const dept = await Department.findOne({ _id: changes.departmentId, companyId });
    if (!dept) {
      throw fail('Department not found or does not belong to this company', 400, 'INVALID_DEPARTMENT');
    }
  }

  // 3. Verify userId if it is being updated
  if (changes.userId && id(changes.userId) !== id(emp.userId)) {
    const user = await User.findById(changes.userId);
    if (!user) {
      throw fail('Linked user not found', 400, 'INVALID_USER');
    }
    const hasAccess =
      id(user.companyId) === id(companyId) ||
      (user.companyAccess || []).some((a) => id(a.companyId) === id(companyId));
    if (!hasAccess) {
      throw fail('Linked user does not have access to this company', 400, 'INVALID_USER_COMPANY');
    }
  }

  // Apply changes (preventing manual modification of companyId and employeeCode)
  delete changes.companyId;
  delete changes.employeeCode;

  // Address and EmergencyContact update merging
  if (changes.address) {
    changes.address = { ...(emp.address?.toObject() || {}), ...changes.address };
  }
  if (changes.emergencyContact) {
    changes.emergencyContact = {
      ...(emp.emergencyContact?.toObject() || {}),
      ...changes.emergencyContact
    };
  }

  Object.assign(emp, changes);
  await emp.save();

  return shape(emp, true);
};

module.exports = {
  createEmployee,
  listEmployees,
  getEmployeeDocument,
  updateEmployee,
  shape
};
