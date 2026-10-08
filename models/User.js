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

      bankName: {
        type: String,
        default: null,
        trim: true,
      },

      bankBranch: {
        type: String,
        default: null,
        trim: true,
      },

      accountHolderName: {
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

      upiId: {
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

      isBankDetailGiven: {
        type: Boolean,
        default: false,
        get: function(v) {
          if (v) return true;
          const doc = this._doc || this;
          return Boolean(doc.bankDetailGiven || doc.bankDetailsGiven || doc.bankAccountNumber || doc.ifscCode || doc.upiId || doc.bankName);
        },
        set: (val) => String(val) === "true" || val === true || val === 1 || String(val) === "1",
      },

      bankDetailGiven: {
        type: Boolean,
        default: false,
        get: function(v) {
          if (v) return true;
          const doc = this._doc || this;
          return Boolean(doc.isBankDetailGiven || doc.bankDetailsGiven || doc.bankAccountNumber || doc.ifscCode || doc.upiId || doc.bankName);
        },
        set: (val) => String(val) === "true" || val === true || val === 1 || String(val) === "1",
      },

      bankDetailsGiven: {
        type: Boolean,
        default: false,
        get: function(v) {
          if (v) return true;
          const doc = this._doc || this;
          return Boolean(doc.isBankDetailGiven || doc.bankDetailGiven || doc.bankAccountNumber || doc.ifscCode || doc.upiId || doc.bankName);
        },
        set: (val) => String(val) === "true" || val === true || val === 1 || String(val) === "1",
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

      // ================= COMPANY & BRANCH =================
      companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        default: null,
        index: true,
      },

      branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        default: null,
        index: true,
      },

      financialYearId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FinancialYear",
        default: null,
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

// Virtual for upiID / upi / upiId interchangeability
userSchema.virtual("upiID").get(function () {
  return this.upiId;
}).set(function (val) {
  this.upiId = val;
});

userSchema.virtual("upi").get(function () {
  return this.upiId;
}).set(function (val) {
  this.upiId = val;
});

// Virtual for bankDetails Given interchangeability
userSchema.virtual("isBankDetailsGiven").get(function () {
  return Boolean(
    this.isBankDetailGiven ||
    this.bankDetailGiven ||
    this.bankDetailsGiven ||
    this.bankAccountNumber ||
    this.ifscCode ||
    this.upiId ||
    this.bankName
  );
}).set(function (val) {
  const bVal = String(val) === "true" || val === true || val === 1 || String(val) === "1";
  this.isBankDetailGiven = bVal;
  this.bankDetailGiven = bVal;
  this.bankDetailsGiven = bVal;
});

// Virtual for bankDetails object
userSchema.virtual("bankDetails").get(function () {
  const isBankGiven = Boolean(
    this.isBankDetailGiven ||
    this.bankDetailGiven ||
    this.bankDetailsGiven ||
    this.bankAccountNumber ||
    this.ifscCode ||
    this.upiId ||
    this.bankName
  );
  return {
    bankName: this.bankName || null,
    bankAccountNumber: this.bankAccountNumber || null,
    accountNumber: this.bankAccountNumber || null,
    ifscCode: this.ifscCode || null,
    IFSC: this.ifscCode || null,
    upiId: this.upiId || null,
    upiID: this.upiId || null,
    upi: this.upiId || null,
    bankBranch: this.bankBranch || null,
    accountHolderName: this.accountHolderName || null,
    isBankDetailGiven: isBankGiven,
    bankDetailGiven: isBankGiven,
    bankDetailsGiven: isBankGiven,
    isBankDetailsGiven: isBankGiven,
  };
}).set(function (details) {
  if (details && typeof details === "object") {
    if (details.bankName !== undefined) this.bankName = details.bankName;
    if (details.bankAccountNumber !== undefined) this.bankAccountNumber = details.bankAccountNumber;
    if (details.accountNumber !== undefined && !this.bankAccountNumber) this.bankAccountNumber = details.accountNumber;
    if (details.ifscCode !== undefined) this.ifscCode = details.ifscCode;
    if (details.IFSC !== undefined && !this.ifscCode) this.ifscCode = details.IFSC;
    if (details.upiId !== undefined) this.upiId = details.upiId;
    if (details.upiID !== undefined && !this.upiId) this.upiId = details.upiID;
    if (details.upi !== undefined && !this.upiId) this.upiId = details.upi;
    if (details.bankBranch !== undefined) this.bankBranch = details.bankBranch;
    if (details.accountHolderName !== undefined) this.accountHolderName = details.accountHolderName;
    const bGiven = details.isBankDetailGiven ?? details.bankDetailGiven ?? details.bankDetailsGiven ?? details.isBankDetailsGiven;
    if (bGiven !== undefined) {
      const bBool = String(bGiven) === "true" || bGiven === true || bGiven === 1 || String(bGiven) === "1";
      this.isBankDetailGiven = bBool;
      this.bankDetailGiven = bBool;
      this.bankDetailsGiven = bBool;
    }
  }
});

const transformUserObject = function (doc, ret) {
  delete ret.password;
  delete ret.passwordHash;
  delete ret.plainPassword;
  const imgUrl = ret.profileImage || ret.profileImg || null;
  ret.profileImage = imgUrl;
  ret.profileImg = imgUrl;
  ret.profilePhoto = imgUrl;
  ret.upiId = ret.upiId || null;
  ret.upiID = ret.upiId || null;
  ret.upi = ret.upiId || null;

  const isBankGiven = Boolean(
    ret.isBankDetailGiven ||
    ret.bankDetailGiven ||
    ret.bankDetailsGiven ||
    ret.isBankDetailsGiven ||
    ret.bankAccountNumber ||
    ret.ifscCode ||
    ret.upiId ||
    ret.bankName
  );
  ret.isBankDetailGiven = isBankGiven;
  ret.bankDetailGiven = isBankGiven;
  ret.bankDetailsGiven = isBankGiven;
  ret.isBankDetailsGiven = isBankGiven;

  ret.bankDetails = {
    bankName: ret.bankName || null,
    bankAccountNumber: ret.bankAccountNumber || null,
    accountNumber: ret.bankAccountNumber || null,
    ifscCode: ret.ifscCode || null,
    IFSC: ret.ifscCode || null,
    upiId: ret.upiId || null,
    upiID: ret.upiId || null,
    upi: ret.upiId || null,
    bankBranch: ret.bankBranch || null,
    accountHolderName: ret.accountHolderName || null,
    isBankDetailGiven: isBankGiven,
    bankDetailGiven: isBankGiven,
    bankDetailsGiven: isBankGiven,
    isBankDetailsGiven: isBankGiven,
  };
  return ret;
};

// Ensure sensitive password fields are never serialized in API responses
userSchema.set("toJSON", { transform: transformUserObject });
userSchema.set("toObject", { transform: transformUserObject });

// ================= PRE SAVE =================
userSchema.pre(
  "save",
  async function (next) {
    try {
      const hasBankData = Boolean(
        this.isBankDetailGiven ||
        this.bankDetailGiven ||
        this.bankDetailsGiven ||
        this.bankAccountNumber ||
        this.ifscCode ||
        this.upiId ||
        this.bankName
      );
      this.isBankDetailGiven = hasBankData;
      this.bankDetailGiven = hasBankData;
      this.bankDetailsGiven = hasBankData;

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

// ================= CASCADE DELETE HOOKS =================
userSchema.pre("findOneAndDelete", async function () {
  try {
    const options = this.getOptions();
    if (options && options.skipCascade) return;

    const query = this.getQuery();
    const docToDelete = await this.model.findOne(query);
    if (docToDelete) {
      const { cascadeDeleteUser } = require("../utils/userCascadeDelete");
      await cascadeDeleteUser(docToDelete);
    }
  } catch (err) {
    console.error("User pre findOneAndDelete cascade error:", err);
  }
});

userSchema.pre("deleteOne", { document: false, query: true }, async function () {
  try {
    const options = this.getOptions();
    if (options && options.skipCascade) return;

    const query = this.getQuery();
    const docToDelete = await this.model.findOne(query);
    if (docToDelete) {
      const { cascadeDeleteUser } = require("../utils/userCascadeDelete");
      await cascadeDeleteUser(docToDelete);
    }
  } catch (err) {
    console.error("User pre deleteOne query cascade error:", err);
  }
});

userSchema.pre("deleteOne", { document: true, query: false }, async function () {
  try {
    const { cascadeDeleteUser } = require("../utils/userCascadeDelete");
    await cascadeDeleteUser(this);
  } catch (err) {
    console.error("User pre deleteOne doc cascade error:", err);
  }
});

module.exports =
  mongoose.model(
    "User",
    userSchema
  );