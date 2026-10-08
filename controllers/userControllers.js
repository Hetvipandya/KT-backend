const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const Branch = require("../models/Branch");
const SalaryStructure = require("../models/SalaryStructure");
const MonthlySalary = require("../models/MonthlySalary");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const {
  sendEmail,
  sendTemporaryPasswordEmail,
} = require("../services/email.service");
const {
  buildResetPasswordEmailContent,
} = require("../services/email.templates");
const sanitizeUserUpdatePayload = require("../utils/userPayloadSanitizer");

const buildLoginLookupQuery = (loginInput) => {
  const normalized = String(loginInput || "").trim();

  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();

  return {
    $or: [
      { email: lower },
      { phoneNumber: normalized },
      { name: normalized },
    ],
  };
};

const applyPasswordUpdate = (user, newPassword) => {
  if (!user || !newPassword) {
    return user;
  }

  const normalizedPassword = String(newPassword).trim();

  if (!normalizedPassword) {
    return user;
  }

  user.password = normalizedPassword;
  user.passwordHash = undefined;

  return user;
};

const normalizeResetToken = (tokenValue) => {
  const tokenString = String(tokenValue ?? "").trim();

  if (!tokenString) {
    return null;
  }

  return {
    tokenString,
    tokenHash: crypto
      .createHash("sha256")
      .update(tokenString)
      .digest("hex"),
  };
};

const clearResetTokenFields = (user) => {
  if (!user) {
    return user;
  }

  user.passwordResetTokenHash = null;
  user.resetPasswordToken = null;
  user.passwordResetExpires = null;
  user.resetPasswordExpires = null;

  return user;
};

const applySuccessfulLoginState = (user, { deviceId = null } = {}) => {
  if (!user) {
    return user;
  }

  const shouldForcePasswordChange = Boolean(
    user.mustChangePassword || user.isFirstLogin,
  );

  user.refreshToken = user.refreshToken || null;
  user.deviceId = deviceId || user.deviceId || null;
  user.lastLogin = new Date();
  user.lastLoginAt = new Date();

  if (shouldForcePasswordChange) {
    user.isFirstLogin = true;
    user.mustChangePassword = true;
  } else {
    user.isFirstLogin = false;
    user.mustChangePassword = false;
  }

  return user;
};

const shouldRequireApproval = (role) => {
  if (!role) {
    return false;
  }

  const normalized = String(role).trim().toLowerCase();
  const exemptRoles = ["admin", "hr", "accountant", "ca"];

  return !exemptRoles.includes(normalized);
};
 
const buildResetPasswordUrl = (req, token) => {
  const host = req.get("host");

  if (host) {
    const protocol = host.includes("localhost") ? req.protocol : "https";
    return `${protocol}://${host}/api/users/reset-password?token=${encodeURIComponent(token)}`;
  }

  const fallbackBase =
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:5000";

  return `${fallbackBase.replace(/\/+$/, "")}/api/users/reset-password?token=${encodeURIComponent(token)}`;
};

// ============================================================
// EMAIL CONFIGURATION
// ============================================================

