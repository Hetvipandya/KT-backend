const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const optionalText = z.string().trim().optional().or(z.literal(''));
const addressSchema = z.object({
  line1: optionalText,
  line2: optionalText,
  city: optionalText,
  state: optionalText,
  pincode: optionalText,
  country: optionalText
}).strict();

const fields = {
  name: z.string().trim().min(1, 'Supplier name cannot be empty'),
  code: optionalText,
  gstin: optionalText,
  pan: optionalText,
  email: z.string().trim().toLowerCase().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Invalid phone format').optional().or(z.literal('')),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  contactPerson: optionalText,
  payableAccountId: objectId.nullable().optional()
};

const createSupplierSchema = z.object({
  companyId: objectId,
  branchId: objectId.optional(),
  autoCreateLedger: z.union([z.boolean(), z.string()]).optional(),
  ...fields
}).passthrough();

const updateSupplierSchema = z.object({
  branchId: objectId.optional(),
  name: fields.name.optional(),
  code: fields.code,
  gstin: fields.gstin,
  pan: fields.pan,
  email: fields.email,
  phone: fields.phone,
  billingAddress: fields.billingAddress,
  shippingAddress: fields.shippingAddress,
  contactPerson: fields.contactPerson,
  isActive: z.boolean().optional(),
  payableAccountId: fields.payableAccountId
}).passthrough();

module.exports = { createSupplierSchema, updateSupplierSchema };
