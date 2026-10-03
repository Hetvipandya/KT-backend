const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const optionalText = z.string().trim().optional().or(z.literal(''));

const uomEnum = z.enum([
  'BAG', 'BOX', 'BTL', 'CAN', 'CBM', 'CFT', 'CMS', 'DRM', 'DOZ',
  'GMS', 'GRS', 'KGS', 'KLR', 'KME', 'LTR', 'MTR', 'MTS', 'MLT',
  'NOS', 'PAC', 'PCS', 'PRS', 'QTL', 'ROL', 'SET', 'SQF', 'SQM',
  'SQY', 'TBS', 'TON', 'TUB', 'UNT', 'YDS', 'HRS', 'OTH'
]).optional().or(z.literal(''));

const createProductSchema = z.object({
  companyId: objectId,
  branchId: objectId.optional().nullable().or(z.literal('')),
  name: z.string().trim().min(1, 'Product name cannot be empty'),
  code: optionalText,
  description: optionalText,
  type: z.enum(['PRODUCT', 'SERVICE']).optional(),
  saleRate: z.number().nonnegative('Sale rate cannot be negative').optional(),
  purchaseRate: z.number().nonnegative('Purchase rate cannot be negative').optional(),
  taxRateId: objectId.nullable().optional(),
  gstRate: z.number().nonnegative('GST rate cannot be negative').optional(),
  hsnSacCode: optionalText,
  isStockItem: z.boolean().optional(),
  unitOfMeasure: uomEnum,
  isActive: z.boolean().optional()
}).passthrough();

const updateProductSchema = z.object({
  companyId: z.any().optional(), // allow but reject in controller
  branchId: objectId.optional().nullable().or(z.literal('')),
  name: z.string().trim().min(1, 'Product name cannot be empty').optional(),
  code: optionalText,
  description: optionalText,
  type: z.enum(['PRODUCT', 'SERVICE']).optional(),
  saleRate: z.number().nonnegative('Sale rate cannot be negative').optional(),
  purchaseRate: z.number().nonnegative('Purchase rate cannot be negative').optional(),
  taxRateId: objectId.nullable().optional(),
  gstRate: z.number().nonnegative('GST rate cannot be negative').optional(),
  hsnSacCode: optionalText,
  isStockItem: z.boolean().optional(),
  unitOfMeasure: uomEnum,
  isActive: z.boolean().optional()
}).passthrough();

module.exports = {
  createProductSchema,
  updateProductSchema
};
