const Tax = require('../models/Tax');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');

const DEFAULT_TAX_TEMPLATES = [
  { name: 'GST 0%', ratePercent: 0, taxCategory: 'Taxable' },
  { name: 'GST 0.25%', ratePercent: 0.25, taxCategory: 'Taxable' },
  { name: 'GST 3%', ratePercent: 3, taxCategory: 'Taxable' },
  { name: 'GST 5%', ratePercent: 5, taxCategory: 'Taxable' },
  { name: 'GST 12%', ratePercent: 12, taxCategory: 'Taxable' },
  { name: 'GST 18%', ratePercent: 18, taxCategory: 'Taxable' },
  { name: 'GST 28%', ratePercent: 28, taxCategory: 'Taxable' },
  { name: 'Exempt', ratePercent: 0, taxCategory: 'Exempt' },
  { name: 'Nil Rated', ratePercent: 0, taxCategory: 'NilRated' }
];

const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Validates a GSTIN's format and checksum using the official Indian GSTIN check-digit algorithm.
 * @param {string} gstin 
 * @returns {Object} { isValidFormat, isChecksumValid, isValid, stateCode, panEmbedded }
 */
const validateGstin = (gstin) => {
  if (!gstin || typeof gstin !== 'string') {
    return {
      isValidFormat: false,
      isChecksumValid: false,
      isValid: false,
      stateCode: null,
      panEmbedded: null
    };
  }

  const cleanGstin = gstin.trim().toUpperCase();
  const formatRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const isValidFormat = formatRegex.test(cleanGstin);

  if (!isValidFormat) {
    return {
      gstin: cleanGstin,
      isValidFormat: false,
      isChecksumValid: false,
      isValid: false,
      stateCode: null,
      panEmbedded: null
    };
  }

  // Extract parts
  const stateCode = cleanGstin.substring(0, 2);
  const panEmbedded = cleanGstin.substring(2, 12);

  // Compute checksum
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = cleanGstin[i];
    const val = GST_CHARS.indexOf(char);
    if (val === -1) {
      // Should not happen since regex passed, but safety check
      return {
        gstin: cleanGstin,
        isValidFormat: true,
        isChecksumValid: false,
        isValid: false,
        stateCode,
        panEmbedded
      };
    }

    const factor = (i % 2 === 0) ? 1 : 2;
    let product = val * factor;
    if (product >= 36) {
      product = Math.floor(product / 36) + (product % 36);
    }
    sum += product;
  }

  const checksumValue = (36 - (sum % 36)) % 36;
  const expectedCheckChar = GST_CHARS[checksumValue];
  const actualCheckChar = cleanGstin[14];
  const isChecksumValid = expectedCheckChar === actualCheckChar;

  return {
    gstin: cleanGstin,
    isValidFormat: true,
    isChecksumValid,
    isValid: isChecksumValid,
    stateCode,
    panEmbedded
  };
};

/**
 * Seed the standard Indian GST slabs for a company.
 * @param {string} companyId 
 * @returns {Promise<number>} Number of seeded tax rates
 */
const seedDefaultTaxRates = async (companyId) => {
  // Idempotency check: Reject if default tax rates are already seeded
  const existingSystemTax = await Tax.findOne({ companyId, isSystemTax: true });
  if (existingSystemTax) {
    const err = new Error('Default tax rates already seeded for this company');
    err.statusCode = 409;
    throw err;
  }

  let seededCount = 0;
  for (const t of DEFAULT_TAX_TEMPLATES) {
    await Tax.create({
      companyId,
      name: t.name,
      ratePercent: t.ratePercent,
      taxCategory: t.taxCategory,
      hsnSacApplicable: true,
      isSystemTax: true,
      isActive: true
    });
    seededCount++;
  }

  return seededCount;
};

/**
 * Returns summary of GST inputs and outputs for returns filing.
 * Currently returns a zeroed-out shape as a placeholder until Module 8 & Module 10 exist.
 * @param {string} companyId 
 * @param {Object} range - { period, from, to }
 */
