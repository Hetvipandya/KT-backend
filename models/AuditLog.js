const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
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
    default: null,
    index: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  actorName: {
    type: String,
    default: 'System',
    trim: true
  },
  actorRole: {
    type: String,
    default: 'system',
    trim: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: () => new Date(),
    index: true
  },
  module: {
    type: String,
    required: [true, 'Module name is required'],
    trim: true,
    index: true
  },
  action: {
    type: String,
    trim: true,
    index: true
  },
  actionType: {
    type: String,
    required: [true, 'Action type is required'],
    trim: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    index: true
  },
  entityType: {
    type: String,
    trim: true,
    default: null,
    index: true
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true
  },
  oldValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
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

// Synchronize backward-compatible identifiers and timestamps before validation
AuditLogSchema.pre('validate', function(next) {
  if (!this.actorId && this.userId) {
    this.actorId = this.userId;
  }
  if (!this.userId && this.actorId) {
    this.userId = this.actorId;
  }
  if (!this.action && this.actionType) {
    this.action = this.actionType;
  }
  if (!this.actionType && this.action) {
    this.actionType = this.action;
  }
  if (!this.timestamp) {
    this.timestamp = new Date();
  }
  next();
});

// Enforce immutability: Audit log records can never be updated or deleted
const immutableError = (action) => new Error(`Audit records are immutable and cannot be ${action}`);

AuditLogSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next(immutableError('modified'));
  }
  next();
});

AuditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'findByIdAndUpdate', 'replaceOne'], function(next) {
  const options = this.getOptions ? this.getOptions() : {};
  if (options && options.bypassAuditImmutability) {
    return next();
  }
  next(immutableError('updated'));
});

AuditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete', 'findByIdAndDelete', 'findOneAndRemove', 'findByIdAndRemove'], function(next) {
  const options = this.getOptions ? this.getOptions() : {};
  if (options && options.bypassAuditImmutability) {
    return next();
  }
  next(immutableError('deleted'));
});

// Compound indexes for high-performance filtering & pagination
AuditLogSchema.index({ companyId: 1, createdAt: -1 });
AuditLogSchema.index({ companyId: 1, module: 1, createdAt: -1 });
AuditLogSchema.index({ companyId: 1, userId: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
