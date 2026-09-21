const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  line1: { type: String, trim: true },
  line2: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true },
  country: { type: String, trim: true }
}, { _id: false });

const supplierSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  // TODO: validate GSTIN via Module 25 (GET /api/gst/validate-gstin) once Tax Master is integrated.
  gstin: { type: String, trim: true, uppercase: true },
  pan: { type: String, trim: true, uppercase: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  billingAddress: { type: addressSchema, default: undefined },
  shippingAddress: { type: addressSchema, default: undefined },
  contactPerson: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  // TODO: decide whether each supplier gets a dedicated payable COA account or a shared "Sundry Creditors" account.
  payableAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

supplierSchema.pre('validate', function (next) {
  if (this.gstin && (!this.pan || this.pan.trim() === '')) {
    const { extractPanFromGstin } = require('../utils/gst.utils');
    const extracted = extractPanFromGstin(this.gstin);
    if (extracted) this.pan = extracted;
  }
  next();
});

supplierSchema.index({ companyId: 1, branchId: 1, code: 1 }, { sparse: true });
supplierSchema.index({ companyId: 1, branchId: 1, name: 1 });
supplierSchema.index({ companyId: 1, branchId: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Supplier', supplierSchema);
