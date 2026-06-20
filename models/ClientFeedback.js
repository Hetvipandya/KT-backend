const mongoose = require("mongoose");

const clientFeedbackSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true
    },
    feedback: String,
    rating: Number
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ClientFeedback",
  clientFeedbackSchema
);