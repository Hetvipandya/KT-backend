const service = require('../services/debitNote.service');

/** Thin async wrapper — passes errors to Express centralized error handler. */
const send = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/debit-note
 * Body fields validated by Zod before reaching here.
 */
exports.create = send(async (req, res) => {
  const data = await service.createDebitNote(req.body, req.user._id);
  res.status(201).json({ success: true, data });
});

/**
 * GET /api/debit-note?companyId=&[branchId=]&[...]
 * Query already parsed and validated by Zod before reaching here.
 */
exports.list = send(async (req, res) => {
  const { companyId, branchId, ...rest } = req.query;
  const result = await service.listDebitNotes({ companyId, branchId, ...rest });
  res.json({
    success: true,
    data: {
      companyId,
      branchId: branchId || null,
      ...result
    }
  });
});
