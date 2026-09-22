const mongoose = require("mongoose");

const companyAccessSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    role: { type: String, required: true, default: "employee", trim: true },
    isActive: { type: Boolean, default: true },
    invitedAt: { type: Date, default: null },
    inviteSent: { type: Boolean, default: false },
    joinedAt: { type: Date, default: null },
  },
  { _id: true },
);

const financeUserSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    financialYearId: { type: mongoose.Schema.Types.ObjectId, ref: "FinancialYear", default: null },
    companyAccess: { type: [companyAccessSchema], default: [] },
    role: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    companyCreated: { type: Boolean, default: false },
    branchCreated: { type: Boolean, default: false },
    financialYearCreated: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "finance_users" },
);

financeUserSchema.index({ "companyAccess.companyId": 1 });

module.exports = mongoose.model("FinanceUser", financeUserSchema);