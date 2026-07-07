const mongoose = require("mongoose");

const expenseSchema =
  new mongoose.Schema(
    {
      employeeId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
      },

      projectId: {
        type:
          mongoose.Schema.Types.ObjectId,   
        ref: "Project",
        default: null,
      },

      expenseType: {
        type: String,
        enum: [
          "office",
          "project",
          "travel",
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

      expenseDate: {
        type: Date,
        required: true,
      },

      description: {
        type: String,
        default: "",
      },

      travelFrom: {
        type: String,
        default: "",
      },

      travelTo: {
        type: String,
        default: "",
      },

      receipt: {
        type: String,
        default: "",
      },

      // approvalStatus: {
      //   type: String,
      //   enum: [
      //     "pending",
      //     "approved",
      //     "rejected",
      //   ],
      //   default: "pending",
      // },

      // approvedBy: {
      //   type:
      //     mongoose.Schema.Types.ObjectId,
      //   ref: "User",
      //   default: null,
      // },

      // approvedAt: {
      //   type: Date,
      //   default: null,
      // },

      // rejectionReason: {
      //   type: String,
      //   default: "",
      // },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Expense",
    expenseSchema
  );