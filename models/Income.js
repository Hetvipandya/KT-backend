const mongoose = require("mongoose");

const incomeSchema =
  new mongoose.Schema(
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
      incomeType: {
        type: String,
        enum: [
          "service",
          "product",
          "project",
          "other",
        ],
        required: true,
      },

      title: {
        type: String,
        required: true,
      },

      amount: {
        type: Number,
        required: true,
      },

      receivedDate: {
        type: Date,
        required: true,
      },

      paymentMode: { 
        type: String,
        enum: [
          "cash",
          "bank",
          "online",
        ],
        required: true,
      },

      description: {
        type: String,
        default: "",
      },
      coaAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ChartOfAccount",
        required: true,
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Income",
    incomeSchema
  );