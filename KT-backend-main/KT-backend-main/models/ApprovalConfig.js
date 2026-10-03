const mongoose = require('mongoose');

const ApprovalConfigSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },

  module: { 
    type: String, 
    required: true 
  }, // e.g. 'PURCHASE_ORDER', 'INVOICE', 'PAYMENT', 'JOURNAL_ENTRY', 'FIXED_ASSET'

  thresholdAmount: { type: Number, required: true }, // amount above which approval is required

  levels: [
    {
      level: { type: Number, required: true }, // 1, 2, ...
      roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: false }, // Module 23
      userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // explicit approvers
      // Use either roleId or userIds or both.
    }
  ],

  escalationEnabled: { type: Boolean, default: false },
  escalationAfterHours: { type: Number, default: null },
  escalationRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },

  isActive: { type: Boolean, default: true },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Index to support module configs per company & branch
ApprovalConfigSchema.index({ companyId: 1, branchId: 1, module: 1 });

module.exports = mongoose.model('ApprovalConfig', ApprovalConfigSchema);
