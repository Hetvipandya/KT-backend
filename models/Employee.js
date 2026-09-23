const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: '' },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'India' }
  },
  { _id: false }
); 

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    relation: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true
    },
    employeeID: {
      type: String,
      sparse: true,
      trim: true
    },
    employeeCode: {
      type: String,
      sparse: true,
      trim: true,
      uppercase: true
    },
    userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // Personal Details
    name: {
      type: String,
      trim: true
    },
    firstName: {
      type: String,
      trim: true,
      default: ''
    },
    middleName: {
      type: String,
      trim: true,
      default: ''
    },
    lastName: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: ''
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'male', 'female', 'other'],
      default: 'Male'
    },
    dob: {
      type: Date,
      default: null
    },
    bloodGroup: {
      type: String,
      default: ''
    },
    profileImage: {
      type: String,
      default: ''
    },

    // Addresses
    address: {
      type: mongoose.Schema.Types.Mixed,
      default: ''
    },
    currentAddress: {
      type: String,
      default: ''
    },
    permanentAddress: {
      type: String,
      default: ''
    },

    // Emergency Contact
    emergencyContact: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ name: '', phone: '', relation: '' })
    },

    // Education & Experience
    education: [
      {
        degree: String,
        institute: String,
        passingYear: String,
        percentage: String
      }
    ],
    experience: [
      {
        companyName: String,
        designation: String,
        fromDate: Date,
        toDate: Date
      }
    ],
    skills: {
      type: [String],
      default: []
    },

    // Salary Structure
    salaryStructure: {
      basicSalary: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      allowances: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
      grossSalary: { type: Number, default: 0 }
    },

    // Designation & Department
    designation: {
      type: String,
      trim: true,
      default: ''
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },

    isTeamLead: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      default: 'employee'
    },

    joiningDate: {
      type: Date,
      default: Date.now
    },
    dateOfJoining: {
      type: Date,
      default: Date.now
    },

    employeeStatus: {
      type: String,
      enum: ['Active', 'Inactive', 'Resigned', 'Terminated', 'ACTIVE', 'INACTIVE', 'TERMINATED'],
      default: 'Active'
    },
    status: {
      type: String,
      default: 'ACTIVE'
    },
    currentAction: {
      type: String,
      default: 'created'
    },

    // Push Tokens
    notificationTokens: [
      {
        token: { type: String, required: true, trim: true },
        deviceType: { type: String, default: 'android' },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

employeeSchema.virtual('fullName').get(function () {
  if (this.name) return this.name;
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
});

employeeSchema.pre('validate', function (next) {
  if (this.employeeID && !this.employeeCode) {
    this.employeeCode = this.employeeID;
  }
  if (this.employeeCode && !this.employeeID) {
    this.employeeID = this.employeeCode;
  }

  if (this.userID && !this.userId) {
    this.userId = this.userID;
  }
  if (this.userId && !this.userID) {
    this.userID = this.userId;
  }

  if (this.mobile && !this.phone) {
    this.phone = this.mobile;
  }
  if (this.phone && !this.mobile) {
    this.mobile = this.phone;
  }

  if (this.joiningDate && !this.dateOfJoining) {
    this.dateOfJoining = this.joiningDate;
  }
  if (this.dateOfJoining && !this.joiningDate) {
    this.joiningDate = this.dateOfJoining;
  }

  if (this.employeeStatus) {
    this.status = this.employeeStatus.toUpperCase();
  }

  if (!this.name && (this.firstName || this.lastName)) {
    this.name = [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
  }

  next();
});

const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

module.exports = Employee;