const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
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
    departmentName: {
      type: String,
      trim: true,
      default: ''
    },
    name: {
      type: String,
      trim: true,
      default: ''
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },
    departmentHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    departmentBudget: {
      type: Number,
      default: 0
    },
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      }
    ],
    description: {
      type: String,
      default: ''
    },
    status: {
      type: Boolean,
      default: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

departmentSchema.pre('validate', function (next) {
  if (this.name && !this.departmentName) {
    this.departmentName = this.name;
  }
  if (this.departmentName && !this.name) {
    this.name = this.departmentName;
  }
  if (this.isActive !== undefined) {
    this.status = this.isActive;
  } else if (this.status !== undefined) {
    this.isActive = this.status;
  }
  next();
});

const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema);

module.exports = Department;