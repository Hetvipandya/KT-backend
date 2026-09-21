const mongoose = require("mongoose");

const lineItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, required: true },
    description: { type: String, trim: true, default: "" },
    quantity: { type: Number, required: true, min: 0.000001 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    taxRateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tax",
      default: null,
    },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const schema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
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
      required: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },
    billNumber: { type: String, required: true, trim: true },
    billDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["POSTED", "PARTIALLY_PAID", "PAID", "CANCELLED"],
      default: "POSTED",
      index: true,
    },
    lineItems: {
      type: [lineItemSchema],
      validate: [
        (items) => items.length > 0,
        "At least one line item is required",
      ],
    },
    subTotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    roundOff: { type: Number, default: 0 },
    balanceDue: { type: Number, required: true, min: 0 },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    journalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      default: null,
    },
    reversalJournalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      default: null,
    },
    notes: { type: String, trim: true, default: "" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ companyId: 1, billNumber: 1 }, { unique: true });
schema.index({ companyId: 1, supplierId: 1, billDate: -1 });
schema.index({ companyId: 1, branchId: 1, createdAt: -1 });
schema.index({ companyId: 1, status: 1, createdAt: -1 });
module.exports = mongoose.model("Purchase", schema);
