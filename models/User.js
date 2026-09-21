// const mongoose =
//   require("mongoose");

// const bcrypt =
//   require("bcryptjs");

// const userSchema =
//   new mongoose.Schema(
//     {
//       name: {
//         type: String,
//         required: true,
//         trim: true,
//       },

//       email: {
//         type: String,
//         required: true,
//         unique: true,
//         lowercase: true,
//         trim: true,
//       },

//       phoneNumber: {
//         type: String,
//         required: function () {
//           return this.role !== "admin";
//         },
//         unique: true,
//         sparse: true,
//         trim: true,
//       },

//       dob: {
//         type: String,
//         required: function () {
//           return this.role !== "admin";
//         },
//       },

//       address: {
//         type: String,
//         required: function () {
//           return this.role !== "admin";
//         },
//       },

//       department: {
//         type: String,
//         required: function () {
//           return this.role !== "admin";
//         },
//       },

//       designation: {
//         type: String,
//         required: function () {
//           return this.role !== "admin";
//         },
//         trim: true,
//       },

//       gender: {
//         type: String,
//         required: function () {
//           return this.role !== "admin";
//         },
//         trim: true,
//       },

//       bloodGroup: {
//         type: String,
//         required: function () {
//           return this.role !== "admin";
//         },
//       },

//       uniqueID: {
//         type: String,
//         unique: true,
//       },

//       password: {
//         type: String,
//         required: true,
//       },

//       // testing mate
//       plainPassword: {
//         type: String,
//         default: null,
//       },

//       // ================= ROLE =================
//       role: {
//         type: String,
//         enum: [
//           "admin",
//           "hr",
//           "employee",
//           "intern",
//           "teamlead",
//           "team lead",
//         ],
//       },

//       // ================= APPROVAL =================
//       isApproved: {
//         type: Boolean,
//         default: false,
//       },

//       // ================= FIRST LOGIN =================
//       isFirstLogin: {
//         type: Boolean,
//         default: true,
//       },

//       // ================= ACCOUNT STATUS =================
//       isActive: {
//         type: Boolean,
//         default: true,
//       },

//       // ================= JWT =================
//       refreshToken: {
//         type: String,
//         default: null,
//       },

//       // ================= OTP =================
//       otpVerified: {
//         type: Boolean,
//         default: false,
//       },

//       forgotPasswordOTP: {
//         type: String,
//         default: null,
//       },

//       otpExpireTime: {
//         type: Date,
//         default: null,
//       },

//       // ================= PASSWORD RESET TOKEN =================
//       resetPasswordToken: {
//         type: String,
//         default: null,
//       },

//       resetPasswordExpires: {
//         type: Date,
//         default: null,
//       },

//       // ================= DEVICE TRACKING =================
//       deviceId: {
//         type: String,
//         default: null,
//       },

//       lastLogin: {
//         type: Date,
//         default: null,
//       },

//       // ================= FCM PUSH NOTIFICATIONS =================
//       notificationTokens: [
//         {
//           token: {
//             type: String,
//             required: true,
//             trim: true,
//           },
//           deviceType: {
//             type: String,
//             default: "android",
//           },
//           createdAt: {
//             type: Date,
//             default: Date.now,
//           },
//           updatedAt: {
//             type: Date,
//             default: Date.now,
//           },
//         },
//       ],
//     },
//     {
//       timestamps: true,
//     }
//   );

// // ================= PRE SAVE =================
// userSchema.pre(
//   "save",
//   async function () {
//     try {
//       // ================= GENERATE UNIQUE ID =================
//       if (
//         !this.uniqueID
//       ) {
//         const lastUser =
//           await mongoose
//             .model("User")
//             .findOne()
//             .sort({
//               createdAt:
//                 -1,
//             });

//         let nextNumber =
//           1001;

//         if (
//           lastUser &&
//           lastUser.uniqueID
//         ) {
//           const lastNumber =
//             parseInt(
//               lastUser.uniqueID.replace(
//                 "NEW",
//                 ""
//               )
//             );

//           nextNumber =
//             lastNumber +
//             1;
//         }

//         this.uniqueID =
//           `NEW${nextNumber}`;
//       }

//       // ================= PASSWORD HASH =================
//       if (
//         this.isModified(
//           "password"
//         )
//       ) {
//         const salt =
//           await bcrypt.genSalt(
//             10
//           );

//         this.password =
//           await bcrypt.hash(
//             this.password,
//             salt
//           );
//       }

//     }  catch (error) {
//       throw error;
//     }
//   }
// );

// // ================= PASSWORD MATCH =================
// userSchema.methods.comparePassword =
//   async function (
//     enteredPassword
//   ) {
//     return await bcrypt.compare(
//       enteredPassword,
//       this.password
//     );
//   };

// module.exports =
//   mongoose.model(
//     "User",
//     userSchema
//   );

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ============================================================
// REFRESH TOKEN SCHEMA
// ============================================================

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
    },

    userAgent: {
      type: String,
      default: null,
    },

    ip: {
      type: String,
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
  },
);

// ============================================================
// COMPANY ACCESS SCHEMA
// ============================================================

const companyAccessSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    role: {
      type: String,
      required: true,
      default: "employee",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    invitedAt: {
      type: Date,
      default: null,
    },

    inviteSent: {
      type: Boolean,
      default: false,
    },

    joinedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  },
);

// ============================================================
// NOTIFICATION TOKEN SCHEMA
// ============================================================

const notificationTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      trim: true,
    },

    deviceType: {
      type: String,
      default: "android",
      trim: true,
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
  {
    _id: true,
  },
);

// ============================================================
// USER SCHEMA
// ============================================================

const userSchema = new mongoose.Schema(
  {
    // ========================================================
    // BASIC INFORMATION
    // ========================================================

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
      index: true,
    },

    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: null,
    },

    dob: {
      type: String,
      default: null,
    },

    address: {
      type: String,
      default: null,
    },

    department: {
      type: String,
      default: null,
    },

    designation: {
      type: String,
      trim: true,
      default: null,
    },

    gender: {
      type: String,
      trim: true,
      default: null,
    },

    bloodGroup: {
      type: String,
      trim: true,
      default: null,
    },

    // ========================================================
    // BANK ACCOUNT DETAILS
    // ========================================================

    bankAccountNumber: {
      type: String,
      trim: true,
      default: null,
    },

    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // ========================================================
    // UNIQUE USER ID
    // ========================================================

    uniqueID: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // ========================================================
    // PASSWORD
    // ========================================================

    /**
     * New authentication system
     */
    passwordHash: {
      type: String,
      default: null,
      select: false,
    },

    plainPassword: {
      type: String,
      default: null,
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    // ========================================================
    // ROLE
    // ========================================================

    role: {
      type: String,
      default: "user",
      trim: true,
    },

    // ========================================================
    // APPROVAL / ACCOUNT STATUS
    // ========================================================

    isApproved: {
      type: Boolean,
      default: false,
    },

    isFirstLogin: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ========================================================
    // EMAIL VERIFICATION
    // ========================================================

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // ========================================================
    // LOGIN SECURITY
    // ========================================================

    loginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    // Legacy field
    lastLogin: {
      type: Date,
      default: null,
    },

    // ========================================================
    // REFRESH TOKENS / SESSIONS
    // ========================================================

    refreshTokens: {
      type: [refreshTokenSchema],
      select: false,
      default: [],
    },

    // Legacy single refresh token
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    // ========================================================
    // PASSWORD RESET
    // ========================================================

    passwordResetTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },

    // Legacy reset password fields
    resetPasswordToken: {
      type: String,
      select: false,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    // ========================================================
    // EMAIL VERIFICATION TOKEN
    // ========================================================

    emailVerificationTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
      default: null,
    },

    // ========================================================
    // COMPANY / BRANCH / FINANCIAL YEAR
    // ========================================================

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    financialYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialYear",
      default: null,
    },

    // ========================================================
    // ONBOARDING FLAGS
    // ========================================================

    companyCreated: {
      type: Boolean,
      default: false,
    },

    branchCreated: {
      type: Boolean,
      default: false,
    },

    financialYearCreated: {
      type: Boolean,
      default: false,
    },

    // ========================================================
    // MULTI COMPANY ACCESS
    // ========================================================

    companyAccess: {
      type: [companyAccessSchema],
      default: [],
    },

    // ========================================================
    // DEVICE INFORMATION
    // ========================================================

    deviceId: {
      type: String,
      default: null,
    },

    deviceToken: {
      type: String,
      default: null,
    },

    // ========================================================
    // FCM NOTIFICATION TOKENS
    // ========================================================

    notificationTokens: {
      type: [notificationTokenSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// INDEXES
// ============================================================

userSchema.index({
  "companyAccess.companyId": 1,
});

userSchema.index({
  email: 1,
});

userSchema.index({
  uniqueID: 1,
});

// ============================================================
// VIRTUAL - CHECK ACCOUNT LOCK
// ============================================================

userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ============================================================
// PRE SAVE - UNIQUE ID + PASSWORD
// ============================================================

userSchema.pre("save", async function (next) {
  try {
    // --------------------------------------------------------
    // Generate Unique ID
    // --------------------------------------------------------

    if (!this.uniqueID) {
      const lastUser = await mongoose.model("User").findOne().sort({
        createdAt: -1,
      });

      let nextNumber = 1001;

      if (lastUser && lastUser.uniqueID) {
        const lastNumber = parseInt(lastUser.uniqueID.replace("NEW", ""), 10);

        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      this.uniqueID = `NEW${nextNumber}`;
    }

    // --------------------------------------------------------
    // Password Hashing
    // --------------------------------------------------------

    if (this.isModified("passwordHash") && this.passwordHash) {
      if (
        !this.passwordHash.startsWith("$2a$") &&
        !this.passwordHash.startsWith("$2b$") &&
        !this.passwordHash.startsWith("$2y$")
      ) {
        this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
      }
    }

    // --------------------------------------------------------
    // Onboarding Flags
    // --------------------------------------------------------

    if (this.companyId) {
      this.companyCreated = true;
    }

    if (this.branchId) {
      this.branchCreated = true;
    }

    if (this.financialYearId) {
      this.financialYearCreated = true;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// PASSWORD COMPARE METHOD
// ============================================================

userSchema.methods.comparePassword = async function (enteredPassword) {
  const hash = this.passwordHash;

  if (!hash) {
    return false;
  }

  return await bcrypt.compare(enteredPassword, hash);
};

// ============================================================
// GET PASSWORD HASH
// ============================================================

userSchema.methods.getPasswordHash = function () {
  return this.passwordHash || null;
};

// ============================================================
// EXPORT MODEL
// ============================================================

const User = mongoose.model("User", userSchema);

module.exports = User;
