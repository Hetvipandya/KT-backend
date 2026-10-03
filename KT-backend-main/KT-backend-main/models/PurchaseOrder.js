const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  description: { type: String, trim: true, default: '' },
  quantity: { type: Number, required: true, min: 0.000001 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  taxRateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tax', default: null }
}, { _id: true });

const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  financialYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  poNumber: { type: String, required: true, trim: true },
  poSequence: { type: Number, required: true },
  poDate: { type: Date, required: true, index: true },
  expectedDeliveryDate: { type: Date, default: null },
  reference: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['APPROVED', 'PENDING_APPROVAL', 'REJECTED', 'CANCELLED'], default: 'APPROVED', index: true },
  lineItems: { type: [lineItemSchema], validate: [(items) => items.length > 0, 'At least one line item is required'] },
  subTotal: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  approvalRequired: { type: Boolean, default: false },
  autoApproved: { type: Boolean, default: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

schema.index({ companyId: 1, financialYearId: 1, poSequence: 1 }, { unique: true });
schema.index({ companyId: 1, poNumber: 1 }, { unique: true });
module.exports = mongoose.model('PurchaseOrder', schema);
