const mongoose = require("mongoose");

const incomeSchema =
  new mongoose.Schema(
    {
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