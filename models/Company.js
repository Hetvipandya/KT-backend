const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    // Common / FIN field: name
    name: {
      type: String,
      trim: true,
      default: 'KEVALON Technology'
    },

    // KT field: companyName
    companyName: {
      type: String,
      trim: true,
      default: 'KEVALON Technology'
    },

    // FIN field: gstin
    gstin: {
      type: String,
      uppercase: true,
      trim: true,
      sparse: true,
      default: '24BQSPH0154B1Z9'
    },

    // KT field: gstNumber
    gstNumber: {
      type: String,
      trim: true,
      default: '24BQSPH0154B1Z9'
    },

    // FIN field: pan
    pan: {
      type: String,
      uppercase: true,
      trim: true,
      sparse: true,
      default: 'BQSPH0154'
    },

    // KT field: panNumber
    panNumber: {
      type: String,
      trim: true,
      default: 'BQSPH0154'
    },

    // Location & Contact (FIN + KT)
    address: {
      type: String,
      trim: true,
      default: ''
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

    // Logos
    logoUrl: {
      type: String,
      trim: true,
      default: ''
    },

    companyLogo: {
      type: String,
      default: ''
    },

    // Creator (FIN multi-tenancy)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // KT Working Hours & Weekly Off
    workingHours: {
      startTime: {
        type: String,
        default: '10:00 AM'
      },
      endTime: {
        type: String,
        default: '07:00 PM'
      }
    },

    weeklyOff: [
      {
        type: String,
        default: ['2nd Saturday', '4th Saturday', 'Sunday']
      }
    ]
  },
  {
    timestamps: true
  }
);

companySchema.pre('validate', function (next) {
  if (this.name && !this.companyName) {
    this.companyName = this.name;
  }
  if (this.companyName && !this.name) {
    this.name = this.companyName;
  }

  if (this.gstin && !this.gstNumber) {
    this.gstNumber = this.gstin;
  }
  if (this.gstNumber && !this.gstin) {
    this.gstin = this.gstNumber;
  }

  if (this.pan && !this.panNumber) {
    this.panNumber = this.pan;
  }
  if (this.panNumber && !this.pan) {
    this.pan = this.panNumber;
  }

  if (this.logoUrl && !this.companyLogo) {
    this.companyLogo = this.logoUrl;
  }
  if (this.companyLogo && !this.logoUrl) {
    this.logoUrl = this.companyLogo;
  }

  if (this.gstin && (!this.pan || this.pan.trim() === '')) {
    try {
      const { extractPanFromGstin } = require('../utils/gst.utils');
      const extracted = extractPanFromGstin(this.gstin);
      if (extracted) {
        this.pan = extracted;
        this.panNumber = extracted;
      }
    } catch (_) {}
  }
  next();
});

const Company = mongoose.models.Company || mongoose.model('Company', companySchema);

module.exports = Company;