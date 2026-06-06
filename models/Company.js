const mongoose = require("mongoose");

const companySchema =
  new mongoose.Schema(
    {
      companyName: {
        type: String,
        required: true,
        default:
          "KEVALON Technology",
      },

      companyLogo: {
        type: String,
        default: "",
      },

      gstNumber: {
        type: String,
        default:
          "24BQSPH0154B1Z9",
      },

      panNumber: {
        type: String,
        default:
          "BQSPH0154",
      },

      workingHours: {
        startTime: {
          type: String,
          default: "10:00 AM",
        },

        endTime: {
          type: String,
          default: "07:00 PM",
        },
      },

      weeklyOff: [
        {
          type: String,
          default: [
            "2nd Saturday",
            "4th Saturday",
            "Sunday",
          ],
        },
      ],
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Company",
    companySchema
  );