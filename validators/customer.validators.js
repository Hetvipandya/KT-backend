const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const addressSchema = z.object({
  line1: z.string().trim().optional().or(z.literal('')),
  line2: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().optional().or(z.literal('')),
  state: z.string().trim().optional().or(z.literal('')),
  pincode: z.string().trim().optional().or(z.literal('')),
  country: z.string().trim().optional().default('India')
}).passthrough().optional().nullable();

const preprocessCustomerInput = (data) => {
  if (data && typeof data === 'object') {
    const copy = { ...data };
    if (!copy.name && copy.customerName) {
      copy.name = copy.customerName;
    }
    if (typeof copy.creditLimit === 'string') {
      const parsed = parseFloat(copy.creditLimit);
      copy.creditLimit = isNaN(parsed) ? 0 : parsed;
    }
    if (typeof copy.creditPeriodDays === 'string') {
      const parsed = parseInt(copy.creditPeriodDays, 10);
      copy.creditPeriodDays = isNaN(parsed) ? 0 : parsed;
    }
    if (typeof copy.openingBalance === 'string') {
      const parsed = parseFloat(copy.openingBalance);
      copy.openingBalance = isNaN(parsed) ? 0 : parsed;
    }
    return copy;
  }
  return data;
};

const createCustomerSchema = z.preprocess(
  preprocessCustomerInput,
  z.object({
    companyId: z.string({ required_error: 'Company ID is required' })
      .regex(objectIdRegex, 'Invalid Company ID format'),
    branchId: z.string().regex(objectIdRegex, 'Invalid Branch ID format').optional().nullable().or(z.literal('')),
    name: z.string({ required_error: 'Customer name is required' })
      .trim()
      .min(1, 'Customer name cannot be empty'),
    customerName: z.string().trim().optional(),
    gstin: z.string().trim().toUpperCase().optional().nullable().or(z.literal('')),
    pan: z.string().trim().toUpperCase().optional().nullable().or(z.literal('')),
    email: z.string().trim().toLowerCase().email('Invalid email format').optional().or(z.literal('')),
    phone: z.string().trim().optional().or(z.literal('')),
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
    creditLimit: z.number().default(0),
    creditPeriodDays: z.number().default(0),
    openingBalance: z.number().default(0),
    openingBalanceType: z.enum(['Dr', 'Cr']).default('Dr')
  }).passthrough()
);

const updateCustomerSchema = z.preprocess(
  preprocessCustomerInput,
  z.object({
    branchId: z.string().regex(objectIdRegex, 'Invalid Branch ID format').optional().nullable().or(z.literal('')),
    name: z.string().trim().min(1, 'Customer name cannot be empty').optional(),
    customerName: z.string().trim().optional(),
    gstin: z.string().trim().toUpperCase().optional().nullable().or(z.literal('')),
    pan: z.string().trim().toUpperCase().optional().nullable().or(z.literal('')),
    email: z.string().trim().toLowerCase().email('Invalid email format').optional().or(z.literal('')),
    phone: z.string().trim().optional().or(z.literal('')),
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
    creditLimit: z.number().optional(),
    creditPeriodDays: z.number().optional(),
    isActive: z.boolean().optional(),
    
    // Reject coaAccountId changes (handled explicitly in controller)
    coaAccountId: z.any().optional()
  }).passthrough()
);

module.exports = {
  createCustomerSchema,
  updateCustomerSchema
};
