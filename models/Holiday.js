const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    holidayName: {
      type: String,
      required: true,
    },

    holidayDate: {
      type: Date,
      required: true,
      unique: true,
    },

    isPublicHoliday: {
      type: Boolean,
      default: true,
    },

    // ================= UNSPLASH IMAGE =================
    // Optional fields - existing holiday data will still work
    image: {
      type: String,
      default: null,
    },

    imagePhotographer: {
      type: String,
      default: null,
    },

    imagePhotographerUrl: {
      type: String,
      default: null,
    },

    imageUnsplashUrl: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Holiday",
  holidaySchema
);