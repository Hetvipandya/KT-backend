const User = require("../models/User");
const { sendCustomEmail } = require("../utils/mailer");

// ================= GENERATE OTP =================
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ================= SEND OTP =================
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = generateOTP();

    user.forgotPasswordOTP = otp;
    user.otpExpireTime = new Date(Date.now() + 5 * 60 * 1000);

    await user.save();

    sendCustomEmail({
      to: email,
      subject: "OTP Verification",
      htmlContent: `
        <h2>OTP Verification</h2>
        <p>Your OTP:</p>
        <h1>${otp}</h1>
        <p>Valid for 5 mins</p>
      `,
    }).catch((err) => console.log("OTP send error:", err.message));

    res.json({
      success: true,
      message: "OTP sent successfully",
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

// ================= VERIFY OTP =================
exports.verifyOTP =
  async (req, res) => {
    try {
      const {
        email,
        otp,
      } = req.body;

      const user =
        await User.findOne(
          {
            email,
          }
        );

      if (!user) {
        return res
          .status(404)
          .json({
            success:
              false,
            message:
              "User not found",
          });
      }

      if (
        user.forgotPasswordOTP !==
        otp
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "Invalid OTP",
          });
      }

      if (
        user.otpExpireTime <
        new Date()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "OTP expired",
          });
      }

      user.otpVerified =
        true;

      await user.save();

      res.json({
        success:
          true,
        message:
          "OTP verified successfully",
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