const getGstReturnsSummary = async (companyId, { period, from, to, branchId }) => {
  let startDate = from ? new Date(from) : null;
  let endDate = to ? new Date(to) : null;

  // Auto-parse period "YYYY-MM" if from/to are omitted
  if (!startDate && !endDate && period && /^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    startDate = new Date(Date.UTC(year, month - 1, 1));
    endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  }

  const buildFilter = (dateField) => {
    const filter = { companyId, status: { $ne: 'CANCELLED' } };
    if (branchId) {
      filter.$or = [{ branchId }, { branchId: null }];
    }
    if (startDate || endDate) {
      filter[dateField] = {};
      if (startDate) filter[dateField].$gte = startDate;
      if (endDate) filter[dateField].$lte = endDate;
    }
    return filter;
  };

  const Expense = require('../models/Expense');

  const [invoices, purchases, expenses] = await Promise.all([
    Invoice.find(buildFilter('invoiceDate')).populate('lineItems.taxRateId', 'ratePercent').lean(),
    Purchase.find(buildFilter('billDate')).populate('lineItems.taxRateId', 'ratePercent').lean(),
    Expense.find(buildFilter('expenseDate')).lean()
  ]);

  const summarize = (documents, amountField) => {
    const totals = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    const rates = new Map();
    documents.forEach((document) => {
      let docTaxable = Number(document.subTotal || document.taxableAmount || document.amount || 0);
      let docTax = Number(document.taxTotal || document.taxAmount || 0);

      let lineTaxSum = 0;
      let lineTaxableSum = 0;

      if (Array.isArray(document.lineItems) && document.lineItems.length > 0) {
        document.lineItems.forEach((line) => {
          const taxable = Number(line[amountField] || line.taxableAmount || line.amount || 0);
          const tax = Number(line.taxAmount || 0);
          lineTaxableSum += taxable;
          lineTaxSum += tax;
          const rate = Number(line.taxRateId?.ratePercent || (taxable > 0 ? Math.round((tax / taxable) * 100) : 0));
          if (taxable > 0 || tax > 0) {
            const item = rates.get(rate) || { ratePercent: rate, taxableValue: 0, taxAmount: 0 };
            item.taxableValue += taxable;
            item.taxAmount += tax;
            rates.set(rate, item);
          }
        });
      }

      // Fall back to document-level totals if line-level sums are missing
      const finalTaxable = lineTaxableSum > 0 ? lineTaxableSum : docTaxable;
      const finalTax = lineTaxSum > 0 ? lineTaxSum : docTax;

      totals.taxableValue += finalTaxable;
      totals.cgst += finalTax / 2;
      totals.sgst += finalTax / 2;
      totals.total += finalTax;
    });
    return { totals, rates };
  };

  const output = summarize(invoices, 'taxableAmount');
  const input = summarize(purchases, 'amount');

  // Add tax paid on Expenses to Input Tax Credit (ITC)
  expenses.forEach((exp) => {
    const tax = Number(exp.taxAmount || 0);
    const taxable = Number(exp.amount || 0);
    if (tax > 0 || taxable > 0) {
      input.totals.taxableValue += taxable;
      input.totals.cgst += tax / 2;
      input.totals.sgst += tax / 2;
      input.totals.total += tax;
    }
  });

  // Resolve period string
  let resolvedPeriod = period || 'custom';
  if (!period && from && to) {
    resolvedPeriod = `${from}_to_${to}`;
  } else if (!period) {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    resolvedPeriod = `${yyyy}-${mm}`;
  }

  const netPayable = Math.max(0, output.totals.total - input.totals.total);
  const itcCarryForward = Math.max(0, input.totals.total - output.totals.total);

  const gstr1OutwardData = {
    taxableValue: output.totals.taxableValue,
    igst: output.totals.igst,
    cgst: output.totals.cgst,
    sgst: output.totals.sgst,
    totalOutputLiability: output.totals.total,
    total: output.totals.total,
    liability: output.totals.total
  };

  const gstr3bItcData = {
    taxableValue: input.totals.taxableValue,
    igst: input.totals.igst,
    cgst: input.totals.cgst,
    sgst: input.totals.sgst,
    totalInputCredit: input.totals.total,
    total: input.totals.total,
    inputCredit: input.totals.total
  };

  return {
    period: resolvedPeriod,
    outputTax: output.totals,
    inputTax: input.totals,
    inputTaxCredit: input.totals,
    netPayable,
    payableGst: netPayable,
    totalGstPayable: netPayable,
    netTaxPayable: netPayable,

    itcCarryForward,
    itcBalance: itcCarryForward,
    netItcCarryForward: itcCarryForward,

    // Flutter Frontend Screen Keys
    taxableSales: output.totals.taxableValue,
    salesTaxable: output.totals.taxableValue,
    outputTaxLiability: output.totals.total,
    outwardTaxLiability: output.totals.total,
    taxLiability: output.totals.total,

    eligibleItc: input.totals.total,
    inputCredit: input.totals.total,
    itcEligible: input.totals.total,

    netGstPayableInCash: netPayable,
    netGstPayable: netPayable,

    gstr1Outward: gstr1OutwardData,
    gstr1: gstr1OutwardData,
    outwardLiability: gstr1OutwardData,

    gstr3bItc: gstr3bItcData,
    gstr3b: gstr3bItcData,
    eligibleItcSummary: gstr3bItcData,

    breakdownByRate: [...new Map([...output.rates, ...input.rates].map(([rate, item]) => [rate, { ...item, inputTaxAmount: input.rates.get(rate)?.taxAmount || 0, outputTaxAmount: output.rates.get(rate)?.taxAmount || 0 }])).values()],
    note: 'CGST/SGST are split equally until place-of-supply and intra/inter-state tax classification are captured on transactions.'
  };
};

module.exports = {
  validateGstin,
  seedDefaultTaxRates,
  getGstReturnsSummary,
  DEFAULT_TAX_TEMPLATES
};
