const mongoose =
  require("mongoose");

const sharedResourceSchema =
  new mongoose.Schema(
    {
      fileId: {
        type:
          mongoose.Schema
            .Types.ObjectId,
        ref: "File",
        required: true,
      },

      sharedWith: [ 
        {
          type:
            mongoose.Schema
              .Types.ObjectId,
          ref: "Employee",
        },
      ],

      accessType: {
        type: String,
        enum: [
          "View",
          "Edit",
          "Download",
        ],
        default: "View",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "SharedResource",
    sharedResourceSchema
  );