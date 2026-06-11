const mongoose = require("mongoose");

const dailyReportCommentSchema =
  new mongoose.Schema(
    {
      dailyReportId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "DailyReport",
        required: true,
      },

      commentBy: { 
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      comment: {
        type: String,
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports = mongoose.model(
  "DailyReportComment",
  dailyReportCommentSchema
);