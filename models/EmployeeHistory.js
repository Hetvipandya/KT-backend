const mongoose =
  require("mongoose");

const employeeHistorySchema =
  new mongoose.Schema(
    {
      employeeID: {
        type: 
          mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      }, 

      action: {
        type: String,
        enum: [
          "probation",
          "confirmation",
          "resignation",
          "exit",
        ],
        required: true,
      },

      message: {
        type: String, 
      },

      actionBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "EmployeeHistory",
    employeeHistorySchema
  );