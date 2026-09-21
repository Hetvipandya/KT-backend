const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');
const amount   = z.coerce.number().finite().min(0);
const isoDate  = z.string().datetime({ offset: true }).or(z.string().date());

// ─── Credit Note ────────────────────────────────────────────────────────────

const cnLineItemSchema = z.object({
  productId:   objectId.nullable().optional(),
  description: z.string().trim().min(1).max(500),
  quantity:    z.coerce.number().finite().positive(),
  rate:        amount,
  amount:      amount,
  taxRateId:   objectId.nullable().optional(),
  taxAmount:   amount.optional().default(0),
  totalAmount: amount
}).strict();

const createCreditNoteSchema = z.object({
  companyId:         objectId,
  branchId:          objectId,
  financialYearId:   objectId,
  customerId:        objectId,
  originalInvoiceId: objectId.nullable().optional(),
  date:              isoDate,
  reason:            z.enum(['SALES_RETURN', 'DISCOUNT', 'PRICE_DIFFERENCE', 'OTHER']),
  reference:         z.string().trim().max(200).optional().default(''),
  lineItems:         z.array(cnLineItemSchema).min(1),
  subTotal:          amount,
  taxAmount:         amount,
  totalAmount:       amount
}).strict();

const creditNoteQuerySchema = z.object({
  companyId:       objectId,
  branchId:        objectId.optional(),
  financialYearId: objectId.optional(),
  customerId:      objectId.optional(),
  status:          z.enum(['POSTED', 'CANCELLED']).optional(),
  from:            isoDate.optional(),
  to:              isoDate.optional(),
  page:            z.coerce.number().int().positive().optional().default(1),
  limit:           z.coerce.number().int().positive().max(100).optional().default(20)
}).strict();

// ─── Debit Note ─────────────────────────────────────────────────────────────

const dnLineItemSchema = z.object({
  productId:   objectId.nullable().optional(),
  description: z.string().trim().min(1).max(500),
  quantity:    z.coerce.number().finite().positive(),
  rate:        amount,
  amount:      amount,
  taxRateId:   objectId.nullable().optional(),
  taxAmount:   amount.optional().default(0),
  totalAmount: amount
}).strict();

const createDebitNoteSchema = z.object({
  companyId:          objectId,
  branchId:           objectId,
  financialYearId:    objectId,
  supplierId:         objectId,
  originalPurchaseId: objectId.nullable().optional(),
  date:               isoDate,
  reason:             z.enum(['PURCHASE_RETURN', 'RATE_DIFFERENCE', 'DISCOUNT', 'OTHER']),
  reference:          z.string().trim().max(200).optional().default(''),
  lineItems:          z.array(dnLineItemSchema).min(1),
  subTotal:           amount,
  taxAmount:          amount,
  totalAmount:        amount
}).strict();

const debitNoteQuerySchema = z.object({
  companyId:       objectId,
  branchId:        objectId.optional(),
  financialYearId: objectId.optional(),
  supplierId:      objectId.optional(),
  status:          z.enum(['POSTED', 'CANCELLED']).optional(),
  from:            isoDate.optional(),
  to:              isoDate.optional(),
  page:            z.coerce.number().int().positive().optional().default(1),
  limit:           z.coerce.number().int().positive().max(100).optional().default(20)
}).strict();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Validate request body using a Zod schema.
 * Returns a 400 with structured errors on failure.
 */
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }
  req.body = result.data;
  next();
};

/**
 * Validate query params using a Zod schema.
 * Returns a 400 with structured errors on failure.
 */
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
    return res.status(400).json({ success: false, message: 'Validation failed', errorCode: 'INVALID_QUERY', errors });
  }
  req.query = result.data;
  next();
};

module.exports = {
  createCreditNoteSchema,
  creditNoteQuerySchema,
  createDebitNoteSchema,
  debitNoteQuerySchema,
  validateBody,
  validateQuery
};
