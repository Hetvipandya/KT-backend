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
        required: true,
        unique: true,
        trim: true,
      }, 

      dob: {
        type: String,
        required: true,
      },

      address: {
        type: String,
        required: true,
      },

      department: {
        type: String,
        required: true,
      },

      bloodGroup: {
        type: String,
        required: true,
      },
 
      uniqueID: {
        type: String,
        unique: true,
      },

      password: {
        type: String,
        required: true,
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

      // ================= DEVICE TRACKING =================
      deviceId: {
        type: String,
        default: null,
      },

      lastLogin: {
        type: Date,
        default: null,
      },
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
    return await bcrypt.compare(
      enteredPassword,
      this.password
    );
  };

module.exports =
  mongoose.model(
    "User",
    userSchema
  );