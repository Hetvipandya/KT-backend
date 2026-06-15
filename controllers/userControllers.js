const User =
  require("../models/User");

const bcrypt =
  require("bcryptjs");

const jwt =
  require("jsonwebtoken");

const nodemailer =
  require("nodemailer");

// ================= EMAIL CONFIG =================
const transporter =
  nodemailer.createTransport(
    {
      service:
        "gmail",

      auth: {
        user:
          process.env
            .EMAIL_USER,

        pass:
          process.env
            .EMAIL_PASS,
      },
    }
  );

// ================= JWT TOKEN =================
const generateToken =
  (userId) => {
    return jwt.sign(
      {
        id: userId,
      },
      process.env
        .JWT_SECRET,
      {
        expiresIn:
          "7d",
      }
    );
  };

// ================= GENERATE OTP =================
const generateOTP =
  () =>
    Math.floor(
      100000 +
        Math.random() *
          900000
    ).toString();

    const createDefaultAdmin =
  async () => {
    try {
      const adminExists =
        await User.findOne({
          role: "admin",
        });

      if (adminExists) {
        return;
      }

      const admin =
        new User({
          name: "admin",

          email:
            "admin@gmail.com",

          phoneNumber:
            "9999999999",

          dob:
            "01-01-2000",

          address:
            "Ahmedabad",

          department:
            "Administration",

          bloodGroup:
            "O+",

          uniqueID:
            "ADMIN001",

          password:
            "admin123",

          plainPassword:
            "admin123",

          role:
            "admin",

          isApproved:
            true,

          isFirstLogin:
            false,

          isActive:
            true,
        });

      await admin.save();

   
    } catch (error) {
      console.log(
        "❌ Admin Create Error:",
        error.message
      );
    }
  };

// run admin creation
createDefaultAdmin();

const createDefaultHR =
  async () => {
    try {
      const hrExists =
        await User.findOne({
          role: "hr",
        });

      if (hrExists) {
        return;
      }

      const hr =
        new User({
          name: "hr",

          email:
            "hr@gmail.com",

          phoneNumber:
            "8888888888",

          dob:
            "01-01-2000",

          address:
            "Ahmedabad",

          department:
            "HR",

          bloodGroup:
            "O+",

          uniqueID:
            "HR001",

          password:
            "hr123",

          plainPassword:
            "hr123",

          role:
            "hr",

          isApproved:
            true,

          isFirstLogin:
            false,

          isActive:
            true,
        });

      await hr.save();

      console.log(
        "✅ Default HR Created"
      );
    } catch (error) {
      console.log(
        "❌ HR Create Error:",
        error.message
      );
    }
  };
  createDefaultHR();
// ================= REGISTER USER =================
exports.registerUser =
  async (req, res) => {
    try {
      const {
        name,
        email,
        phoneNumber,
        dob,
        address, 
        department,
        bloodGroup,
      } = req.body;

      // ================= VALIDATION =================
      if (
        !name ||
        !email ||
        !phoneNumber ||
        !dob ||
        !address ||
        !department ||
        !bloodGroup
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "All fields are required",
          });
      }

      // ================= CHECK EXISTING USER =================
      const existingUser =
        await User.findOne({
          $or: [
            { email },
            {
              phoneNumber,
            },
          ],
        });

      if (
        existingUser
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "User already exists",
          });
      }

      // ================= GENERATE UNIQUE ID =================
 // ================= GENERATE UNIQUE ID =================
const lastUser =
  await User.findOne({
    uniqueID: {
      $regex: /^NEW\d+$/,
    },
  })
    .sort({
      createdAt: -1,
    });

let nextNumber = 1001;

if (
  lastUser &&
  lastUser.uniqueID
) {
  const lastNumber =
    parseInt(
      lastUser.uniqueID.replace(
        "NEW",
        ""
      )
    );

  nextNumber =
    isNaN(lastNumber)
      ? 1001
      : lastNumber + 1;
}

