const service = require('../services/department.service');

const send = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

exports.create = send(async (req, res) => {
  const result = await service.createDepartment(req.body);
  res.status(201).json({ success: true, data: result });
});

exports.list = send(async (req, res) => {
  const { companyId, ...query } = req.query;
  const result = await service.listDepartments(companyId, query);
  res.json({ success: true, data: result });
});
