const mongoose =
  require("mongoose");

const branchSchema =
  new mongoose.Schema(
    {
      branchName: {
        type: String,
        required: true,
        default:
          "Ahmedabad",
      },

      address: {
        type: String,
        default:
          "Ahmedabad, Gujarat",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Branch",
    branchSchema
  );