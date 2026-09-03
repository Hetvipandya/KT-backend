const mongoose =
  require("mongoose");

const fileSchema =
  new mongoose.Schema(
    {
      projectId: {
        type:
          mongoose.Schema
            .Types.ObjectId,
        ref: "Project",
      },

      uploadedBy: {
        type:
          mongoose.Schema
            .Types.ObjectId,
        ref: "Employee",
        required: true,
      },

      fileName: {
        type: String,
        required: true,
      },

      originalName: {
        type: String,
        required: true,
      },

      fileType: {
        type: String,
        enum: [
          "PDF",
          "DOCX",
          "XLSX",
          "ZIP",
          "RAR",
          "PNG",
          "JPG",
          "MP4",
          "PPTX",
        ],
      },

      category: {
        type: String,
        enum: [
          "Project File",
          "Source Code",
          "Design File",
          "Testing Report",
          "Shared Resource",
        ],
      },

      filePath: {
        type: String,
        required: true,
      },

      fileSize: {
        type: Number,
      },

      currentVersion: {
        type: Number,
        default: 1,
      },

      isDeleted: {
        type: Boolean,
        default: false,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "File",
    fileSchema
  );