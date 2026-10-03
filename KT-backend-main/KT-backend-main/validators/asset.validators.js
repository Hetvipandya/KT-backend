const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');
const date = z.string().datetime({ offset: true }).or(z.string().date());
const positiveNumber = z.coerce.number().finite().positive();
const nonNegativeNumber = z.coerce.number().finite().min(0);

const createAssetSchema = z.object({
  companyId: objectId,
  branchId: objectId.nullable().optional(),
  financialYearId: objectId,
  assetName: z.string().trim().min(1).max(200),
  assetCode: z.string().trim().min(1).max(100),
  purchaseDate: date,
  purchaseCost: positiveNumber,
  salvageValue: nonNegativeNumber.optional().default(0),
  usefulLifeYears: positiveNumber,
  depreciationMethod: z.enum(['STRAIGHT_LINE', 'WRITTEN_DOWN_VALUE']).optional().default('STRAIGHT_LINE'),
  depreciationRatePercent: nonNegativeNumber.min(0).max(100),
  coaAssetAccountId: objectId.nullable().optional(),
  coaDepreciationExpenseAccountId: objectId.nullable().optional(),
  coaAccumulatedDepreciationAccountId: objectId.nullable().optional(),
  notes: z.string().trim().max(5000).optional().default('')
}).strict().superRefine((val, ctx) => {
  if (val.salvageValue >= val.purchaseCost) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['salvageValue'],
      message: 'salvageValue must be strictly less than purchaseCost'
    });
  }
});

const postDepreciationSchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  depreciationDate: date,
  depreciationAmount: positiveNumber,
  remarks: z.string().trim().max(1000).optional().default('')
}).strict();

const disposeAssetSchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  disposalDate: date,
  disposalType: z.enum(['SALE', 'WRITE_OFF', 'SCRAP']),
  saleProceeds: nonNegativeNumber.optional().default(0),
  coaGainLossAccountId: objectId.nullable().optional(),
  remarks: z.string().trim().max(1000).optional().default('')
}).strict();

module.exports = {
  createAssetSchema,
  postDepreciationSchema,
  disposeAssetSchema
};
