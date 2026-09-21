const mongoose =
  require("mongoose");

const projectDocumentSchema =
  new mongoose.Schema(
    {
      projectId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
      },

      fileName: {
        type: String,
        required: true,
      },

      fileUrl: {
        type: String,
        required: true,
      },

      uploadedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    { timestamps: true }
  );

module.exports =
  mongoose.model(
    "ProjectDocument",
    projectDocumentSchema
  );