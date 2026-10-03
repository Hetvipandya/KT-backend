const mongoose = require('mongoose');

const ApprovalTaskSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },

  module: { type: String, required: true },     // same strings as ApprovalConfig.module
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true }, // ID of target record
  entityType: { type: String, required: true }, // e.g. 'PurchaseOrder', 'Invoice'

  approvalConfigId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalConfig', required: true },

  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'ESCALATED'],
    default: 'PENDING'
  },

  currentLevel: { type: Number, required: true }, // starts at 1

  assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

  decisionByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decisionAt: { type: Date, default: null },
  decisionReason: { type: String, default: null },

  history: [
    {
      level: { type: Number, required: true },
      action: { type: String, enum: ['APPROVED', 'REJECTED', 'ESCALATED'], required: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      reason: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, {
  timestamps: true
});

// Indexes for query optimization
ApprovalTaskSchema.index({ companyId: 1, branchId: 1, assignedToUserId: 1, status: 1 });
ApprovalTaskSchema.index({ companyId: 1, branchId: 1, module: 1, entityId: 1 });

module.exports = mongoose.model('ApprovalTask', ApprovalTaskSchema);
