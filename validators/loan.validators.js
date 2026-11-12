const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');
const date = z.string().datetime({ offset: true }).or(z.string().date());
const optionalText = (max) => z.string().trim().max(max).optional().default('');
const nonNegative = z.coerce.number().finite().min(0);
const positive = z.coerce.number().finite().positive();

const createLoanSchema = z.object({
  companyId: objectId,
  branchId: objectId,
  financialYearId: objectId,
  lenderType: z.enum(['PERSON', 'BANK']),
  lenderName: z.string().trim().min(1).max(200),
  lenderPhone: optionalText(30),
  lenderEmail: z.string().trim().email().max(254).optional().or(z.literal('')).default(''),
  lenderBankName: optionalText(200),
  lenderAccountNumber: optionalText(50),
  lenderIfscCode: optionalText(20),
  loanReference: optionalText(100),
  principalAmount: positive,
  annualInterestRatePercent: nonNegative.max(100),
  startDate: date,
  maturityDate: date.nullable().optional(),
  disbursementBankAccountId: objectId,
  notes: optionalText(5000)
}).strict().superRefine((value, ctx) => {
  if (value.lenderType === 'BANK' && !value.lenderBankName.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lenderBankName'], message: 'Bank name is required for a bank lender' });
  }
  if (value.maturityDate && new Date(value.maturityDate) <= new Date(value.startDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maturityDate'], message: 'Maturity date must be after the loan start date' });
  }
});

const createLoanRepaymentSchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  paymentDate: date,
  principalAmount: nonNegative,
  interestAmount: nonNegative,
  bankAccountId: objectId,
  reference: optionalText(200),
  notes: optionalText(2000)
}).strict().superRefine((value, ctx) => {
  if (value.principalAmount + value.interestAmount <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['principalAmount'], message: 'Principal or interest amount must be greater than zero' });
  }
});

const loanQuerySchema = z.object({
  companyId: objectId,
  branchId: objectId.optional(),
  status: z.enum(['ACTIVE', 'PAID_OFF']).optional(),
  lenderType: z.enum(['PERSON', 'BANK']).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
}).strict();

const validateQuery = (schema) => (req, res, next) => {
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

module.exports = { createLoanSchema, createLoanRepaymentSchema, loanQuerySchema, validateQuery };
