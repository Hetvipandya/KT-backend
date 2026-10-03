const service = require('../services/employee.service');

const send = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

exports.create = send(async (req, res) => {
  const result = await service.createEmployee(req.body, req.user._id);
  res.status(201).json({ success: true, data: result });
});

exports.list = send(async (req, res) => {
  const { companyId, ...query } = req.query;
  const result = await service.listEmployees(companyId, query);
  res.json({ success: true, data: result });
});

exports.get = send(async (req, res) => {
  // getEmployeeDocument will throw 404 if not found
  const emp = await service.getEmployeeDocument(req.params.id);
  res.json({ success: true, data: service.shape(emp, true) });
});

exports.update = send(async (req, res) => {
  // getEmployeeDocument will throw 404 if not found
  const emp = await service.getEmployeeDocument(req.params.id);
  const result = await service.updateEmployee(emp, req.body);
  res.json({ success: true, data: result });
});
