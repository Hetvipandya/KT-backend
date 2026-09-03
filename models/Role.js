const mongoose = require("mongoose");

const roleSchema =
  new mongoose.Schema(
    {
      roleName: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },

      description: {
        type: String,
        default: "",
      },

      permissions: [
        {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: "Permission",
        },
      ],

      isDefault: {
        type: Boolean,
        default: false,
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
    "Role",
    roleSchema
  );