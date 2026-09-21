const { z } = require('zod');
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

const createDepartmentSchema = z.object({
  companyId: objectId,
  name: z.string().trim().min(1, 'Department name is required'),
  code: z.string().trim().min(1).optional().nullable(),
  description: z.string().trim().optional().nullable()
}).strict();

const deptQuerySchema = z.object({
  companyId: objectId,
  isActive: z.preprocess((val) => val === 'true' ? true : val === 'false' ? false : undefined, z.boolean().optional()).optional()
}).strict();

const queryValidator = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errorCode: 'INVALID_QUERY',
      errors: parsed.error.errors
    });
  }
  req.query = parsed.data;
  next();
};

module.exports = {
  createDepartmentSchema,
  deptQuerySchema,
  validateQuery: queryValidator
};
