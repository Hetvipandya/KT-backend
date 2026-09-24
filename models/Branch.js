const mongoose = require('mongoose'); 

const branchSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true
    },
    branchName: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
      default: 'Ahmedabad'
    },
    branchCode: {
      type: String,
      trim: true,
      default: ''
    },
    address: {
      type: String,
      trim: true,
      default: 'Ahmedabad, Gujarat'
    },
    city: {
      type: String,
      trim: true,
      default: 'Ahmedabad'
    },
    state: {
      type: String,
      trim: true,
      default: 'Gujarat'
    },
    pincode: {
      type: String,
      trim: true,
      default: ''
    },
    country: {
      type: String,
      trim: true,
      default: 'India'
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    manager: {
      type: String,
      trim: true,
      default: ''
    },
    isHeadOffice: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

const Branch = mongoose.models.Branch || mongoose.model('Branch', branchSchema);

module.exports = Branch;