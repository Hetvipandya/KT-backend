const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  description: { type: String, required: true, trim: true },
  quantity:    { type: Number, required: true },
  rate:        { type: Number, required: true },
  amount:      { type: Number, required: true },
  taxRateId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Tax', default: null },
  taxAmount:   { type: Number, default: 0 },
  totalAmount: { type: Number, required: true }
}, { _id: true });

const DebitNoteSchema = new mongoose.Schema({
  companyId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Company',       required: true, index: true },
  branchId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Branch',        required: true, index: true },
  financialYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },

  supplierId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  originalPurchaseId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },

  date:      { type: Date,   required: true, index: true },
  reason:    { type: String, required: true, enum: ['PURCHASE_RETURN', 'RATE_DIFFERENCE', 'DISCOUNT', 'OTHER'] },
  reference: { type: String, trim: true, default: '' },

  lineItems: {
    type: [lineItemSchema],
    validate: [(items) => items.length > 0, 'At least one line item is required']
  },

  subTotal:    { type: Number, required: true, min: 0 },
  taxAmount:   { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },

  status: {
    type: String,
    enum: ['POSTED', 'CANCELLED'],
    default: 'POSTED',
    index: true
  },

  journalEntryId:         { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
  reversalJournalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },

  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null }
}, { timestamps: true });

// Composite indexes for branch-wise reporting queries
DebitNoteSchema.index({ companyId: 1, branchId: 1, date: -1 });
DebitNoteSchema.index({ companyId: 1, financialYearId: 1, branchId: 1 });
DebitNoteSchema.index({ companyId: 1, supplierId: 1, date: -1 });

// TODO: implement debit note auto-numbering (DN-<FY>-<sequence>) per company + branch once numbering rules are finalised.
// TODO: validate taxRateId via Module 25 and compute taxAmount from rate automatically.

module.exports = mongoose.model('DebitNote', DebitNoteSchema);
