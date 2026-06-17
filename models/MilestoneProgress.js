const mongoose =
  require("mongoose");

const milestoneProgressSchema =
  new mongoose.Schema(
    {
      milestoneId: {
        type:
          mongoose.Schema
            .Types.ObjectId,
        ref: "Milestone",
        required: true,
      },

      progress: {
        type: Number,
        required: true,
      },

      remarks: String,
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "MilestoneProgress",
    milestoneProgressSchema
  );