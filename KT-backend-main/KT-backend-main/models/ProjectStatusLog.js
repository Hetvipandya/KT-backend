const mongoose = require("mongoose");

const projectStatusLogSchema =
  new mongoose.Schema(
    {
      projectId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
      },

      oldStatus: {
        type: String,
      },

      newStatus: {
        type: String,
      },

      updatedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      remarks: {
        type: String,
      },
    },
    { timestamps: true }
  );

module.exports =
  mongoose.model(
    "ProjectStatusLog",
    projectStatusLogSchema
  );