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

      profileImg: {
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
        select: false,
        required: function () {
          return !this.passwordHash;
        },
      },

      passwordHash: {
        type: String,
        select: false,
        default: null,
      },

      uniqueID: {
        type: String,
        default: null,
        trim: true,
        sparse: true,
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

// Ensure sensitive password fields are never serialized in API responses
userSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.passwordHash;
    delete ret.plainPassword;
    const imgUrl = ret.profileImage || ret.profileImg || null;
    ret.profileImage = imgUrl;
    ret.profileImg = imgUrl;
    ret.profilePhoto = imgUrl;
    return ret;
  },
});
userSchema.set("toObject", {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.passwordHash;
    delete ret.plainPassword;
    const imgUrl = ret.profileImage || ret.profileImg || null;
    ret.profileImage = imgUrl;
    ret.profileImg = imgUrl;
    ret.profilePhoto = imgUrl;
    return ret;
  },
});

// ================= PRE SAVE =================
userSchema.pre(
  "save",
  async function (next) {
    try {
      if (this.profileImage && !this.profileImg) {
        this.profileImg = this.profileImage;
      } else if (this.profileImg && !this.profileImage) {
        this.profileImage = this.profileImg;
      }

      if (this.isModified("password") && this.password) {
        if (!this.password.startsWith("$2a$") && !this.password.startsWith("$2b$")) {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(this.password, salt);
          this.password = hashedPassword;
          this.passwordHash = hashedPassword;
        } else {
          this.passwordHash = this.password;
        }
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
    if (!enteredPassword) return false;

    const hashCandidates = [
      this.passwordHash,
      this.password,
    ].filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        value !== ""
    );

    for (const candidate of hashCandidates) {
      if (typeof candidate === "string") {
        if (candidate.startsWith("$2a$") || candidate.startsWith("$2b$")) {
          try {
            const isHashMatch = await bcrypt.compare(
              String(enteredPassword),
              candidate
            );
            if (isHashMatch) {
              return true;
            }
          } catch (error) {
            // Ignore invalid hash values and continue.
          }
        } else if (candidate === String(enteredPassword)) {
          // Self-healing migration for legacy unhashed passwords:
          // Immediately upgrade to bcrypt hash in DB
          try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(String(enteredPassword), salt);
            this.password = hashedPassword;
            this.passwordHash = hashedPassword;
            this.plainPassword = undefined;
            await this.save();
          } catch (err) {
            // ignore save error during auth check
          }
          return true;
        }
      }
    }

    return false;
  };

module.exports =
  mongoose.model(
    "User",
    userSchema
  );