const Holiday =
  require("../models/Holiday");

  // ================= ADD HOLIDAY =================
exports.addHoliday =
  async (req, res) => {
    try {
      const {
        holidayName,
        holidayDate,
      } = req.body;

      if ( 
        !holidayName ||
        !holidayDate
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Holiday name and date are required",
          });
      } 

      const holiday =
        await Holiday.create({
          holidayName,
          holidayDate,
        });

      res.status(201).json({
        success: true,
        message:
          "Holiday added successfully",
        holiday,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ================= GET ALL HOLIDAYS =================
// ================= GET ALL HOLIDAYS =================
exports.getAllHolidays = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    // Custom Holidays from DB
    const customHolidays = await Holiday.find({
      holidayDate: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      },
    });

    const holidays = [];

    // Generate Sundays + 2nd & 4th Saturdays
    for (let month = 0; month < 12; month++) {
      let saturdayCount = 0;

      const lastDay = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month, day);
        const weekDay = date.getDay();

        // Sunday
        if (weekDay === 0) {
          holidays.push({
            holidayName: "Sunday",
            holidayDate: date,
            isPublicHoliday: true,
            isDefault: true,
          });
        }

        // Saturday
        if (weekDay === 6) {
          saturdayCount++;

          if (saturdayCount === 2 || saturdayCount === 4) {
            holidays.push({
              holidayName:
                saturdayCount === 2
                  ? "2nd Saturday"
                  : "4th Saturday",
              holidayDate: date,
              isPublicHoliday: true,
              isDefault: true,
            });
          }
        }
      }
    }

    // Add DB Holidays (avoid duplicate dates)
    customHolidays.forEach((holiday) => {
      const exists = holidays.some(
        (h) =>
          new Date(h.holidayDate).toDateString() ===
          new Date(holiday.holidayDate).toDateString()
      );

      if (!exists) {
        holidays.push({
          ...holiday.toObject(),
          isDefault: false,
        });
      }
    });

    // Sort by Date
    holidays.sort(
      (a, b) =>
        new Date(a.holidayDate) - new Date(b.holidayDate)
    );

    res.status(200).json({
      success: true,
      total: holidays.length,
      holidays,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET CURRENT MONTH FESTIVAL HOLIDAYS =================
exports.getCurrentMonthFestivalHolidays = async (req, res) => {
  try {
    const today = new Date();

    const year = today.getFullYear();
    const month = today.getMonth();

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const holidays = await Holiday.find({
      holidayDate: {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({ holidayDate: 1 });

    res.status(200).json({
      success: true,
      month: month + 1,
      year,
      total: holidays.length,
      holidays,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= UPDATE HOLIDAY =================
exports.updateHoliday =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const holiday =
        await Holiday.findByIdAndUpdate(
          id,
          req.body,
          { new: true }
        );

      if (!holiday) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Holiday not found",
          });
      }

      res.status(200).json({
        success: true,
        message:
          "Holiday updated successfully",
        holiday,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ================= DELETE HOLIDAY =================
exports.deleteHoliday =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const holiday =
        await Holiday.findByIdAndDelete(
          id
        );

      if (!holiday) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Holiday not found",
          });
      }

      res.status(200).json({
        success: true,
        message:
          "Holiday deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };