const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    moduleName: {
      type: String,
      required: true,
      trim: true, 
    }, 

    menuAccess: [
      {
        type: String,
      },
    ],

    apiAccess: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Permission",
  permissionSchema
);