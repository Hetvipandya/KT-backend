const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const optionalText = z.string().trim().optional().or(z.literal(''));
const isoDateQuery = z.string().datetime({ offset: true }).or(z.string().date());

const listAuditLogsSchema = z.object({
  companyId: objectId,
  branchId: objectId.optional(),
  userId: objectId.optional(),
  module: optionalText,
  actionType: optionalText,
  from: isoDateQuery.optional().or(z.literal('')),
  to: isoDateQuery.optional().or(z.literal('')),
  page: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional(),
  limit: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional()
}).strict();

const validateQuery = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errorCode: 'INVALID_QUERY',
      errors: parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message }))
    });
  }
  req.query = parsed.data;
  next();
};

module.exports = {
  listAuditLogsSchema,
  validateQuery
};
