const mongoose =
  require("mongoose");

const teamSchema =
  new mongoose.Schema(
    {
      teamName: {
        type: String,
        required: true,
        trim: true,
      },

      departmentId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Department",
        default: null,
      },

      description: {
        type: String,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Team",
    teamSchema
  );