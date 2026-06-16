const mongoose =
  require("mongoose");

const fileVersionSchema =
  new mongoose.Schema(
    {
      fileId: {
        type:
          mongoose.Schema
            .Types.ObjectId,
        ref: "File",
        required: true,
      },

      versionNumber: {
        type: Number,
        required: true,
      },

      uploadedBy: {
        type:
          mongoose.Schema
            .Types.ObjectId,
        ref: "Employee",
      },

      filePath: {
        type: String,
        required: true,
      },

      changeLog: {
        type: String,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "FileVersion",
    fileVersionSchema
  );