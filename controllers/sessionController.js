const User =
  require("../models/User");

// ================= GET ACTIVE SESSION =================
exports.getSession =
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.user.id
        );

      res.json({
        success:
          true,

        session: {
          deviceId:
            user.deviceId,

          lastLogin:
            user.lastLogin,
        },
      });
    } catch (
      error
    ) {
      res
        .status(500)
        .json({
          success:
            false,
          message:
            error.message,
        });
    }
  };

// ================= REMOVE SESSION =================
exports.removeSession =
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.user.id
        );

      user.deviceId =
        null;

      user.refreshToken =
        null;

      await user.save();

      res.json({
        success:
          true,
        message:
          "Session removed successfully",
      });
    } catch (
      error
    ) {
      res
        .status(500)
        .json({
          success:
            false,
          message:
            error.message,
        });
    }
  };