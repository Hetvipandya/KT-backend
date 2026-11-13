const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');
const date = z.string().datetime({ offset: true }).or(z.string().date());
const optionalText = (max) => z.string().trim().max(max).optional().default('');
const nonNegative = z.coerce.number().finite().min(0);
const positive = z.coerce.number().finite().positive();

const createLendingSchema = z.object({
  companyId: objectId,
  branchId: objectId,
  financialYearId: objectId,
  customerId: objectId,
  loanReference: optionalText(100),
  principalAmount: positive,
  annualInterestRatePercent: nonNegative.max(100),
  startDate: date,
  maturityDate: date.nullable().optional(),
  disbursementBankAccountId: objectId,
  notes: optionalText(5000),
}).strict().superRefine((value, ctx) => {
  if (value.maturityDate && new Date(value.maturityDate) <= new Date(value.startDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maturityDate'], message: 'Maturity date must be after the loan start date' });
  }
});

const createLendingRepaymentSchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  paymentDate: date,
  principalAmount: nonNegative,
  interestAmount: nonNegative,
  bankAccountId: objectId,
  reference: optionalText(200),
  notes: optionalText(2000),
}).strict().superRefine((value, ctx) => {
  if (value.principalAmount + value.interestAmount <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['principalAmount'], message: 'Principal or interest amount must be greater than zero' });
  }
});

const lendingQuerySchema = z.object({
  companyId: objectId,
  branchId: objectId.optional(),
  status: z.enum(['ACTIVE', 'PAID_OFF']).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
}).strict();

const validateQuery = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errorCode: 'INVALID_QUERY',
      errors: parsed.error.errors,
    });
  }
  req.query = parsed.data;
  next();
};

module.exports = { createLendingSchema, createLendingRepaymentSchema, lendingQuerySchema, validateQuery };
