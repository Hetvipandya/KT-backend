const mongoose =
  require("mongoose");

const departmentSchema =
  new mongoose.Schema(
    {
      departmentName: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      }, 

      departmentHead: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      departmentBudget: {
        type: Number,
        default: 0,
      },

      teams: [
        {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: "Team",
        },
      ],

      description: {
        type: String,
        default: "",
      },

      status: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Department",
    departmentSchema
  );