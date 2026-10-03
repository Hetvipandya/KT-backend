const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    // KT fields
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null
    },
    expenseType: {
      type: String,
      default: 'office'
    },
    title: {
      type: String,
      default: ''
    },
    travelFrom: {
      type: String,
      default: ''
    },
    travelTo: {
      type: String,
      default: ''
    },
    receipt: {
      type: String,
      default: ''
    },

    // FIN fields
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
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
      default: null
    },
    category: {
      type: String,
      default: ''
    },
    taxRateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tax',
      default: null
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      default: 0
    },
    paymentMode: {
      type: String,
      default: 'CASH'
    },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      default: null
    },
    expenseAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChartOfAccount',
      default: null
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null
    },
    journalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry',
      default: null
    },
    reference: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // Shared fields
    amount: {
      type: Number,
      default: 0
    },
    expenseDate: {
      type: Date,
      default: Date.now
    },
    description: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

expenseSchema.pre('validate', function (next) {
  if (this.amount && !this.totalAmount) {
    this.totalAmount = this.amount;
  }
  if (this.totalAmount && !this.amount) {
    this.amount = this.totalAmount;
  }
  if (this.title && !this.category) {
    this.category = this.title;
  }
  if (this.category && !this.title) {
    this.title = this.category;
  }
  next();
});

const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

module.exports = Expense;