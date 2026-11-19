const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  financialYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialYear', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  grossSalary: { type: Number, required: true },
  basic: { type: Number, required: true },
  hra: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  netPayable: { type: Number, required: true },
  paymentMode: { type: String, enum: ['BANK_TRANSFER', 'CASH', 'OTHER'], required: true },
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', default: null },
  salaryExpenseAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
  payableAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
  reference: String,
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

salarySchema.index({ companyId: 1, journalEntryId: 1, salaryExpenseAccountId: 1 });
salarySchema.index({ companyId: 1, journalEntryId: 1, payableAccountId: 1 });
salarySchema.index({ companyId: 1, journalEntryId: 1, bankAccountId: 1 });
salarySchema.index({ companyId: 1, periodStart: -1 });
salarySchema.index({ companyId: 1, branchId: 1, periodStart: -1 });

module.exports = mongoose.models.Salary || mongoose.model('Salary', salarySchema);
