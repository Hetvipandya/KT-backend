const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  financialYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },
  returnType: { type: String, enum: ['GSTR1', 'GSTR3B'], required: true },
  period: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  taxableValue: { type: Number, default: 0 }, outputTax: { type: Number, default: 0 }, inputTaxCredit: { type: Number, default: 0 }, netPayable: { type: Number, default: 0 },
  paymentDate: { type: Date, default: null }, challanNumber: { type: String, trim: true, default: '' }, arn: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['DRAFT', 'PAID', 'FILED'], default: 'DRAFT', index: true }, filedAt: { type: Date, default: null }, filedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, notes: { type: String, trim: true, default: '' }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
schema.index({ companyId: 1, branchId: 1, returnType: 1, period: 1 }, { unique: true });
module.exports = mongoose.model('GSTReturn', schema);
