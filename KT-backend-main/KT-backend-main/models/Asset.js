const mongoose = require('mongoose');

const disposalSchema = new mongoose.Schema({
  disposalDate: {
    type: Date,
    required: true
  },
  disposalType: {
    type: String,
    enum: ['SALE', 'WRITE_OFF', 'SCRAP'],
    required: true
  },
  saleProceeds: {
    type: Number,
    required: true,
    min: 0
  },
  coaGainLossAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    required: true
  },
  gainLossAmount: {
    type: Number,
    required: true
  },
  journalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry',
    default: null
  }
}, { _id: false });

const assetSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
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
    required: true
  },
  assetName: {
    type: String,
    required: true,
    trim: true
  },
  assetCode: {
    type: String,
    required: true,
    trim: true
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  purchaseCost: {
    type: Number,
    required: true,
    min: 0.000001
  },
  salvageValue: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  usefulLifeYears: {
    type: Number,
    required: true,
    min: 0.01
  },
  depreciationMethod: {
    type: String,
    enum: ['STRAIGHT_LINE', 'WRITTEN_DOWN_VALUE'],
    default: 'STRAIGHT_LINE'
  },
  depreciationRatePercent: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  coaAssetAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    required: true
  },
  coaDepreciationExpenseAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    required: true
  },
  coaAccumulatedDepreciationAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    required: true
  },
  bookValue: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED'],
    default: 'ACTIVE'
  },
  disposalDetails: {
    type: disposalSchema,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    default: ''
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

assetSchema.index({ companyId: 1, assetCode: 1 }, { unique: true });

module.exports = mongoose.model('Asset', assetSchema);