const uniqueID =
  `NEW${nextNumber}`;

      // ================= GENERATE PASSWORD =================
      const generatedPassword =
        Math.random()
          .toString(36)
          .slice(-8);

      // ================= SAVE USER =================
      const user =
        await User.create(
          {
            name,
            email,
            phoneNumber,
            dob,
            address,
            department,
            bloodGroup,
            uniqueID,

            password:
              generatedPassword,

            plainPassword:
              generatedPassword,

            role:
              "employee",

            isApproved:
              false,

            isFirstLogin:
              true,
          }
        );

      // ================= SEND EMAIL =================
      try {
        await transporter.sendMail(
          {
            from:
              process.env
                .EMAIL_USER,

            to:
              process.env
                .ADMIN_EMAIL,

            subject:
              "New Employee Registration",

            html: `
              <h2>
                New Employee Registration
              </h2>

              <p>
                <b>Name:</b>
                ${name}
              </p>

              <p>
                <b>Email:</b>
                ${email}
              </p>

              <p>
                <b>Phone:</b>
                ${phoneNumber}
              </p>

              <p>
                <b>Department:</b>
                ${department}
              </p>

              <hr />

              <h3>
                Login Credentials
              </h3>

              <p>
                <b>Unique ID:</b>
                ${uniqueID}
              </p>

              <p>
                <b>Password:</b>
                ${generatedPassword}
              </p>

              <p>
                Please approve
                employee from
                admin panel.
              </p>
            `,
          }
        );

        console.log(
          "✅ Email sent successfully"
        );
      } catch (
        emailError
      ) {
        console.log(
          "❌ Email Error:",
          emailError.message
        );
      }

      // ================= RESPONSE =================
      res
        .status(201)
        .json({
          success:
            true,

          message:
            "Registration successful. Waiting for admin approval.",

          credentials:
            {
              uniqueID,
              password:
                generatedPassword,
            },

          user: {
            _id:
              user._id,
            name:
              user.name,
            email:
              user.email,
            uniqueID:
              user.uniqueID,
            role:
              user.role,
            isApproved:
              user.isApproved,
          },
        });
    } catch (
      error
    ) {
      console.log(
        "Register Error:",
        error
      );

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

// ================= GET ALL USERS =================
exports.getAllUsers =
  async (req, res) => {
    try {
      const users =
        await User.find()
          .sort({
            createdAt:
              -1,
          });

      res.status(200).json({
        success:
          true,
        totalUsers:
          users.length,
        users,
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

// ================= APPROVE EMPLOYEE =================
exports.approveEmployee =
  async (req, res) => {
    try {
      const {
        userId,
      } = req.body;

      const user =
        await User.findById(
          userId
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

      user.isApproved =
        true;

      await user.save();

      res.json({
        success:
          true,
        message:
          "Employee approved successfully",
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

// ================= LOGIN =================
exports.loginUser =
  async (req, res) => {
    try {
      const {
        login,
        password,
        deviceId,
      } = req.body;

      // ================= VALIDATION =================
      if (
        !login ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Login and password required",
          });
      }

      // ================= FIND USER =================
   const user =
  await User.findOne({
    $or: [
      {
        email:
          login
            .trim()
            .toLowerCase(),
      },

      {
        name:
          login.trim(),
      },

      {
        uniqueID:
          login.trim(),
      },
    ],
  });

      // ================= USER NOT FOUND =================
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

      // ================= APPROVAL CHECK =================
     if (
  user.role !== "admin" &&
  user.role !== "hr" &&
  !user.isApproved
) {
  return res
    .status(403)
    .json({
      success:
        false,

      message:
        "Admin approval pending",
    });
}

      // ================= ONE DEVICE LOGIN =================
      if (
        user.deviceId &&
        deviceId &&
        user.deviceId !==
          deviceId
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Already logged in another device",
          });
      }

      // ================= PASSWORD MATCH =================
      const isMatch =
        await bcrypt.compare(
          password.trim(),
          user.password
        );

      if (!isMatch) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid Password",
          });
      }

      // ================= TOKEN =================
      const token =
        generateToken(
          user._id
        );

      const refreshToken =
        generateToken(
          user._id
        );

      // ================= SAVE LOGIN =================
      user.refreshToken =
        refreshToken;

      user.deviceId =
        deviceId || null;

      user.lastLogin =
        new Date();

      await user.save();

      // ================= RESPONSE =================
      res.status(200).json({
        success:
          true,

        message:
          "Login successful",

        token,
        refreshToken,

        changePassword:
          user.isFirstLogin,

        user: {
          _id:
            user._id,

          name:
            user.name,

          email:
            user.email,

          role:
            user.role,
        },
      });
    } catch (
      error
    ) {
      console.log(
        "Login Error:",
        error
      );

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
  // ================= CHANGE PASSWORD =================
exports.changePassword =
  async (req, res) => {
    try {
      const {
        userId,
        oldPassword,
        newPassword,
      } = req.body;

      const user =
        await User.findById(
          userId
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

      const isMatch =
        await bcrypt.compare(
          oldPassword,
          user.password
        );

      if (!isMatch) {
        return res
          .status(400)
          .json({
            success:
              false,
            message:
              "Old password incorrect",
          });
      }

      user.password =
        newPassword;

      user.isFirstLogin =
        false;

      await user.save();

      res.json({
        success:
          true,
        message:
          "Password changed successfully",
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

// ================= SEND OTP =================
exports.sendOTP =
  async (req, res) => {
    try {
      const {
        email,
      } = req.body;

      const user =
        await User.findOne(
          { email }
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

      const otp =
        generateOTP();

      user.forgotPasswordOTP =
        otp;

      user.otpExpireTime =
        new Date(
          Date.now() +
            5 * 60 * 1000
        );

      await user.save();

      await transporter.sendMail(
        {
          from:
            process.env
              .EMAIL_USER,

          to:
            email,

          subject:
            "OTP Verification",

          html: `
            <h2>
              OTP Verification
            </h2>

            <p>
              Your OTP is:
            </p>

            <h1>
              ${otp}
            </h1>

            <p>
              OTP valid for
              5 minutes.
            </p>
          `,
        }
      );

      res.json({
        success:
          true,
        message:
          "OTP sent successfully",
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

// ================= FORGOT PASSWORD =================
exports.forgotPassword =
  async (req, res) => {
    try {
      const {
        email,
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

      const otp =
        generateOTP();

      user.forgotPasswordOTP =
        otp;

      user.otpExpireTime =
        new Date(
          Date.now() +
            5 * 60 * 1000
        );

      await user.save();

      await transporter.sendMail(
        {
          from:
            process.env
              .EMAIL_USER,

          to:
            email,

          subject:
            "Forgot Password OTP",

          html: `
            <h2>
              Reset Password OTP
            </h2>

            <h1>
              ${otp}
            </h1>
          `,
        }
      );

      res.json({
        success:
          true,
        message:
          "OTP sent to email",
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

// ================= RESET PASSWORD =================
exports.resetPassword =
  async (req, res) => {
    try {
      const {
        email,
        otp,
        newPassword,
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

      user.password =
        newPassword;

      user.forgotPasswordOTP =
        null;

      user.otpExpireTime =
        null;

      user.otpVerified =
        false;

      await user.save();

      res.json({
        success:
          true,
        message:
          "Password reset successfully",
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

// ================= REFRESH TOKEN =================
exports.refreshUserToken =
  async (req, res) => {
    try {
      const {
        refreshToken,
      } = req.body;

      if (
        !refreshToken
      ) {
        return res
          .status(401)
          .json({
            success:
              false,
            message:
              "Refresh token required",
          });
      }

      const user =
        await User.findOne(
          {
            refreshToken,
          }
        );

      if (!user) {
        return res
          .status(401)
          .json({
            success:
              false,
            message:
              "Invalid refresh token",
          });
      }

      const token =
        generateToken(
          user._id
        );

      res.json({
        success:
          true,
        token,
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

// ================= LOGOUT =================
exports.logoutUser =
  async (req, res) => {
    try {
      const {
        userId,
      } = req.body;

      const user =
        await User.findById(
          userId
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

      user.refreshToken =
        null;

      user.deviceId =
        null;

      await user.save();

      res.json({
        success:
          true,
        message:
          "Logout successful",
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