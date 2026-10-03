const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const paymentModeEnum = z.enum(['IMPS', 'NEFT', 'RTGS', 'UPI', 'Cheque', 'Cash', 'Other']);

const transferSchema = z.object({
  companyId: z.string({ required_error: 'Company ID is required' })
    .regex(objectIdRegex, 'Invalid Company ID format'),
  branchId: z.string().regex(objectIdRegex, 'Invalid branchId format').nullable().optional(),
  fromAccountId: z.string({ required_error: 'From Account ID is required' })
    .regex(objectIdRegex, 'Invalid From Account ID format'),
  toAccountId: z.string({ required_error: 'To Account ID is required' })
    .regex(objectIdRegex, 'Invalid To Account ID format'),
  amount: z.number({ required_error: 'Amount is required' })
    .positive('Amount must be greater than 0'),
  transferDate: z.string().datetime().or(z.date()).optional().or(z.literal('')),
  paymentMode: paymentModeEnum.optional(),
  referenceNo: z.string().trim().optional(),
  narration: z.string().trim().optional()
}).strict().superRefine((data, ctx) => {
  if (data.fromAccountId === data.toAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['toAccountId'],
      message: 'Source and destination accounts must be different'
    });
  }
});

const fundPlusSchema = z.object({
  companyId: z.string({ required_error: 'Company ID is required' })
    .regex(objectIdRegex, 'Invalid Company ID format'),
  branchId: z.string().regex(objectIdRegex, 'Invalid branchId format').nullable().optional(),
  toAccountId: z.string({ required_error: 'Target Bank/Cash Account ID (toAccountId) is required' })
    .regex(objectIdRegex, 'Invalid To Account ID format'),
  contraAccountId: z.string({ required_error: 'Source Ledger Account ID (contraAccountId) is required' })
    .regex(objectIdRegex, 'Invalid Contra Account ID format'),
  amount: z.number({ required_error: 'Amount is required' })
    .positive('Amount must be greater than 0'),
  transferDate: z.string().datetime().or(z.date()).optional().or(z.literal('')),
  paymentMode: paymentModeEnum.optional(),
  referenceNo: z.string().trim().optional(),
  narration: z.string().trim().optional()
}).strict();

const fundMinusSchema = z.object({
  companyId: z.string({ required_error: 'Company ID is required' })
    .regex(objectIdRegex, 'Invalid Company ID format'),
  branchId: z.string().regex(objectIdRegex, 'Invalid branchId format').nullable().optional(),
  fromAccountId: z.string({ required_error: 'Source Bank/Cash Account ID (fromAccountId) is required' })
    .regex(objectIdRegex, 'Invalid From Account ID format'),
  contraAccountId: z.string({ required_error: 'Destination Ledger Account ID (contraAccountId) is required' })
    .regex(objectIdRegex, 'Invalid Contra Account ID format'),
  amount: z.number({ required_error: 'Amount is required' })
    .positive('Amount must be greater than 0'),
  transferDate: z.string().datetime().or(z.date()).optional().or(z.literal('')),
  paymentMode: paymentModeEnum.optional(),
  referenceNo: z.string().trim().optional(),
  narration: z.string().trim().optional()
}).strict();

module.exports = {
  transferSchema,
  fundPlusSchema,
  fundMinusSchema
};
