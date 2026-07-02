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
exports.getAllHolidays =
  async (req, res) => {
    try {
      const holidays =
        await Holiday.find();

      res.status(200).json({
        success: true,
        holidays,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
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