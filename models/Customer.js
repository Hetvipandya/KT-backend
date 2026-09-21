const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    // KT fields
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null
    },
    customerName: {
      type: String,
      trim: true,
      default: ''
    },
    companyName: {
      type: String,
      default: ''
    },
    dealAmount: {
      type: Number,
      default: 0
    },
    remarks: {
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
    name: {
      type: String,
      trim: true,
      default: ''
    },
    gstin: {
      type: String,
      uppercase: true,
      trim: true,
      default: null
    },
    pan: {
      type: String,
      uppercase: true,
      trim: true,
      default: null
    },
    billingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    creditLimit: {
      type: Number,
      default: 0
    },
    creditPeriodDays: {
      type: Number,
      default: 0
    },
    coaAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChartOfAccount',
      default: null
    },
    openingBalance: {
      type: Number,
      default: 0
    },
    openingBalanceType: {
      type: String,
      enum: ['Dr', 'Cr'],
      default: 'Dr'
    },
    isActive: {
      type: Boolean,
      default: true
    },

    // Shared
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    address: {
      type: mongoose.Schema.Types.Mixed,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

customerSchema.pre('validate', function (next) {
  if (this.name && !this.customerName) {
    this.customerName = this.name;
  }
  if (this.customerName && !this.name) {
    this.name = this.customerName;
  }
  if (this.gstin && (!this.pan || this.pan.trim() === '')) {
    try {
      const { extractPanFromGstin } = require('../utils/gst.utils');
      const extracted = extractPanFromGstin(this.gstin);
      if (extracted) this.pan = extracted;
    } catch (_) {}
  }
  next();
});

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

module.exports = Customer;