const service = require('../services/creditNote.service');

/** Thin async wrapper — passes errors to Express centralized error handler. */
const send = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/credit-note
 * Body fields validated by Zod before reaching here.
 */
exports.create = send(async (req, res) => {
  const data = await service.createCreditNote(req.body, req.user._id);
  res.status(201).json({ success: true, data });
});

/**
 * GET /api/credit-note?companyId=&[branchId=]&[...]
 * Query already parsed and validated by Zod before reaching here.
 */
exports.list = send(async (req, res) => {
  const { companyId, branchId, ...rest } = req.query;
  const result = await service.listCreditNotes({ companyId, branchId, ...rest });
  res.json({
    success: true,
    data: {
      companyId,
      branchId: branchId || null,
      ...result
    }
  });
});
