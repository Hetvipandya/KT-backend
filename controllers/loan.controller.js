const service = require('../services/loan.service');

const send = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

exports.create = send(async (req, res) => {
  const loan = await service.createLoan(req.body, req.user._id);
  res.status(201).json({ success: true, data: loan });
});

exports.list = send(async (req, res) => {
  const result = await service.listLoans({
    ...req.query,
    branchId: req.branchId || req.query.branchId
  });
  res.json({ success: true, data: { companyId: req.query.companyId, ...result } });
});

exports.get = send(async (req, res) => {
  const loan = await service.getLoan(req.params.id, req.query.companyId);
  res.json({ success: true, data: loan });
});

exports.repay = send(async (req, res) => {
  const loan = await service.createRepayment(req.params.id, req.body, req.user._id);
  res.status(201).json({ success: true, data: loan });
});