const transporter = nodemailer.createTransport({
  service: "gmail",
 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ============================================================
// JWT TOKEN
// ============================================================

const generateToken = (userId) => {
  return jwt.sign(
    { 
      id: userId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
};

// ============================================================
// ROLE NORMALIZER
// ============================================================

const normalizeRole = (role) => {
  if (!role) {
    return "";
  }

  const normalized = role.toString().trim().toLowerCase();

  if (
    normalized === "teamlead" ||
    normalized === "team_lead" ||
    normalized === "tl"
  ) {
    return "team lead";
  }

  return normalized;
};

const resolveProfileImage = (user) => {
  if (!user) {
    return "";
  }

  return (
    user.profileImage ||
    user.profileImg ||
    user.profilePhoto ||
    user.profile_img ||
    user.photo ||
    user.imageUrl ||
    user.avatar ||
    ""
  );
};

// ============================================================
// EMPLOYEE ID GENERATOR
// ============================================================

const generateEmployeeID = async () => {
  const lastEmployee = await Employee.findOne({
    employeeID: {
      $regex: /^EMP\d+$/,
    },
  }).sort({
    createdAt: -1,
  });

  let nextNumber = 1001;

  if (lastEmployee && lastEmployee.employeeID) {
    const lastNumber = parseInt(lastEmployee.employeeID.replace("EMP", ""), 10);

    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `EMP${nextNumber}`;
};

// ============================================================
// BUILD USER RESPONSE
// ============================================================

const buildUserResponse = (user) => {
  if (!user) {
    return null;
  }

  const profileImgUrl = resolveProfileImage(user) || null;
  const isBankGiven = Boolean(
    user.isBankDetailGiven ||
    user.bankDetailGiven ||
    user.bankDetailsGiven ||
    user.isBankDetailsGiven ||
    user.bankAccountNumber ||
    user.ifscCode ||
    user.upiId ||
    user.bankName
  );

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phoneNumber ?? user.phone ?? null,
    phoneNumber: user.phoneNumber ?? user.phone ?? null,
    dob: user.dob,
    address: user.address,
    profileImage: profileImgUrl,
    profileImg: profileImgUrl,
    profilePhoto: profileImgUrl,
    avatar: profileImgUrl,
    department: user.department,
    designation: user.designation,
    gender: user.gender,
    bloodGroup: user.bloodGroup,

    bankName: user.bankName || (user.bankDetails && user.bankDetails.bankName) || null,
    bankBranch: user.bankBranch || (user.bankDetails && user.bankDetails.bankBranch) || null,
    accountHolderName: user.accountHolderName || (user.bankDetails && user.bankDetails.accountHolderName) || null,
    bankAccount: user.bankAccountNumber || user.bankAccount || null,
    bankAccountNumber: user.bankAccountNumber || user.bankAccount || null,

    IFSC: user.ifscCode || user.IFSC || null,
    ifscCode: user.ifscCode || user.IFSC || null,

    upiId: user.upiId || user.upiID || user.upi || null,
    upiID: user.upiId || user.upiID || user.upi || null,
    upi: user.upiId || user.upiID || user.upi || null,

    isBankDetailGiven: isBankGiven,
    bankDetailGiven: isBankGiven,
    bankDetailsGiven: isBankGiven,
    isBankDetailsGiven: isBankGiven,

    bankDetails: {
      bankName: user.bankName || (user.bankDetails && user.bankDetails.bankName) || null,
      bankAccountNumber: user.bankAccountNumber || user.bankAccount || null,
      accountNumber: user.bankAccountNumber || user.bankAccount || null,
      ifscCode: user.ifscCode || user.IFSC || null,
      IFSC: user.ifscCode || user.IFSC || null,
      upiId: user.upiId || user.upiID || user.upi || null,
      upiID: user.upiId || user.upiID || user.upi || null,
      upi: user.upiId || user.upiID || user.upi || null,
      bankBranch: user.bankBranch || (user.bankDetails && user.bankDetails.bankBranch) || null,
      accountHolderName: user.accountHolderName || (user.bankDetails && user.bankDetails.accountHolderName) || null,
      isBankDetailGiven: isBankGiven,
      bankDetailGiven: isBankGiven,
      bankDetailsGiven: isBankGiven,
      isBankDetailsGiven: isBankGiven,
    },

    termsAndConditions: Boolean(user.termsAndConditions || user.termsAccepted || user.isTermsAccepted || user.termsAndConditionsAccepted),
    termsAccepted: Boolean(user.termsAndConditions || user.termsAccepted || user.isTermsAccepted || user.termsAndConditionsAccepted),
    isTermsAccepted: Boolean(user.termsAndConditions || user.termsAccepted || user.isTermsAccepted || user.termsAndConditionsAccepted),
    termsAndConditionsAccepted: Boolean(user.termsAndConditions || user.termsAccepted || user.isTermsAccepted || user.termsAndConditionsAccepted),

    uniqueID: user.uniqueID,
    role: user.role,

    isApproved: user.isApproved,
    isFirstLogin: user.isFirstLogin,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,

    companyId: user.companyId,
    branchId: user.branchId,
    financialYearId: user.financialYearId,

    companyCreated: user.companyCreated,

    branchCreated: user.branchCreated,

    financialYearCreated: user.financialYearCreated,

    companyAccess: user.companyAccess || [],

    deviceId: user.deviceId || null,

    lastLogin: user.lastLogin || null,

    createdAt: user.createdAt,

    updatedAt: user.updatedAt,
  };
};

// ============================================================
// CREATE EMPLOYEE RECORD
// ============================================================

const createEmployeeForUser = async (user) => {
  if (!user) {
    return null;
  }

  const role = normalizeRole(user.role);

  // Employee, intern, and team lead accounts receive an EMP employeeID.
  if (role !== "employee" && role !== "intern" && role !== "team lead") {
    return null;
  }

  // Avoid duplicate Employee record
  let employee = await Employee.findOne({
    userID: user._id,
  });

  if (employee) {
    return employee;
  }

  const employeeID = await generateEmployeeID();

  employee = await Employee.create({
    employeeID,

    userID: user._id,

    firstName: user.name || "",

    lastName: "",

    email: user.email || "",

    phoneNumber: user.phoneNumber || user.phone || "",

    profileImage: resolveProfileImage(user),
    profileImg: resolveProfileImage(user),

    dob: user.dob || "",

    bloodGroup: user.bloodGroup || "",

    currentAddress: user.address || "",

    permanentAddress: user.address || "",

    designation:
      user.designation || (role === "team lead" ? "Team Lead" : "Employee"),

    department: user.department || "",

    joiningDate: new Date(),

    employeeStatus: "Active",

    isTeamLead: role === "team lead",
  });

  return employee;
};

// ============================================================
// UPDATE EMPLOYEE FROM USER
// ============================================================

const syncUserToEmployee = async (user) => {
  if (!user) {
    return null;
  }

  const employee = await Employee.findOne({
    $or: [{ userID: user._id }, { userId: user._id }],
  });

  if (!employee) {
    return null;
  }

  employee.firstName = user.name || employee.firstName;

  employee.email = user.email || employee.email;

  employee.phoneNumber = user.phoneNumber || user.phone || employee.phoneNumber || "";

  const syncedProfileImg = resolveProfileImage(user) || employee.profileImage || employee.profileImg || "";
  employee.profileImage = syncedProfileImg;
  employee.profileImg = syncedProfileImg;

  employee.dob = user.dob || employee.dob;

  employee.bloodGroup = user.bloodGroup || employee.bloodGroup;

  employee.currentAddress = user.address || employee.currentAddress;

  employee.permanentAddress = user.address || employee.permanentAddress;

  employee.department = user.department || employee.department;

  employee.designation =
    user.designation ||
    (normalizeRole(user.role) === "team lead"
      ? "Team Lead"
      : employee.designation);

  employee.isTeamLead = normalizeRole(user.role) === "team lead";

  await employee.save();

  return employee;
};

// ============================================================
// HRMS
// UPDATE MY PROFILE
// ============================================================

const updateProfile = async (req, res) => {
  try {
    const payload = sanitizeUserUpdatePayload(req.body?.user || req.body);

    const uploadedPath = req.file?.path || req.file?.secure_url || req.file?.url;
    if (uploadedPath) {
      payload.profileImage = uploadedPath;
      payload.profileImg = uploadedPath;
    }

    const profileImageField = [
      "profileImage",
      "profileImg",
      "profilePhoto",
      "photo",
      "imageUrl",
      "avatar",
    ].find((field) => Object.prototype.hasOwnProperty.call(payload, field));

    const {
      name,
      email,
      phoneNumber,
      phone, 
      dob,
      address,
      department,
      designation,
      gender,
      bloodGroup,
      bankAccountNumber,
      ifscCode,
      upiId,
      upiID,
      upi,
    } = payload;

    const resolvedPhoneNumber = phoneNumber ?? phone ?? null;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // --------------------------------------------------------
    // EMAIL DUPLICATE
    // --------------------------------------------------------

    if (email && email.toLowerCase() !== user.email) {
      const existingEmail = await User.findOne({
        email: email.trim().toLowerCase(),

        _id: {
          $ne: user._id,
        },
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // --------------------------------------------------------
    // PHONE DUPLICATE
    // --------------------------------------------------------

    if (resolvedPhoneNumber && resolvedPhoneNumber !== user.phoneNumber) {
      const existingPhone = await User.findOne({
        phoneNumber: resolvedPhoneNumber,

        _id: {
          $ne: user._id,
        },
      });

      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already exists",
        });
      }
    }

    // --------------------------------------------------------
    // UPDATE BASIC DETAILS
    // --------------------------------------------------------

    if (name !== undefined) {
      user.name = name;
    }

    if (email !== undefined) {
      user.email = email.trim().toLowerCase();
    }

    if (resolvedPhoneNumber !== undefined && resolvedPhoneNumber !== null) {
      user.phoneNumber = resolvedPhoneNumber;
    }

    if (dob !== undefined) {
      user.dob = dob;
    }

    if (address !== undefined) {
      user.address = address;
    }

    if (department !== undefined) {
      user.department = department;
    }

    if (designation !== undefined) {
      user.designation = designation;
    }

    if (gender !== undefined) {
      user.gender = gender;
    }

    if (bloodGroup !== undefined) {
      user.bloodGroup = bloodGroup;
    }

    if (profileImageField) {
      const rawProfileImage = payload[profileImageField];
      if (rawProfileImage) {
        const { uploadProfileImage: uploadToCloudinary } = require("../services/cloudinary.service");
        const uploadResult = await uploadToCloudinary(rawProfileImage, user._id || user.email);
        const finalUrl = uploadResult.secure_url || String(rawProfileImage).trim();
        user.profileImage = finalUrl;
        user.profileImg = finalUrl;
      } else {
        user.profileImage = "";
        user.profileImg = "";
      }
    }

    // --------------------------------------------------------
    // BANK DETAILS & TERMS AND CONDITIONS
    // --------------------------------------------------------

    const bankDetailsObj = payload.bankDetails && typeof payload.bankDetails === "object" ? payload.bankDetails : {};

    const resolvedBankName = payload.bankName ?? bankDetailsObj.bankName;
    if (resolvedBankName !== undefined) {
      user.bankName = resolvedBankName;
    }

    const resolvedBankBranch = payload.bankBranch ?? bankDetailsObj.bankBranch;
    if (resolvedBankBranch !== undefined) {
      user.bankBranch = resolvedBankBranch;
    }

    const resolvedAccountHolderName = payload.accountHolderName ?? bankDetailsObj.accountHolderName;
    if (resolvedAccountHolderName !== undefined) {
      user.accountHolderName = resolvedAccountHolderName;
    }

    const resolvedBankAccount =
      bankAccountNumber !== undefined
        ? bankAccountNumber
        : payload.bankAccount !== undefined
        ? payload.bankAccount
        : payload.accountNumber !== undefined
        ? payload.accountNumber
        : bankDetailsObj.bankAccountNumber !== undefined
        ? bankDetailsObj.bankAccountNumber
        : bankDetailsObj.accountNumber;

    if (resolvedBankAccount !== undefined) {
      user.bankAccountNumber = resolvedBankAccount;
    }

    const resolvedIfscCode =
      ifscCode !== undefined
        ? ifscCode
        : payload.IFSC !== undefined
        ? payload.IFSC
        : bankDetailsObj.ifscCode !== undefined
        ? bankDetailsObj.ifscCode
        : bankDetailsObj.IFSC;

    if (resolvedIfscCode !== undefined) {
      user.ifscCode =
        typeof resolvedIfscCode === "string"
          ? resolvedIfscCode.trim().toUpperCase()
          : resolvedIfscCode;
    }

    const resolvedUpiId =
      upiId !== undefined
        ? upiId
        : upiID !== undefined
        ? upiID
        : upi !== undefined
        ? upi
        : payload.upi_id !== undefined
        ? payload.upi_id
        : bankDetailsObj.upiId !== undefined
        ? bankDetailsObj.upiId
        : bankDetailsObj.upiID !== undefined
        ? bankDetailsObj.upiID
        : bankDetailsObj.upi;

    if (resolvedUpiId !== undefined) {
      user.upiId = resolvedUpiId;
    }

    const rawTerms =
      payload.termsAndConditions ??
      payload.termsAccepted ??
      payload.isTermsAccepted ??
      payload.termsAndConditionsAccepted ??
      payload.terms;

    if (rawTerms !== undefined) {
      const termsBool = String(rawTerms) === "true" || rawTerms === true || rawTerms === 1 || String(rawTerms) === "1";
      user.termsAndConditions = termsBool;
      user.termsAccepted = termsBool;
    }

    await user.save();

    // --------------------------------------------------------
    // USER -> EMPLOYEE SYNC
    // --------------------------------------------------------

    const employee = await syncUserToEmployee(user);

    return res.status(200).json({
      success: true,

      message: "Profile updated successfully",

      profile: buildUserResponse(user),

      employee: employee || null,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// HRMS
// GET MY PROFILE
// ============================================================

const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const employee = await Employee.findOne({
      $or: [{ userID: user._id }, { userId: user._id }],
    }).lean();

    if (employee) {
      const empImg = employee.profileImage || employee.profileImg || resolveProfileImage(user) || "";
      employee.profileImage = empImg;
      employee.profileImg = empImg;
      employee.profilePhoto = empImg;
    }

    return res.status(200).json({
      success: true,

      profile: buildUserResponse(user),

      employee: employee || null,
    });
  } catch (error) {
    console.error("Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// HRMS
// REGISTER USER
// ============================================================

const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      phone,
      dob,
      address,
      department,
      designation,
      gender,
      bloodGroup,
      bankAccountNumber,
      ifscCode,
      upiId,
      upiID,
      upi,
      role,
      profileImage,
      profileImg,
      profilePhoto,
      photo,
      imageUrl,
      avatar,
    } = req.body;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    const resolvedPhoneNumber = phoneNumber ?? phone ?? null;
    const uploadedPath = req.file?.path || req.file?.secure_url || req.file?.url;
    const rawProfileImage =
      uploadedPath ||
      profileImage ||
      profileImg ||
      profilePhoto ||
      photo ||
      imageUrl ||
      avatar ||
      null;

    if (
      !name ||
      !email ||
      !resolvedPhoneNumber ||
      !dob ||
      !address ||
      !department ||
      !bloodGroup ||
      !role
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields are required",
      });
    }

    // --------------------------------------------------------
    // NORMALIZE ROLE
    // --------------------------------------------------------

    const normalizedRole = normalizeRole(role);

    const allowedRoles = [
      "employee",
      "team lead",
      "hr",
      "intern",
      "admin",
      "user",
    ];

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role selected",
      });
    }

    // --------------------------------------------------------
    // NORMALIZE EMAIL
    // --------------------------------------------------------

    const normalizedEmail = email.trim().toLowerCase();

    const normalizedPhoneNumber = String(resolvedPhoneNumber).trim();
    let normalizedProfileImage = null;
    if (rawProfileImage) {
      const { uploadProfileImage: uploadToCloudinary } = require("../services/cloudinary.service");
      const uploadResult = await uploadToCloudinary(
        rawProfileImage,
        normalizedEmail || "user"
      );
      normalizedProfileImage = uploadResult.secure_url || String(rawProfileImage).trim();
    }

    // --------------------------------------------------------
    // CHECK EXISTING USER
    // --------------------------------------------------------

    const existingUser = await User.findOne({
      $or: [
        {
          email: normalizedEmail,
        },
        {
          phoneNumber: normalizedPhoneNumber,
        },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // --------------------------------------------------------
    // GENERATE TEMPORARY PASSWORD
    // --------------------------------------------------------

    const generatedPassword = crypto
      .randomBytes(6)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 8);

    // --------------------------------------------------------
    // CREATE USER
    // --------------------------------------------------------

    const user = await User.create({
      name: name.trim(),

      email: normalizedEmail,

      // IMPORTANT:
      // Schema field is phoneNumber, NOT phone
      phoneNumber: normalizedPhoneNumber,

      profileImage: normalizedProfileImage,
      profileImg: normalizedProfileImage,

      dob,

      address: address.trim(),

      department: department.trim(),

      designation:
        designation ||
        (normalizedRole === "team lead"
          ? "Team Lead"
          : normalizedRole === "employee"
            ? "Employee"
            : ""),

      gender,

      bloodGroup,

      bankName: req.body.bankName || req.body.bankDetails?.bankName || null,
      bankBranch: req.body.bankBranch || req.body.bankDetails?.bankBranch || null,
      accountHolderName: req.body.accountHolderName || req.body.bankDetails?.accountHolderName || null,

      bankAccountNumber:
        bankAccountNumber || req.body.bankAccount || req.body.accountNumber || req.body.bankDetails?.bankAccountNumber || req.body.bankDetails?.accountNumber || null,

      ifscCode: ifscCode
        ? ifscCode.trim().toUpperCase()
        : req.body.IFSC
        ? req.body.IFSC.trim().toUpperCase()
        : req.body.bankDetails?.ifscCode
        ? req.body.bankDetails.ifscCode.trim().toUpperCase()
        : req.body.bankDetails?.IFSC
        ? req.body.bankDetails.IFSC.trim().toUpperCase()
        : null,

      upiId:
        upiId !== undefined
          ? upiId
          : upiID !== undefined
          ? upiID
          : upi !== undefined
          ? upi
          : req.body.upi_id !== undefined
          ? req.body.upi_id
          : req.body.bankDetails?.upiId !== undefined
          ? req.body.bankDetails.upiId
          : req.body.bankDetails?.upiID !== undefined
          ? req.body.bankDetails.upiID
          : req.body.bankDetails?.upi !== undefined
          ? req.body.bankDetails.upi
          : null,

      termsAndConditions:
        req.body.termsAndConditions !== undefined
          ? String(req.body.termsAndConditions) === "true" || req.body.termsAndConditions === true || req.body.termsAndConditions === 1
          : req.body.termsAccepted !== undefined
          ? String(req.body.termsAccepted) === "true" || req.body.termsAccepted === true || req.body.termsAccepted === 1
          : req.body.isTermsAccepted !== undefined
          ? String(req.body.isTermsAccepted) === "true" || req.body.isTermsAccepted === true || req.body.isTermsAccepted === 1
          : req.body.termsAndConditionsAccepted !== undefined
          ? String(req.body.termsAndConditionsAccepted) === "true" || req.body.termsAndConditionsAccepted === true || req.body.termsAndConditionsAccepted === 1
          : req.body.terms !== undefined
          ? String(req.body.terms) === "true" || req.body.terms === true || req.body.terms === 1
          : false,

      termsAccepted:
        req.body.termsAndConditions !== undefined
          ? String(req.body.termsAndConditions) === "true" || req.body.termsAndConditions === true || req.body.termsAndConditions === 1
          : req.body.termsAccepted !== undefined
          ? String(req.body.termsAccepted) === "true" || req.body.termsAccepted === true || req.body.termsAccepted === 1
          : req.body.isTermsAccepted !== undefined
          ? String(req.body.isTermsAccepted) === "true" || req.body.isTermsAccepted === true || req.body.isTermsAccepted === 1
          : req.body.termsAndConditionsAccepted !== undefined
          ? String(req.body.termsAndConditionsAccepted) === "true" || req.body.termsAndConditionsAccepted === true || req.body.termsAndConditionsAccepted === 1
          : req.body.terms !== undefined
          ? String(req.body.terms) === "true" || req.body.terms === true || req.body.terms === 1
          : false,

      // IMPORTANT:
      // Schema expects "password".
      // Mongoose pre-save middleware will bcrypt hash it.
      password: generatedPassword,

      role: normalizedRole,

      // Employee, intern and team lead accounts
      // require admin approval.
      isApproved: false,

      isFirstLogin: false,

      mustChangePassword: true,

      isActive: true,
    });

    // --------------------------------------------------------
    // CREATE EMPLOYEE
    // --------------------------------------------------------

    let employee = null;

    if (
      normalizedRole === "employee" ||
      normalizedRole === "intern" ||
      normalizedRole === "team lead"
    ) {
      try {
        employee = await createEmployeeForUser(user);
      } catch (employeeError) {
        console.error(
          "Employee creation failed:",
          employeeError
        );

        // Rollback user if employee creation fails
        await User.findByIdAndDelete(user._id);

        return res.status(500).json({
          success: false,
          message:
            "Employee registration failed. User was not created.",
          error: employeeError.message,
        });
      }
    }

    // --------------------------------------------------------
    // SEND REGISTRATION EMAILS IN BACKGROUND
    // --------------------------------------------------------

    const registrationEmailTasks = [];

    if (process.env.EMAIL_USER && process.env.ADMIN_EMAIL) {
      registrationEmailTasks.push(
        transporter.sendMail({
          from: process.env.EMAIL_USER,

          to: process.env.ADMIN_EMAIL,

          subject: "New Employee Registration",

          html: `
            <h2>New Employee Registration</h2>

            <p>
              <b>Name:</b>
              ${user.name}
            </p>

            <p>
              <b>Email:</b>
              ${user.email}
            </p>

            <p>
              <b>Phone:</b>
              ${user.phoneNumber}
            </p>

            <p>
              <b>Department:</b>
              ${user.department}
            </p>

            <p>
              <b>Role:</b>
              ${user.role}
            </p>

            <p>
            ${
              employee
                ? `
                  <p>
                    <b>Employee ID:</b>
                    ${employee.employeeID}
                  </p>
                `
                : ""
            }

            <p>
              Please review this registration
              from the admin panel.
            </p>
          `,
        }).catch((emailError) => {
          console.error("Admin email error:", emailError.message);
        }),
      );
    }

    if (user.isApproved) {
      registrationEmailTasks.push(
        sendTemporaryPasswordEmail(
          user.email,
          generatedPassword,
          "Kevalon Technology",
        ).catch((emailError) => {
          console.error("User password email error:", emailError.message);
        }),
      );
    }

    void Promise.allSettled(registrationEmailTasks);

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    const responseMessage = user.isApproved
      ? "Registration successful. Login credentials have been sent to your email."
      : "Registration successful. Waiting for admin approval. Credentials will be sent once approved.";

    return res.status(201).json({
      success: true,

      message: responseMessage,

      user: {
        _id: user._id,

        name: user.name,

        email: user.email,

        phoneNumber: user.phoneNumber,

        profileImage: user.profileImage || null,
        profileImg: user.profileImage || null,
        profilePhoto: user.profileImage || null,

        bankAccount: user.bankAccountNumber || user.bankAccount || null,
        bankAccountNumber: user.bankAccountNumber || user.bankAccount || null,

        IFSC: user.ifscCode || user.IFSC || null,
        ifscCode: user.ifscCode || user.IFSC || null,

        upiId: user.upiId || user.upiID || user.upi || null,
        upiID: user.upiId || user.upiID || user.upi || null,
        upi: user.upiId || user.upiID || user.upi || null,

        role: user.role,

        isApproved: user.isApproved,

        isFirstLogin: user.isFirstLogin,

        isActive: user.isActive,
      },

      employee: employee
        ? {
            _id: employee._id,

            employeeID: employee.employeeID,

            userID: employee.userID,

            designation: employee.designation,

            department: employee.department,
          }
        : null,
    });
  } catch (error) {
    console.error("Register Error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Registration failed",
    });
  }
};

// ============================================================
// HRMS
// GET ALL USERS
// ============================================================

const getAllUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isApproved !== undefined) {
      filter.isApproved = req.query.isApproved === "true";
    } else if (req.query.pending === "true") {
      filter.isApproved = false;
    }
    if (req.query.companyId && mongoose.Types.ObjectId.isValid(req.query.companyId)) {
      filter.companyId = req.query.companyId;
    }
    if (req.query.branchId && mongoose.Types.ObjectId.isValid(req.query.branchId)) {
      filter.branchId = req.query.branchId;
    }

    const users = await User.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      totalUsers: users.length,
      users: users.map((user) => buildUserResponse(user)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// HRMS
// APPROVE EMPLOYEE
// ============================================================

const approveEmployee = async (req, res) => {
  try {
    const targetUserId =
      (req.body && (req.body.userId || req.body.id || req.body.employeeId)) ||
      (req.params && (req.params.id || req.params.userId));
    const { companyId, branchId } = req.body || {};

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    let user = await User.findById(targetUserId);
    if (!user) {
      const emp = await Employee.findById(targetUserId);
      if (emp && emp.userID) {
        user = await User.findById(emp.userID);
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isApproved) {
      return res.status(400).json({
        success: false,
        message: "Employee is already approved",
      });
    }

    // Validate and assign companyId if provided
    let companyDoc = null;
    if (companyId) {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid companyId",
        });
      }
      user.companyId = companyId;
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          if (typeof Company.findById === "function") {
            companyDoc = await Company.findById(companyId);
          }
        } catch (_) {}
      }
    } else if (user.companyId && mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        if (typeof Company.findById === "function") {
          companyDoc = await Company.findById(user.companyId);
        }
      } catch (_) {}
    }

    // Validate and assign branchId if provided
    let branchDoc = null;
    if (branchId) {
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branchId",
        });
      }
      user.branchId = branchId;
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          if (typeof Branch.findById === "function") {
            branchDoc = await Branch.findById(branchId);
          }
        } catch (_) {}
      }
    } else if (user.branchId && mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        if (typeof Branch.findById === "function") {
          branchDoc = await Branch.findById(user.branchId);
        }
      } catch (_) {}
    }

    // --------------------------------------------------------
    // CREATE EMPLOYEE IF MISSING
    // --------------------------------------------------------

    let employee = await Employee.findOne({
      userID: user._id,
    });

    if (
      !employee &&
      (normalizeRole(user.role) === "employee" ||
        normalizeRole(user.role) === "team lead")
    ) {
      employee = await createEmployeeForUser(user);
    }

    if (employee) {
      if (companyId) employee.companyId = companyId;
      if (branchId) employee.branchId = branchId;
      await employee.save();
    }

    // Sync companyId and branchId on SalaryStructure if existing
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        if (SalaryStructure && (companyId || branchId)) {
          const syncUpdate = {};
          if (companyId) syncUpdate.companyId = companyId;
          if (branchId) syncUpdate.branchId = branchId;
          await SalaryStructure.updateMany(
            { $or: [{ userId: user._id }, { employeeId: user._id }] },
            { $set: syncUpdate }
          );
        }
      } catch (_) {}

      // Sync companyId and branchId on MonthlySalary if existing
      try {
        if (MonthlySalary && (companyId || branchId)) {
          const syncSalary = {};
          if (companyId) syncSalary.companyId = companyId;
          if (branchId) syncSalary.branchId = branchId;
          await MonthlySalary.updateMany(
            { $or: [{ userId: user._id }, { employeeId: user._id }] },
            { $set: syncSalary }
          );
        }
      } catch (_) {}
    }

    // --------------------------------------------------------
    // APPROVE & SEND CREDENTIALS
    // --------------------------------------------------------

    user.isApproved = true;
    user.status = "Active";

    if (user.email) {
      sendTemporaryPasswordEmail(
        user.email,
        "Temporary Password Sent During Creation",
        (companyDoc && (companyDoc.companyName || companyDoc.name)) || "Kevalon Technology",
      ).catch((emailError) => {
        console.error("Approved user password email error:", emailError.message);
      });
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Employee approved successfully and login credentials sent via email.",
      data: {
        userId: user._id,
        employeeID: employee ? employee.employeeID : null,
        username: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId || null,
        companyName: companyDoc ? (companyDoc.companyName || companyDoc.name) : null,
        branchId: user.branchId || null,
        branchName: branchDoc ? branchDoc.branchName : null,
        designation: employee ? employee.designation : user.designation,
        joiningDate: employee ? employee.joiningDate : null,
        isApproved: user.isApproved,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Approve Employee Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to approve employee.",
    });
  }
};

