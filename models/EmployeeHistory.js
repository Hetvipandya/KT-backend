const mongoose = require("mongoose");

const employeeHistorySchema = new mongoose.Schema(
  {
    employeeID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "deleted",
        "exit",
      ],
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "EmployeeHistory",
  employeeHistorySchema
);