const mongoose = require("mongoose");

const deductionMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Deduction name is required"],
      trim: true,
    },

    code: {
      type: String,
      required: [true, "Deduction code is required"],
      trim: true,
      uppercase: true,
    },

    category: {
      type: String,
      enum: [
        "STATUTORY",
        "VOLUNTARY",
        "LOAN_ADVANCE",
        "SECURITY_DEPOSIT",
        "PENALTY_DAMAGE",
        "OTHER",
      ],
      default: "VOLUNTARY",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    calculationType: {
      type: String,
      enum: ["FLAT", "PERCENTAGE"],
      default: "FLAT",
    },

    defaultAmount: {
      type: Number,
      default: 0,
      min: [0, "Default amount cannot be negative"],
    },

    percentage: {
      type: Number,
      default: 0,
      min: [0, "Percentage cannot be negative"],
      max: [100, "Percentage cannot exceed 100"],
    },

    percentageBasis: {
      type: String,
      enum: ["GROSS_SALARY", "BASIC_SALARY"],
      default: "GROSS_SALARY",
    },

    // Legal compliance: Only legally permissible deductions may be passed to payroll.
    // e.g., Payment of Wages Act, 1936 Sec 7 / statutory labour laws.
    isLegallyPermissible: {
      type: Boolean,
      required: [true, "Legal permissibility flag is required"],
      default: true,
    },

    legalReference: {
      type: String,
      trim: true,
      default: "", // e.g. "Payment of Wages Act 1936 Section 7(2)"
    },

    maxDeductionPercent: {
      type: Number,
      default: 50, // Statutory ceiling on total wage deductions (e.g. 50% limit)
      min: 0,
      max: 100,
    },

    isActive: {
      type: Boolean,
      default: true,
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

deductionMasterSchema.index({ code: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model("DeductionMaster", deductionMasterSchema);
