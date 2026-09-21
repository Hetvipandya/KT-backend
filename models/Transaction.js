const mongoose = require("mongoose");

const transactionSchema =
  new mongoose.Schema(
    {
      transactionType: {
        type: String,
        enum: [
          "income",
          "expense",
        ],
        required: true,
      },

      referenceId: {
        type:
          mongoose.Schema.Types.ObjectId,
        required: true,
      },

      amount: {
        type: Number,
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

      transactionDate: {
        type: Date,
        default: Date.now,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Transaction",
    transactionSchema
  );