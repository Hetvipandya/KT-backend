const mongoose = require('mongoose');

const repaymentSchema = new mongoose.Schema({
  financialYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialYear', required: true },
  paymentDate: { type: Date, required: true },
  principalAmount: { type: Number, required: true, min: 0 },
  interestAmount: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', required: true },
  bankAccountName: { type: String, trim: true, default: '' },
  reference: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' },
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const loanSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  financialYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },
  lenderType: { type: String, enum: ['PERSON', 'BANK'], required: true, index: true },
  lenderName: { type: String, required: true, trim: true },
  lenderPhone: { type: String, trim: true, default: '' },
  lenderEmail: { type: String, trim: true, lowercase: true, default: '' },
  lenderBankName: { type: String, trim: true, default: '' },
  lenderAccountNumber: { type: String, trim: true, select: false, default: '' },
  lenderAccountNumberLast4: { type: String, trim: true, default: '' },
  lenderIfscCode: { type: String, trim: true, uppercase: true, default: '' },
  loanReference: { type: String, trim: true, default: '' },
  principalAmount: { type: Number, required: true, min: 0.01 },
  principalOutstanding: { type: Number, required: true, min: 0 },
  annualInterestRatePercent: { type: Number, required: true, min: 0, max: 100 },
  startDate: { type: Date, required: true, index: true },
  maturityDate: { type: Date, default: null },
  disbursementBankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', required: true },
  disbursementAccountName: { type: String, trim: true, default: '' },
  liabilityAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  initialJournalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
  totalPrincipalRepaid: { type: Number, default: 0, min: 0 },
  totalInterestPaid: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['ACTIVE', 'PAID_OFF'], default: 'ACTIVE', index: true },
  notes: { type: String, trim: true, default: '' },
  repayments: { type: [repaymentSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

loanSchema.index({ companyId: 1, branchId: 1, startDate: -1 });
loanSchema.index({ companyId: 1, status: 1, startDate: -1 });

module.exports = mongoose.models.Loan || mongoose.model('Loan', loanSchema);
