const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company ID is required'],
    index: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  module: {
    type: String,
    required: [true, 'Module name is required'],
    trim: true
  },
  actionType: {
    type: String,
    required: [true, 'Action type is required'],
    trim: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  entityType: {
    type: String,
    trim: true,
    default: null
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    trim: true,
    default: ''
  },
  userAgent: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Compound indexes for optimized audit trail queries
AuditLogSchema.index({ companyId: 1, createdAt: -1 });
AuditLogSchema.index({ companyId: 1, module: 1, createdAt: -1 });
AuditLogSchema.index({ companyId: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
