const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const optionalText = z.string().trim().optional().or(z.literal(''));

const levelSchema = z.object({
  level: z.number().int().positive('Level must be a positive integer'),
  roleId: objectId.optional().or(z.null()),
  userIds: z.array(objectId).optional().default([])
}).strict().superRefine((val, ctx) => {
  const hasRole = val.roleId && val.roleId.trim() !== '';
  const hasUsers = val.userIds && val.userIds.length > 0;
  if (!hasRole && !hasUsers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Each level must specify either roleId or at least one userId'
    });
  }
});

const createOrUpdateConfigSchema = z.object({
  companyId: objectId,
  module: z.string().trim().min(1, 'Module name cannot be empty'),
  thresholdAmount: z.number().nonnegative('Threshold amount cannot be negative'),
  levels: z.array(levelSchema).min(1, 'At least one approval level is required'),
  escalationEnabled: z.boolean().optional().default(false),
  escalationAfterHours: z.number().int().positive().nullable().optional(),
  escalationRoleId: objectId.nullable().optional()
}).strict().superRefine((val, ctx) => {
  // Validate unique level numbers
  const levelNums = val.levels.map(l => l.level);
  const duplicates = levelNums.filter((item, index) => levelNums.indexOf(item) !== index);
  if (duplicates.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['levels'],
      message: `Duplicate levels are not allowed: ${[...new Set(duplicates)].join(', ')}`
    });
  }
});

const approveOrRejectSchema = z.object({
  reason: optionalText
}).strict();

module.exports = {
  createOrUpdateConfigSchema,
  approveOrRejectSchema
};
