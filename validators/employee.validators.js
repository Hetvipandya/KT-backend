const { z } = require('zod');
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');
const dateSchema = z.string().date().or(z.string().datetime());

const addressSchema = z.object({
  line1: z.string().trim().optional(),
  line2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  country: z.string().trim().optional().default('India')
}).strict();

const emergencyContactSchema = z.object({
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  relation: z.string().trim().optional()
}).strict();

const createEmployeeSchema = z.object({
  companyId: objectId,
  employeeCode: z.string().trim().min(1, 'Employee code is required'),
  firstName: z.string().trim().min(1, 'First name is required'),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  dateOfJoining: dateSchema,
  designation: z.string().trim().optional().nullable(),
  departmentId: objectId.optional().nullable(),
  userId: objectId.optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional().default('ACTIVE'),
  address: addressSchema.optional(),
  emergencyContact: emergencyContactSchema.optional()
}).strict();

const updateEmployeeSchema = createEmployeeSchema.omit({ companyId: true, employeeCode: true }).partial().strict();

const employeeQuerySchema = z.object({
  companyId: objectId,
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(),
  departmentId: objectId.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
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
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
  validateQuery: queryValidator
};
