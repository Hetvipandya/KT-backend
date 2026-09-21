const Tax = require('../models/Tax');
const Product = require('../models/Product');

/**
 * Custom error helper
 */
const createError = (message, statusCode = 400, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
};

/**
 * Validate that taxRateId belongs to the specified company.
 * @param {string} taxRateId 
 * @param {string} companyId 
 */
const validateTaxRate = async (taxRateId, companyId) => {
  if (!taxRateId) return;

  const tax = await Tax.findById(taxRateId);
  if (!tax) {
    throw createError('Tax rate not found', 400, 'TAX_RATE_NOT_FOUND');
  }

  if (tax.companyId.toString() !== companyId.toString()) {
    throw createError(
      'Tax rate does not belong to the specified company',
      400,
      'INVALID_TAX_RATE_COMPANY'
    );
  }
};

/**
 * Check for duplicate product code within the same company.
 * @param {string} companyId 
 * @param {string} code 
 * @param {string} [excludeProductId] 
 */
const validateProductCodeUniqueness = async (companyId, code, excludeProductId = null) => {
  if (!code) return;

  const filter = {
    companyId,
    code: code.trim(),
    isActive: true
  };

  if (excludeProductId) {
    filter._id = { $ne: excludeProductId };
  }

  const existing = await Product.findOne(filter);
  if (existing) {
    throw createError(
      `A product with code "${code}" already exists for this company`,
      409,
      'DUPLICATE_PRODUCT_CODE'
    );
  }
};

module.exports = {
  validateTaxRate,
  validateProductCodeUniqueness
};
