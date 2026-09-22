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

      uniqueID: {
        type: String,
        unique: true,
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
          "teamlead",
          "team lead",
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
        default: true,
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
  async function () {
    try {
      // ================= GENERATE UNIQUE ID =================
      if (
        !this.uniqueID
      ) {
        const lastUser =
          await mongoose
            .model("User")
            .findOne()
            .sort({
              createdAt:
                -1,
            });

        let nextNumber =
          1001;

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
            lastNumber +
            1;
        }

        this.uniqueID =
          `NEW${nextNumber}`;
      }

      // ================= PASSWORD HASH =================
      if (
        this.isModified(
          "password"
        )
      ) {
        const salt =
          await bcrypt.genSalt(
            10
          );

        this.password =
          await bcrypt.hash(
            this.password,
            salt
          );

        this.passwordHash = this.password;
      } else if (
        this.isModified("passwordHash") &&
        this.passwordHash
      ) {
        this.password = this.passwordHash;
      } else if (
        this.password &&
        !this.passwordHash
      ) {
        this.passwordHash = this.password;
      }

    }  catch (error) {
      throw error;
    }
  }
);

// ================= PASSWORD MATCH =================
userSchema.methods.comparePassword =
  async function (
    enteredPassword
  ) {
    const storedPassword =
      this.passwordHash || this.password;

    if (!storedPassword) {
      return false;
    }

    return await bcrypt.compare(
      enteredPassword,
      storedPassword
    );
  };

module.exports =
  mongoose.model(
    "User",
    userSchema
  );