const mongoose = require("mongoose");

const approvalHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      required: true,
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actionByName: {
      type: String,
      default: "",
    },
    actionRole: {
      type: String,
      default: "",
    },
    actionDate: {
      type: Date,
      default: Date.now,
    },
    comments: {
      type: String,
      trim: true,
      default: "",
    },
    previousStatus: {
      type: String,
      default: "",
    },
  },
  { _id: true }
);

const employeeDeductionSchema = new mongoose.Schema(
  {
    // Mandatory Unique Deduction Record Identifier (e.g. DED-202611-0001)
    deductionRecordId: {
      type: String,
      required: [true, "Deduction Record ID is mandatory"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // Mandatory Employee Identifier
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Employee ID is mandatory"],
      index: true,
    },

    // Dual reference for backwards compatibility
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },

    // Mandatory Team Leader Identifier
    teamLeadId: {
      type: String,
      required: [true, "Team Leader ID is mandatory"],
      trim: true,
      index: true,
    },

    // Team Leader User Document Reference (if resolved)
    teamLeadUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Mandatory Deduction Master Reference
    deductionMasterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeductionMaster",
      required: [true, "Deduction Master ID is mandatory"],
      index: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },

    financialYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialYear",
      default: null,
    },

    month: {
      type: Number,
      required: [true, "Month is required"],
      min: 1,
      max: 12,
      index: true,
    },

    year: {
      type: Number,
      required: [true, "Year is required"],
      index: true,
    },

    deductionMonth: {
      type: String,
      default: "",
    },

    amount: {
      type: Number,
      required: [true, "Deduction amount is required"],
      min: [0, "Deduction amount cannot be negative"],
    },

    reason: {
      type: String,
      trim: true,
      default: "",
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    // Legal Compliance Flag: Only approved AND legally permissible deductions are passed into payroll
    isLegallyPermissible: {
      type: Boolean,
      default: true,
      index: true,
    },

    legalReference: {
      type: String,
      default: "",
    },

    // Workflow Status
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
      index: true,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    // Detailed Approval History Audit Trail
    approvalHistory: [approvalHistorySchema],

    // Payroll Locking: Prevents tampering after monthly salary generation / approval
    isLocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    lockedAt: {
      type: Date,
      default: null,
    },

    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    monthlySalaryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MonthlySalary",
      default: null,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Populate userId from employeeId automatically
employeeDeductionSchema.pre("save", async function () {
  if (!this.userId && this.employeeId) {
    this.userId = this.employeeId;
  }
  if (!this.employeeId && this.userId) {
    this.employeeId = this.userId;
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  if (!this.deductionMonth && this.month && this.year) {
    this.deductionMonth = `${monthNames[this.month - 1] || ""} ${this.year}`.trim();
  }
});

// Compound Index for efficient querying by employee and pay period
employeeDeductionSchema.index({ employeeId: 1, month: 1, year: 1 });
employeeDeductionSchema.index({ companyId: 1, month: 1, year: 1 });
employeeDeductionSchema.index({ teamLeadId: 1, month: 1, year: 1 });

module.exports = mongoose.model("EmployeeDeduction", employeeDeductionSchema);
