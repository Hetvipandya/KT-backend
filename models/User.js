const mongoose =
  require("mongoose");

const bcrypt =
  require("bcryptjs");

const userSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      phoneNumber: {
        type: String,
        default: null,
        unique: true,
        sparse: true,
        trim: true,
        set: (value) => {
          if (value === undefined || value === null || value === "") {
            return null;
          }

          return String(value).trim();
        },
      },

      profileImage: {
        type: String,
        default: null,
        trim: true,
      },

      dob: {
        type: String,
        default: null,
        trim: true,
      },

      address: {
        type: String,
        default: null,
        trim: true,
      },

      department: {
        type: String,
        default: null,
        trim: true,
      },

      designation: {
        type: String,
        default: null,
        trim: true,
      },

      gender: {
        type: String,
        default: null,
        trim: true,
      },

      bloodGroup: {
        type: String,
        default: null,
        trim: true,
      },

      bankAccountNumber: {
        type: String,
        default: null,
        trim: true,
        set: (value) => {
          if (value === undefined || value === null || value === "") {
            return null;
          }

          return String(value).trim();
        },
      },

      ifscCode: {
        type: String,
        default: null,
        trim: true,
        uppercase: true,
        set: (value) => {
          if (value === undefined || value === null || value === "") {
            return null;
          }

          return String(value).trim().toUpperCase();
        },
      },

      password: {
        type: String,
        required: function () {
          return !this.passwordHash;
        },
      },

      passwordHash: {
        type: String,
        select: false,
        default: null,
      },

      // testing mate
      plainPassword: {
        type: String,
        default: null,
      },

      // ================= ROLE =================
      role: {
        type: String,
        enum: [
          "admin",
          "hr",
          "employee",
          "intern",
          "team lead", 
          "Accountant",
          "CA",
        ], 
      },

      // ================= APPROVAL =================
      isApproved: {
        type: Boolean,
        default: false,
      },

      // ================= FIRST LOGIN =================
      isFirstLogin: {
        type: Boolean,
        default: false,
      },

      mustChangePassword: {
        type: Boolean,
        default: false,
      },

      // ================= ACCOUNT STATUS =================
      isActive: {
        type: Boolean,
        default: true,
      },

      // ================= JWT =================
      refreshToken: {
        type: String,
        default: null,
      },

      // ================= OTP =================
      otpVerified: {
        type: Boolean,
        default: false,
      },

      forgotPasswordOTP: {
        type: String,
        default: null,
      },

      otpExpireTime: {
        type: Date,
        default: null,
      },

      // ================= PASSWORD RESET TOKEN =================
      passwordResetTokenHash: {
        type: String,
        default: null,
        select: false,
      },

      resetPasswordToken: {
        type: String,
        default: null,
        select: false,
      },

      passwordResetExpires: {
        type: Date,
        default: null,
        select: false,
      },

      resetPasswordExpires: {
        type: Date,
        default: null,
        select: false,
      },

      // ================= DEVICE TRACKING =================
      deviceId: {
        type: String,
        default: null,
      },

      lastLogin: {
        type: Date,
        default: null,
      },

      // ================= FCM PUSH NOTIFICATIONS =================
      notificationTokens: [
        {
          token: {
            type: String,
            required: true,
            trim: true,
          },
          deviceType: {
            type: String,
            default: "android",
          },
          createdAt: {
            type: Date,
            default: Date.now,
          },
          updatedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    {
      timestamps: true,
    }
  );

// ================= PRE SAVE =================
userSchema.pre(
  "save",
  async function (next) {
    try {
      if (this.isModified("password")) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(this.password, salt);

        this.password = hashedPassword;
        this.passwordHash = hashedPassword;

        return next();
      }

      if (this.isModified("passwordHash") && !this.isModified("password")) {
        this.password = this.passwordHash;
        return next();
      }

      return next();
    } catch (error) {
      return next(error);
    }
  }
);

// ================= PASSWORD MATCH =================
userSchema.methods.comparePassword =
  async function (
    enteredPassword
  ) {
    const hasTemporaryPasswordFlow =
      this.isFirstLogin === true ||
      this.mustChangePassword === true;

    const hashCandidates = [
      this.passwordHash,
      this.password,
    ].filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        value !== ""
    );

    if (!hashCandidates.length && !hasTemporaryPasswordFlow) {
      return false;
    }

    for (const candidate of hashCandidates) {
      try {
        const isHashMatch = await bcrypt.compare(
          enteredPassword,
          candidate
        );

        if (isHashMatch) {
          return true;
        }
      } catch (error) {
        // Ignore invalid hash values and continue.
      } 
    }

    if (hasTemporaryPasswordFlow && this.plainPassword) {
      if (String(this.plainPassword) === String(enteredPassword)) {
        return true;
      }
    }

    return false;
  };

module.exports =
  mongoose.model(
    "User",
    userSchema
  );