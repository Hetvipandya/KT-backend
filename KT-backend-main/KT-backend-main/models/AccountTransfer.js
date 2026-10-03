const mongoose = require('mongoose');

const accountTransferSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company ID is required'],
    index: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null,
    index: true
  },
  financialYearId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinancialYear',
    required: [true, 'Financial Year ID is required'],
    index: true
  },
  transferType: {
    type: String,
    enum: ['BANK_TO_BANK', 'BANK_TO_CASH', 'CASH_TO_BANK', 'CASH_TO_CASH', 'FUND_PLUS', 'FUND_MINUS'],
    required: [true, 'Transfer type is required']
  },
  fromAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    default: null,
    index: true
  },
  toAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    default: null,
    index: true
  },
  contraAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    default: null,
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  transferDate: {
    type: Date,
    required: [true, 'Transfer date is required'],
    default: Date.now,
    index: true
  },
  paymentMode: {
    type: String,
    enum: ['IMPS', 'NEFT', 'RTGS', 'UPI', 'Cheque', 'Cash', 'Other'],
    default: 'Other'
  },
  referenceNo: {
    type: String,
    trim: true,
    default: ''
  },
  narration: {
    type: String,
    trim: true,
    default: ''
  },
  journalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry',
    required: [true, 'Linked Journal Entry ID is required']
  },
  status: {
    type: String,
    enum: ['Completed', 'Cancelled'],
    default: 'Completed',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

accountTransferSchema.index({ companyId: 1, branchId: 1, transferDate: -1 });
accountTransferSchema.index({ companyId: 1, fromAccountId: 1, toAccountId: 1 });

const AccountTransfer = mongoose.model('AccountTransfer', accountTransferSchema);

module.exports = AccountTransfer;
