const mongoose = require("mongoose");

const customerSchema =
  new mongoose.Schema(
    {
      leadId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Lead",
        required: true,
      },

      customerName: {
        type: String,
        required: true,
      },

      companyName: {
        type: String,
        default: "",
      },

      email: String,
      phone: String,

      dealAmount: {
        type: Number,
        default: 0,
      },

      address: {
        type: String,
        default: "",
      },

      remarks: {
        type: String,
        default: "",
      },
    },
    { timestamps: true }
  );

module.exports = mongoose.model(
  "Customer",
  customerSchema
);