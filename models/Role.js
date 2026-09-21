const mongoose = require('mongoose');

const PERMISSION_MODULES = [
  'CompanySettings',
  'UserManagement',
  'MasterData',
  'EmployeeDepartment',
  'Accounting',
  'Banking',
  'CRM',
  'Purchase',
  'Inventory',
  'ExpenseSalary',
  'FixedAssets',
  'Reports',
  'Approvals',
  'AuditLog',
  'NotificationConfig'
];

const PERMISSION_LEVELS = ['full', 'manage', 'entry', 'approve', 'view', 'own', 'none'];

const roleSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true
    },
    name: {
      type: String,
      trim: true,
      default: ''
    },
    roleName: {
      type: String,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    isSystemRole: {
      type: Boolean,
      default: false
    },
    isProtected: {
      type: Boolean,
      default: false
    },
    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: []
    }
  },
  {
    timestamps: true
  }
);

roleSchema.pre('validate', function (next) {
  if (this.name && !this.roleName) {
    this.roleName = this.name;
  }
  if (this.roleName && !this.name) {
    this.name = this.roleName;
  }
  next();
});

const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);

module.exports = Role;
module.exports.PERMISSION_MODULES = PERMISSION_MODULES;
module.exports.PERMISSION_LEVELS = PERMISSION_LEVELS;