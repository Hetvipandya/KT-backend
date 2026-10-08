const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const booleanCoerce = z.union([
  z.boolean(),
  z.string().transform((val) => val === 'true' || val === '1'),
  z.number().transform((val) => val === 1),
]);

const inviteUserSchema = z.object({
  companyId: z
    .string({ required_error: 'companyId is required' })
    .regex(objectIdRegex, 'Invalid companyId format'),
  branchId: z
    .string()
    .regex(objectIdRegex, 'Invalid branchId format')
    .nullable()
    .optional(),
  allBranches: booleanCoerce.optional(),
  allBranch: booleanCoerce.optional(),
  name: z
    .string({ required_error: 'name is required' })
    .trim()
    .min(1, 'name cannot be empty'),
  email: z
    .string({ required_error: 'email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email format'),
  phone: z.string().trim().optional().or(z.literal('')),
  phoneNumber: z.string().trim().optional().or(z.literal('')),
  role: z
    .string({ required_error: 'role is required' })
    .trim()
    .min(1, 'role cannot be empty'),
  sendTemporaryPassword: booleanCoerce.optional().default(false)
}).passthrough();

const updateUserSchema = z.object({
  companyId: z
    .string({ required_error: 'companyId is required' })
    .regex(objectIdRegex, 'Invalid companyId format'),
  branchId: z
    .string()
    .regex(objectIdRegex, 'Invalid branchId format')
    .nullable()
    .optional(),
  allBranches: booleanCoerce.optional(),
  allBranch: booleanCoerce.optional(),
  role: z.string().trim().min(1).optional(),
  isActive: booleanCoerce.optional(),
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional().or(z.literal('')),
  phoneNumber: z.string().trim().optional().or(z.literal(''))
}).passthrough();

module.exports = {
  inviteUserSchema,
  updateUserSchema
};
