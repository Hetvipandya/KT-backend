const mongoose = require("mongoose");

const dailyUpdateSchema =
  new mongoose.Schema(
    {
      taskId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Task",
        required: true,
      },

      userId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      updateText: {
        type: String,
        required: true,
      },

      progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },
    { timestamps: true }
  );

module.exports =
  mongoose.model(
    "DailyUpdate",
    dailyUpdateSchema
  );