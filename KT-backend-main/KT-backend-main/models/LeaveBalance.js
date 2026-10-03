const mongoose =
  require("mongoose");

const leaveBalanceSchema =
  new mongoose.Schema(
    {
      employeeId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      totalLeaves: {
        type: Number,
      },

      usedLeaves: {
        type: Number,
      },

      remainingLeaves: {
        type: Number,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "LeaveBalance",
    leaveBalanceSchema
  );