// ============================================================
// HRMS
// REJECT EMPLOYEE
// ============================================================

const rejectEmployee = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isApproved = false;

    await user.save();

    return res.json({
      success: true,

      message: "Employee rejected successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// HRMS
// LOGIN
// ============================================================

const loginUser = async (req, res) => {
  try {
    const { login, email, password, deviceId } = req.body;
    const loginInput = login || email;

    if (!loginInput || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/login and password are required",
      });
    }

    const loginValue = loginInput.trim();

    const lookup = buildLoginLookupQuery(loginValue);

    if (!lookup) {
      return res.status(400).json({
        success: false,
        message: "Email/login and password are required",
      });
    }

    const user = await User.findOne(lookup).select(
      "+password +passwordHash",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // --------------------------------------------------------
    // ACCOUNT STATUS
    // --------------------------------------------------------

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    // --------------------------------------------------------
    // APPROVAL
    // --------------------------------------------------------

    const role = normalizeRole(user.role);

    if (shouldRequireApproval(role) && !user.isApproved) {
      return res.status(403).json({
        success: false,
        message: "Admin approval pending",
      });
    }

    // --------------------------------------------------------
    // ONE DEVICE LOGIN
    // --------------------------------------------------------

    if (user.deviceId && deviceId && user.deviceId !== deviceId) {
      return res.status(401).json({
        success: false,
        message: "Already logged in on another device",
      });
    }

    // --------------------------------------------------------
    // PASSWORD
    // --------------------------------------------------------

    const isMatch = await user.comparePassword(password.trim());

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid Password",
      });
    }

    // --------------------------------------------------------
    // TOKENS
    // --------------------------------------------------------

    const token = generateToken(user._id);

    const refreshToken = generateToken(user._id);

    // --------------------------------------------------------
    // SAVE LOGIN
    // --------------------------------------------------------

    user.refreshToken = refreshToken;

    user.deviceId = deviceId || null;

    user.lastLogin = new Date();

    user.lastLoginAt = new Date();

    applySuccessfulLoginState(user, { deviceId: deviceId || user.deviceId || null });

    await user.save();

    return res.status(200).json({
      success: true,

      message: "Login successful",

      token,

      refreshToken,

      changePassword: user.mustChangePassword || user.isFirstLogin,
      mustChangePassword: user.mustChangePassword || user.isFirstLogin,

      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// HRMS
// CHANGE PASSWORD
// ============================================================

const changePassword = async (req, res) => {
  try {
    const {
      userId,
      oldPassword,
      currentPassword,
      newPassword,
      password,
      confirmPassword,
    } = req.body;

    const authenticatedUserId = req.user?._id;
    const requestedUserId = authenticatedUserId || userId;
    const passwordToVerify = oldPassword || currentPassword || req.body?.oldPassword || req.body?.currentPassword || null;
    const updatedPassword = newPassword ?? password ?? null;
    const confirmPasswordValue = confirmPassword ?? req.body?.confirmPassword ?? updatedPassword;

    if (!requestedUserId || !updatedPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (String(updatedPassword).trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    if (String(updatedPassword).trim() !== String(confirmPasswordValue).trim()) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    const user = await User.findById(requestedUserId).select(
      "+password +passwordHash",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (passwordToVerify) {
      const isMatch = await user.comparePassword(String(passwordToVerify).trim());

      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Old password incorrect",
        });
      }
    } else if (user.mustChangePassword || user.isFirstLogin) {
      // Allow first-time or forced password change without old password.
    } else {
      return res.status(400).json({
        success: false,
        message: "Current password is required",
      });
    }

    applyPasswordUpdate(user, updatedPassword);

    user.isFirstLogin = false;
    user.mustChangePassword = false;
    user.passwordResetTokenHash = null;
    user.resetPasswordToken = null;
    user.passwordResetExpires = null;
    user.resetPasswordExpires = null;

    await user.save();

    return res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// HRMS
// RESET PASSWORD USING TOKEN
// NO OTP
// ============================================================

const forgotPassword = async (req, res) => {
  try {
    const email = req.body?.email || req.body?.login || req.body?.userEmail;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const resetExpires = new Date(Date.now() + 30 * 60 * 1000);

    user.passwordResetTokenHash = tokenHash;
    user.resetPasswordToken = tokenHash;
    user.passwordResetExpires = resetExpires;
    user.resetPasswordExpires = resetExpires;

    await user.save();

    const resetUrl = `${buildResetPasswordUrl(req, resetToken)}&email=${encodeURIComponent(user.email)}`;

    const { subject, text, html } = buildResetPasswordEmailContent(
      user.name,
      resetUrl,
    );

    // Dispatch email in background (non-blocking) so HTTP API response does not time out
    sendEmail({
      to: user.email,
      subject,
      text,
      html,
      templateParams: {
        reset_link: resetUrl,
        link: resetUrl,
        company_name: "Kevalon Technology",
        website_link: req.protocol + "://" + req.get("host"),
      },
    }).catch((emailError) => {
      console.error("Reset email error:", emailError.message);
    });

    return res.status(200).json({
      success: true,
      message: "Password reset link sent successfully",
      resetUrl,
      resetLink: resetUrl,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// HRMS
// RESET PASSWORD
// ============================================================

const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword, password, confirmPassword } = req.body;
    const requestedToken = token || req.body?.resetToken || req.body?.tokenHash || null;
    const requestedPassword = newPassword ?? password ?? null;
    const emailValue = email || req.body?.emailAddress || null;
    const confirmPasswordValue = confirmPassword ?? req.body?.confirmPassword ?? requestedPassword;

    if (!requestedPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (!requestedToken) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (String(requestedPassword).trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    if (String(requestedPassword).trim() !== String(confirmPasswordValue).trim()) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    let user;
    const normalizedToken = normalizeResetToken(requestedToken);
    if (!normalizedToken) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    const tokenCandidates = Array.from(
      new Set([normalizedToken.tokenString, normalizedToken.tokenHash]),
    );

    const tokenQuery = {
      $or: [
        { passwordResetTokenHash: { $in: tokenCandidates } },
        { resetPasswordToken: { $in: tokenCandidates } },
      ],
      $and: [
        {
          $or: [
            { passwordResetExpires: { $gt: new Date() } },
            { resetPasswordExpires: { $gt: new Date() } },
          ],
        },
      ],
    };

    if (emailValue) {
      tokenQuery.email = String(emailValue).trim().toLowerCase();
    }

    user = await User.findOne(tokenQuery).select(
      "+passwordResetTokenHash +passwordResetExpires +resetPasswordToken +resetPasswordExpires +password +passwordHash",
    );

    // Fallback: search by token alone if matching with email didn't find user
    if (!user && emailValue) {
      const tokenOnlyQuery = {
        $or: [
          { passwordResetTokenHash: { $in: tokenCandidates } },
          { resetPasswordToken: { $in: tokenCandidates } },
        ],
        $and: [
          {
            $or: [
              { passwordResetExpires: { $gt: new Date() } },
              { resetPasswordExpires: { $gt: new Date() } },
            ],
          },
        ],
      };
      user = await User.findOne(tokenOnlyQuery).select(
        "+passwordResetTokenHash +passwordResetExpires +resetPasswordToken +resetPasswordExpires +password +passwordHash",
      );
    }

    // Fallback: check Bearer token if caller is authenticated user changing password
    if (!user) {
      const authorization = req.headers.authorization || "";
      if (authorization.startsWith("Bearer ")) {
        const accessToken = authorization.slice(7);
        try {
          const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
          user = await User.findById(decoded.id).select("+password +passwordHash");
        } catch (error) {
          // ignore JWT error
        }
      }
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    applyPasswordUpdate(user, requestedPassword);

    user.isFirstLogin = false;
    user.mustChangePassword = false;
    clearResetTokenFields(user);

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// REFRESH TOKEN
// ============================================================

const refreshUserToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }

    const user = await User.findOne({
      refreshToken,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const token = generateToken(user._id);

    return res.json({
      success: true,
      token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// LOGOUT
// ============================================================

const logoutUser = async (req, res) => {
  try {
    const { userId } = req.body;

    const targetUserId = userId || req.user?._id;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID required",
      });
    }

    const user = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.refreshToken = null;

    user.deviceId = null;

    await user.save();

    return res.json({
      success: true,

      message: "Logout successful",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// RENDER RESET PASSWORD PAGE
// ============================================================

const renderResetPasswordPage = (req, res) => {
  const { token, email } = req.query;
  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reset Password - Kevalon Technology</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #f8fafc; }
        .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); width: 100%; max-width: 420px; box-sizing: border-box; }
        h2 { color: #1e3a8a; margin-top: 0; margin-bottom: 8px; text-align: center; }
        p.sub { color: #64748b; font-size: 14px; text-align: center; margin-bottom: 24px; }
        .form-group { margin-bottom: 16px; text-align: left; }
        label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }
        input { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; outline: none; }
        input:focus { border-color: #2563eb; ring: 2px solid #93c5fd; }
        button { width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 15px; cursor: pointer; margin-top: 8px; }
        button:hover { background: #1d4ed8; }
        .message { margin-top: 16px; font-size: 14px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Reset Password</h2>
        <p class="sub">Enter your new password below</p>
        <form id="resetForm">
          <input type="hidden" id="token" value="${token || ''}">
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" id="email" value="${email || ''}" placeholder="Enter your email" required />
          </div>
          <div class="form-group">
            <label>New Password</label>
            <input type="password" id="newPassword" placeholder="Minimum 6 characters" required minlength="6" />
          </div>
          <div class="form-group">
            <label>Confirm New Password</label>
            <input type="password" id="confirmPassword" placeholder="Confirm your password" required minlength="6" />
          </div>
          <button type="submit">Update Password</button>
          <div id="msg" class="message"></div>
        </form>
      </div>
      <script>
        document.getElementById('resetForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const token = document.getElementById('token').value;
          const email = document.getElementById('email').value;
          const newPassword = document.getElementById('newPassword').value;
          const confirmPassword = document.getElementById('confirmPassword').value;
          const msg = document.getElementById('msg');
          if (newPassword !== confirmPassword) {
            msg.style.color = '#dc2626';
            msg.innerText = 'Passwords do not match!';
            return;
          }
          try {
            const res = await fetch('/api/users/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, token, newPassword })
            });
            const data = await res.json();
            if (data.success) {
              msg.style.color = '#16a34a';
              msg.innerText = 'Password reset successfully! You can now login.';
              document.getElementById('resetForm').reset();
            } else {
              msg.style.color = '#dc2626';
              msg.innerText = data.message || 'Failed to reset password.';
            }
          } catch (err) {
            msg.style.color = '#dc2626';
            msg.innerText = 'Network error. Please try again.';
          }
        });
      </script>
    </body>
    </html>
  `);
};

// ============================================================
// UPLOAD PROFILE IMAGE (DIRECT CLOUDINARY)
// ============================================================
const uploadProfileImage = async (req, res) => {
  try {
    let imageSource = null;

    if (req.file?.path || req.file?.secure_url || req.file?.url) {
      imageSource = req.file.path || req.file.secure_url || req.file.url;
    } else {
      const body = req.body || {};
      imageSource =
        body.profileImage ||
        body.profileImg ||
        body.profilePhoto ||
        body.image ||
        body.avatar ||
        body.photo ||
        body.file;
    }

    if (!imageSource) {
      return res.status(400).json({
        success: false,
        message: "No profile image file or data provided",
      });
    }

    const { uploadProfileImage: uploadToCloudinary } = require("../services/cloudinary.service");
    const uploadResult = await uploadToCloudinary(
      imageSource,
      req.user?._id || "user"
    );
    const cloudinaryUrl = uploadResult.secure_url || imageSource;

    let updatedEmployee = null;
    let updatedProfile = null;

    if (req.user?._id) {
      const user = await User.findById(req.user._id);
      if (user) {
        user.profileImage = cloudinaryUrl;
        user.profileImg = cloudinaryUrl;
        await user.save();
        updatedEmployee = await syncUserToEmployee(user);
        updatedProfile = buildUserResponse(user);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Profile image uploaded to Cloudinary successfully",
      profileImage: cloudinaryUrl,
      profileImg: cloudinaryUrl,
      url: cloudinaryUrl,
      secure_url: cloudinaryUrl,
      profile: updatedProfile,
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error("Upload Profile Image Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload profile image",
    });
  }
};

// Import OTP controller methods for backward compatibility
const { sendOTP, verifyOTP } = require("./otpController");
const { cascadeDeleteUser } = require("../utils/userCascadeDelete");

// ============================================================
// DELETE USER (CASCADES TO EMPLOYEE & TEAM MEMBER)
// ============================================================

const deleteUser = async (req, res) => {
  try {
    const userId = req.params?.id || req.body?.userId || req.query?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }

    if (!user) {
      user = await User.findOne({
        $or: [
          { email: String(userId).toLowerCase().trim() },
          { phoneNumber: String(userId).trim() },
        ],
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const cascadeResult = await cascadeDeleteUser(user);

    await User.findByIdAndDelete(user._id, { skipCascade: true });

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      deletedUserId: user._id,
      deletedEmployeeIds: cascadeResult?.deletedEmployeeIds || [],
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete user",
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  buildUserResponse,
  buildLoginLookupQuery,
  shouldRequireApproval,
  __test__applyPasswordUpdate: applyPasswordUpdate,
  __test__applySuccessfulLoginState: applySuccessfulLoginState,

  // HRMS
  updateProfile,
  getMyProfile,
  uploadProfileImage,
  registerUser,
  getAllUsers,
  approveEmployee,
  rejectEmployee,
  deleteUser,

  // Authentication
  loginUser,
  changePassword,
  forgotPassword,
  resetPassword,
  renderResetPasswordPage,
  sendOTP,
  verifyOTP,
  refreshUserToken,
  logoutUser,
};


