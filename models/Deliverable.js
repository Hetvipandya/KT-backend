const mongoose = require("mongoose");

const deliverableSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true
    },
    title: String,
    description: String,
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending"
    },
    invoiceReference: String,
    contractFile: String
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Deliverable",
  deliverableSchema
);