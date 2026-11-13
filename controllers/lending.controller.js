const service = require('../services/lending.service');

const send = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

const getCompanyId = (req) => (
  req.lending?.companyId ||
  req.company?._id ||
  req.query?.companyId ||
  req.body?.companyId
);

exports.create = send(async (req, res) => {
  const lending = await service.createLending(req.body, req.user._id);
  res.status(201).json({ success: true, data: lending });
});

exports.list = send(async (req, res) => {
  const result = await service.listLendings({
    ...req.query,
    branchId: req.branchId || req.query.branchId,
  });
  res.json({ success: true, data: { companyId: req.query.companyId, ...result } });
});

exports.get = send(async (req, res) => {
  const lending = await service.getLending(req.params.id, getCompanyId(req), req.branchId);
  res.json({ success: true, data: lending });
});

exports.repay = send(async (req, res) => {
  const lending = await service.createRepayment(
    req.params.id,
    { ...req.body, companyId: getCompanyId(req) },
    req.user._id,
    req.branchId,
  );
  res.status(201).json({ success: true, data: lending });
});
