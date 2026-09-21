const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  description: { type: String, required: true, trim: true },
  quantity:    { type: Number, required: true },
  rate:        { type: Number, required: true },
  amount:      { type: Number, required: true },       // base amount (qty × rate)
  taxRateId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Tax', default: null }, // Module 25
  taxAmount:   { type: Number, default: 0 },
  totalAmount: { type: Number, required: true }        // amount + taxAmount
}, { _id: true });

const CreditNoteSchema = new mongoose.Schema({
  companyId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Company',       required: true, index: true },
  branchId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Branch',        required: true, index: true },
  financialYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },

  customerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  originalInvoiceId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice',  default: null },

  date:      { type: Date,   required: true, index: true },
  reason:    { type: String, required: true, enum: ['SALES_RETURN', 'DISCOUNT', 'PRICE_DIFFERENCE', 'OTHER'] },
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
CreditNoteSchema.index({ companyId: 1, branchId: 1, date: -1 });
CreditNoteSchema.index({ companyId: 1, financialYearId: 1, branchId: 1 });
CreditNoteSchema.index({ companyId: 1, customerId: 1, date: -1 });

// TODO: implement credit note auto-numbering (CN-<FY>-<sequence>) per company + branch once numbering rules are finalised.
// TODO: validate taxRateId via Module 25 and compute taxAmount from rate automatically.

module.exports = mongoose.model('CreditNote', CreditNoteSchema);
