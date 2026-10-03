const ChartOfAccount = require('../models/ChartOfAccount');
const coaService = require('./coa.service');
const gstService = require('./gst.service');

/**
 * Validate GSTIN format using Indian GSTIN standard format.
 * Uses the real validation logic from gst.service.js.
 * @param {string} gstin 
 * @returns {boolean} True if valid, throws 400 error if invalid
 */
const validateGstin = (gstin) => {
  if (!gstin) return true;
  const result = gstService.validateGstin(gstin);
  if (!result.isValidFormat) {
    const error = new Error('Invalid GSTIN format');
    error.statusCode = 400;
    throw error;
  }
  return true;
};

/**
 * Check if the customer has associated sales invoices or payments.
 * TODO: check for linked invoices/payments once Module 8/9 exist.
 * @param {string} customerId 
 * @returns {Promise<boolean>}
 */
const hasTransactions = async (customerId) => {
  // Placeholder returning false until Invoice/Payment modules are implemented
  return false;
};

/**
 * Auto-creates a linked COA ledger account under the seeded "Sundry Debtors" group (code 1230).
 * @param {string} companyId 
 * @param {string} customerName 
 * @returns {Promise<string>} Created COA ledger ID
 */
const ensureParentCoaExists = async (companyId, parentCode, parentName, type, parentType) => {
  let parentCoa = await ChartOfAccount.findOne({ companyId, code: parentCode });
  if (parentCoa) return parentCoa;

  const existingSystemAccount = await ChartOfAccount.findOne({ companyId, isSystemAccount: true });
  if (!existingSystemAccount) {
    try {
      await coaService.seedDefaultCoa(companyId);
    } catch (seedError) {
      // If seeding is unavailable for this company, create the missing parent group
      // directly so the ledger account can still be created.
    }
    parentCoa = await ChartOfAccount.findOne({ companyId, code: parentCode });
    if (parentCoa) return parentCoa;
  }

  const rootGroup = await ChartOfAccount.findOne({ companyId, code: '1200' });
  if (!rootGroup) {
    const fallbackRoot = await ChartOfAccount.create({
      companyId,
      name: 'Current Assets',
      type: 'Asset',
      isGroup: true,
      code: '1200',
      parentId: null,
      isSystemAccount: true,
      isActive: true,
      openingBalance: 0,
      openingBalanceType: 'Dr'
    });
    parentCoa = await ChartOfAccount.create({
      companyId,
      name: parentName,
      type,
      isGroup: true,
      code: parentCode,
      parentId: fallbackRoot._id,
      isSystemAccount: true,
      isActive: true,
      openingBalance: 0,
      openingBalanceType: parentType
    });
    return parentCoa;
  }

  parentCoa = await ChartOfAccount.create({
    companyId,
    name: parentName,
    type,
    isGroup: true,
    code: parentCode,
    parentId: rootGroup._id,
    isSystemAccount: true,
    isActive: true,
    openingBalance: 0,
    openingBalanceType: parentType
  });

  return parentCoa;
};

const createLinkedCoaAccount = async (companyId, customerName) => {
  const parentCode = '1230'; // "Sundry Debtors" group

  const parentCoa = await ensureParentCoaExists(companyId, parentCode, 'Sundry Debtors', 'Asset', 'Dr');

  // Generate next available code
  const generatedCode = await coaService.generateNextCode(companyId, 'Asset');

  // Create the COA ledger account
  const coaAccount = await ChartOfAccount.create({
    companyId,
    name: customerName,
    type: 'Asset',
    isGroup: false,
    parentId: parentCoa._id,
    code: generatedCode,
    openingBalance: 0,
    openingBalanceType: 'Dr',
    isSystemAccount: false,
    isActive: true
  });

  return coaAccount._id;
};

module.exports = {
  validateGstin,
  hasTransactions,
  createLinkedCoaAccount
};
