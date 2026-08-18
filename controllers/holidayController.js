const Holiday = require("../models/Holiday");
const axios = require("axios");

// =====================================================
// UNSPLASH IMAGE HELPER
// =====================================================
const fetchUnsplashImage = async (holidayName) => {
  try {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;

    if (!accessKey) {
      console.warn("UNSPLASH_ACCESS_KEY is not configured");
      return null;
    }

    const response = await axios.get(
      "https://api.unsplash.com/search/photos",
      {
        params: {
          query: `${holidayName} festival celebration`,
          page: 1,
          per_page: 1,
          orientation: "landscape",
        },
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
        timeout: 10000,
      }
    );

    const photo = response.data?.results?.[0];

    if (!photo) {
      console.warn(`No Unsplash image found for: ${holidayName}`);
      return null;
    }

    return {
      image: photo.urls?.regular || photo.urls?.small || null,
      photographer: photo.user?.name || "Unsplash Photographer",
      photographerUrl: photo.user?.links?.html || null,
      unsplashUrl: photo.links?.html || null,
    };
  } catch (error) {
    console.error(
      "Unsplash image fetch error:",
      error.response?.data || error.message
    );

    return null;
  }
};

// =====================================================
// DEFAULT IMAGE FOR SUNDAY / SATURDAY
// =====================================================
const DEFAULT_HOLIDAY_IMAGE =
  "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80";

// ================= ADD HOLIDAY =================
exports.addHoliday = async (req, res) => {
  try {
    const {
      holidayName,
      holidayDate,
    } = req.body;

    if (!holidayName || !holidayDate) {
      return res.status(400).json({
        success: false,
        message: "Holiday name and date are required",
      });
    }

    // Automatically find holiday image from Unsplash
    const unsplashData = await fetchUnsplashImage(
      holidayName
    );

    const holiday = await Holiday.create({
      holidayName,
      holidayDate,

      image: unsplashData?.image || DEFAULT_HOLIDAY_IMAGE,

      imagePhotographer:
        unsplashData?.photographer || null,

      imagePhotographerUrl:
        unsplashData?.photographerUrl || null,

      imageUnsplashUrl:
        unsplashData?.unsplashUrl || null,
    });

    res.status(201).json({
      success: true,
      message: "Holiday added successfully",
      holiday,
    });
  } catch (error) {
    console.error("Add holiday error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET ALL HOLIDAYS =================
exports.getAllHolidays = async (req, res) => {
  try {
    const year =
      Number(req.query.year) ||
      new Date().getFullYear();

    // Custom Holidays from DB
    const customHolidays = await Holiday.find({
      holidayDate: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      },
    });

    const holidays = [];

    // =====================================================
    // Generate Sundays + 2nd & 4th Saturdays
    // =====================================================
    for (let month = 0; month < 12; month++) {
      let saturdayCount = 0;

      const lastDay = new Date(
        year,
        month + 1,
        0
      ).getDate();

      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(
          year,
          month,
          day
        );

        const weekDay = date.getDay();

        // ================= SUNDAY =================
        if (weekDay === 0) {
          holidays.push({
            holidayName: "Sunday",
            holidayDate: date,
            isPublicHoliday: true,
            isDefault: true,
            image: DEFAULT_HOLIDAY_IMAGE,
          });
        }

        // ================= SATURDAY =================
        if (weekDay === 6) {
          saturdayCount++;

          if (
            saturdayCount === 2 ||
            saturdayCount === 4
          ) {
            holidays.push({
              holidayName:
                saturdayCount === 2
                  ? "2nd Saturday"
                  : "4th Saturday",

              holidayDate: date,
              isPublicHoliday: true,
              isDefault: true,
              image: DEFAULT_HOLIDAY_IMAGE,
            });
          }
        }
      }
    }

    // =====================================================
    // Add DB Holidays
    // =====================================================
    customHolidays.forEach((holiday) => {
      const exists = holidays.some(
        (h) =>
          new Date(
            h.holidayDate
          ).toDateString() ===
          new Date(
            holiday.holidayDate
          ).toDateString()
      );

      if (!exists) {
        holidays.push({
          ...holiday.toObject(),

          isDefault: false,

          // Fallback image
          image:
            holiday.image ||
            DEFAULT_HOLIDAY_IMAGE,
        });
      }
    });

    // =====================================================
    // Sort by Date
    // =====================================================
    holidays.sort(
      (a, b) =>
        new Date(a.holidayDate) -
        new Date(b.holidayDate)
    );

    res.status(200).json({
      success: true,
      total: holidays.length,
      holidays,
    });
  } catch (error) {
    console.error(
      "Get all holidays error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET CURRENT MONTH FESTIVAL HOLIDAYS =================
exports.getCurrentMonthFestivalHolidays =
  async (req, res) => {
    try {
      const today = new Date();

      const year = today.getFullYear();
      const month = today.getMonth();

      const startDate = new Date(
        year,
        month,
        1
      );

      const endDate = new Date(
        year,
        month + 1,
        0,
        23,
        59,
        59,
        999
      );

      const holidays =
        await Holiday.find({
          holidayDate: {
            $gte: startDate,
            $lte: endDate,
          },
        }).sort({
          holidayDate: 1,
        });

      const formattedHolidays =
        holidays.map((holiday) => ({
          ...holiday.toObject(),

          image:
            holiday.image ||
            DEFAULT_HOLIDAY_IMAGE,
        }));

      res.status(200).json({
        success: true,
        month: month + 1,
        year,
        total: formattedHolidays.length,
        holidays: formattedHolidays,
      });
    } catch (error) {
      console.error(
        "Get current month holidays error:",
        error
      );

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

// ================= UPDATE HOLIDAY =================
exports.updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      holidayName,
      holidayDate,
    } = req.body;

    if (!holidayName || !holidayDate) {
      return res.status(400).json({
        success: false,
        message:
          "Holiday name and date are required",
      });
    }

    // Fetch new image when holiday name changes
    const unsplashData =
      await fetchUnsplashImage(
        holidayName
      );

    const updateData = {
      holidayName,
      holidayDate,

      image:
        unsplashData?.image ||
        DEFAULT_HOLIDAY_IMAGE,

      imagePhotographer:
        unsplashData?.photographer || null,

      imagePhotographerUrl:
        unsplashData?.photographerUrl ||
        null,

      imageUnsplashUrl:
        unsplashData?.unsplashUrl ||
        null,
    };

    const holiday =
      await Holiday.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Holiday updated successfully",
      holiday,
    });
  } catch (error) {
    console.error(
      "Update holiday error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= DELETE HOLIDAY =================
exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    const holiday =
      await Holiday.findByIdAndDelete(id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Holiday deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete holiday error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};