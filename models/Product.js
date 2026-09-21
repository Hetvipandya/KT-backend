const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: [true, 'Product/service name is required'],
    trim: true
  },
  code: {
    type: String,
    trim: true,
    default: null
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  type: {
    type: String,
    enum: ['PRODUCT', 'SERVICE'],
    default: 'PRODUCT'
  },
  saleRate: {
    type: Number,
    default: 0,
    min: [0, 'Sale rate cannot be negative']
  },
  purchaseRate: {
    type: Number,
    default: 0,
    min: [0, 'Purchase rate cannot be negative']
  },
  taxRateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tax',
    default: null
  },
  gstRate: {
    type: Number,
    default: 0,
    min: [0, 'GST rate cannot be negative']
  },
  hsnSacCode: {
    type: String,
    trim: true,
    default: ''
  },
  isStockItem: {
    type: Boolean,
    default: true
  },
  unitOfMeasure: {
    type: String,
    enum: [
      'BAG', 'BOX', 'BTL', 'CAN', 'CBM', 'CFT', 'CMS', 'DRM', 'DOZ',
      'GMS', 'GRS', 'KGS', 'KLR', 'KME', 'LTR', 'MTR', 'MTS', 'MLT',
      'NOS', 'PAC', 'PCS', 'PRS', 'QTL', 'ROL', 'SET', 'SQF', 'SQM',
      'SQY', 'TBS', 'TON', 'TUB', 'UNT', 'YDS', 'HRS', 'OTH'
    ],
    default: 'NOS',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for unique codes per company/branch when the code is present
ProductSchema.index(
  { companyId: 1, branchId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } }
);
ProductSchema.index({ companyId: 1, branchId: 1, name: 1 });
ProductSchema.index({ companyId: 1, branchId: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Product', ProductSchema);
