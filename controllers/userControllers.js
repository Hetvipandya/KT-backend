const User = require("../models/User");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const Branch = require("../models/Branch");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const userService = require("../services/user.service");
const { sendTemporaryPasswordEmail } = require("../services/email.service");

const {
  inviteUserSchema, 
  updateUserSchema,
} = require("../validators/user.validators");

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

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    dob: user.dob,
    address: user.address,
    department: user.department,
    designation: user.designation,
    gender: user.gender,
    bloodGroup: user.bloodGroup,

    bankAccountNumber: user.bankAccountNumber || null,

    ifscCode: user.ifscCode || null,

    uniqueID: user.uniqueID,
    role: user.role,

    isApproved: user.isApproved,
    isFirstLogin: user.isFirstLogin,
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

  // Only Employee and Team Lead get Employee record
  if (role !== "employee" && role !== "team lead") {
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

    mobile: user.phone || "",

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
    userID: user._id,
  });

  if (!employee) {
    return null;
  }

  employee.firstName = user.name || employee.firstName;

  employee.email = user.email || employee.email;

  employee.mobile = user.phone || employee.mobile;

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
// FINANCE
// INVITE / ADD USER TO COMPANY
// ============================================================

const inviteUser = async (req, res, next) => {
  try {
    const parsed = inviteUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        details: parsed.error.errors,
      });
    }

    const {
      companyId,
      branchId,
      name,
      email,
      phone,
      role,
      sendTemporaryPassword,
    } = parsed.data;

    // --------------------------------------------------------
    // CHECK COMPANY
    // --------------------------------------------------------

    const company = await Company.findById(companyId).select("name");

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
        errorCode: "COMPANY_NOT_FOUND",
      });
    }

    // --------------------------------------------------------
    // CHECK BRANCH
    // --------------------------------------------------------

    if (branchId) {
      const branch = await Branch.findOne({
        _id: branchId,
        companyId,
      });

      if (!branch) {
        return res.status(400).json({
          success: false,
          message:
            "Branch not found or does not belong to the specified company",
          errorCode: "INVALID_BRANCH",
        });
      }
    }

    // --------------------------------------------------------
    // BASE URL
    // --------------------------------------------------------

    const host = req.get("host");

    const protocol =
      host && host.includes("localhost") ? req.protocol : "https";

    const baseUrl = `${protocol}://${host}`;

    // --------------------------------------------------------
    // USE EXISTING FINANCE USER SERVICE
    // --------------------------------------------------------

    let result;

    try {
      result = await userService.inviteUser({
        companyId,
        branchId,
        name,
        email,
        phone,
        role,
        companyName: company.name,
        sendTemporaryPassword,
        baseUrl,
      });
    } catch (error) {
      if (error.statusCode === 409) {
        return res.status(409).json({
          success: false,
          message: error.message,
          errorCode: error.errorCode,
        });
      }

      throw error;
    }

    const { isNewUser, user } = result;

    // --------------------------------------------------------
    // BRANCH NAME
    // --------------------------------------------------------

    const assignedBranchId = branchId || user.branchId;

    let branchName = null;

    if (assignedBranchId) {
      const branch = await Branch.findById(assignedBranchId)
        .select("branchName")
        .lean();

      if (branch) {
        branchName = branch.branchName;
      }
    }

    return res.status(isNewUser ? 201 : 200).json({
      success: true,

      message: isNewUser
        ? "User invited successfully."
        : "Existing user granted access to this company.",

      data: {
        userId: user._id,

        email: user.email,

        companyId,

        branchId: assignedBranchId ? assignedBranchId.toString() : null,

        branchName,

        role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// FINANCE
// LIST COMPANY USERS
// ============================================================

const listUsers = async (req, res, next) => {
  try {
    const { search, includeInactive, companyId: queryCompanyId } = req.query;

    const page = Math.max(1, parseInt(req.query.page) || 1);

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

    let companyId = queryCompanyId || req.user?.companyId;

    if (!companyId && req.user?.companyAccess?.length) {
      const activeCompany = req.user.companyAccess.find(
        (item) => item.isActive,
      );

      if (activeCompany) {
        companyId = activeCompany.companyId;
      }
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID not found",
        errorCode: "COMPANY_ID_REQUIRED",
      });
    }

    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    let searchFilter = {};

    if (search) {
      const regex = new RegExp(search, "i");

      searchFilter = {
        $or: [
          {
            name: regex,
          },
          {
            email: regex,
          },
          {
            uniqueID: regex,
          },
          {
            phone: regex,
          },
        ],
      };
    }

    // --------------------------------------------------------
    // FILTER
    // --------------------------------------------------------

    const filter = {
      $or: [
        {
          companyId,
        },

        {
          companyAccess: {
            $elemMatch: {
              companyId,

              ...(includeInactive === "true"
                ? {}
                : {
                    isActive: true,
                  }),
            },
          },
        },
      ],

      ...searchFilter,
    };

    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // --------------------------------------------------------
    // BRANCH MAP
    // --------------------------------------------------------

    const branchIds = new Set();

    users.forEach((user) => {
      if (user.branchId) {
        branchIds.add(user.branchId.toString());
      }

      (user.companyAccess || []).forEach((access) => {
        if (access.branchId) {
          branchIds.add(access.branchId.toString());
        }
      });
    });

    const branches = await Branch.find({
      _id: {
        $in: Array.from(branchIds),
      },
    })
      .select("branchName")
      .lean();

    const branchMap = new Map(
      branches.map((branch) => [branch._id.toString(), branch.branchName]),
    );

    // --------------------------------------------------------
    // COMPANY USER VIEW
    // --------------------------------------------------------

    const data = users.map((user) =>
      userService.toCompanyUserView(user, companyId, branchMap),
    );

    return res.status(200).json({
      success: true,

      data,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// FINANCE
// GET SINGLE USER
// ============================================================

const getUserById = async (req, res, next) => {
  try {
    const { companyId: queryCompanyId } = req.query;

    const targetUserId = req.params.id;

    let companyId = queryCompanyId || req.user?.companyId;

    if (!companyId && req.user?.companyAccess?.length) {
      const activeCompany = req.user.companyAccess.find(
        (item) => item.isActive,
      );

      if (activeCompany) {
        companyId = activeCompany.companyId;
      }
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId query parameter is required",
        errorCode: "COMPANY_ID_REQUIRED",
      });
    }

    const targetUser = await User.findById(targetUserId).lean();

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        errorCode: "USER_NOT_FOUND",
      });
    }

    const accessEntry = (targetUser.companyAccess || []).find(
      (access) => access.companyId.toString() === companyId.toString(),
    );

    const assignedBranchId = accessEntry?.branchId || targetUser.branchId;

    let branchName = null;

    if (assignedBranchId) {
      const branch = await Branch.findById(assignedBranchId)
        .select("branchName")
        .lean();

      if (branch) {
        branchName = branch.branchName;
      }
    }

    const branchMap = new Map();

    if (assignedBranchId && branchName) {
      branchMap.set(assignedBranchId.toString(), branchName);
    }

    return res.status(200).json({
      success: true,

      data: userService.toCompanyUserView(targetUser, companyId, branchMap),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// FINANCE
// UPDATE COMPANY USER
// ============================================================

const updateUser = async (req, res, next) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        details: parsed.error.errors,
      });
    }

    const { companyId, branchId, role, isActive, name, phone } = parsed.data;

    const targetUserId = req.params.id;

    // --------------------------------------------------------
    // BRANCH CHECK
    // --------------------------------------------------------

    if (branchId) {
      const branch = await Branch.findOne({
        _id: branchId,
        companyId,
      });

      if (!branch) {
        return res.status(400).json({
          success: false,
          message:
            "Branch not found or does not belong to the specified company",
          errorCode: "INVALID_BRANCH",
        });
      }
    }

    // --------------------------------------------------------
    // FIND USER
    // --------------------------------------------------------

    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        errorCode: "USER_NOT_FOUND",
      });
    }

    // --------------------------------------------------------
    // FIND COMPANY ACCESS
    // --------------------------------------------------------

    let accessEntry = targetUser.companyAccess.find(
      (access) => access.companyId.toString() === companyId.toString(),
    );

    // --------------------------------------------------------
    // CREATE ACCESS FOR LEGACY USER
    // --------------------------------------------------------

    if (!accessEntry) {
      const isOwner =
        targetUser.companyCreated &&
        targetUser.companyId &&
        targetUser.companyId.toString() === companyId.toString();

      const isLegacyMember =
        targetUser.companyId &&
        targetUser.companyId.toString() === companyId.toString();

      if (isOwner || isLegacyMember) {
        targetUser.companyAccess.push({
          companyId,

          branchId: branchId || null,

          role: role || (isOwner ? "admin" : "employee"),

          isActive: isActive !== undefined ? isActive : true,

          invitedAt: new Date(),

          joinedAt: new Date(),
        });

        accessEntry = targetUser.companyAccess.find(
          (access) => access.companyId.toString() === companyId.toString(),
        );
      } else {
        return res.status(404).json({
          success: false,
          message: "This user does not have access to the specified company",
          errorCode: "ACCESS_ENTRY_NOT_FOUND",
        });
      }
    }

    // --------------------------------------------------------
    // SELF LOCKOUT
    // --------------------------------------------------------

    if (isActive === false) {
      const callerUser = await User.findById(req.user._id);

      if (userService.wouldSelfLockout(callerUser, targetUserId, companyId)) {
        return res.status(400).json({
          success: false,
          message: "Cannot deactivate your own only remaining company access",
          errorCode: "SELF_LOCKOUT_PREVENTED",
        });
      }
    }

    // --------------------------------------------------------
    // UPDATE COMPANY ACCESS
    // --------------------------------------------------------

    if (role !== undefined) {
      accessEntry.role = role;

      targetUser.role = role;
    }

    if (branchId !== undefined) {
      accessEntry.branchId = branchId || null;

      targetUser.branchId = branchId || null;

      targetUser.markModified("companyAccess");
    }

    if (isActive !== undefined) {
      accessEntry.isActive = isActive;
    }

    // --------------------------------------------------------
    // GLOBAL PROFILE
    // --------------------------------------------------------

    if (name !== undefined) {
      targetUser.name = name;
    }

    if (phone !== undefined) {
      targetUser.phone = phone;
    }

    await targetUser.save();

    // Sync HRMS Employee
    await syncUserToEmployee(targetUser);

    // --------------------------------------------------------
    // BRANCH NAME
    // --------------------------------------------------------

    const assignedBranchId = accessEntry.branchId || targetUser.branchId;

    let branchName = null;

    if (assignedBranchId) {
      const branch = await Branch.findById(assignedBranchId)
        .select("branchName")
        .lean();

      if (branch) {
        branchName = branch.branchName;
      }
    }

    const branchMap = new Map();

    if (assignedBranchId && branchName) {
      branchMap.set(assignedBranchId.toString(), branchName);
    }

    return res.status(200).json({
      success: true,

      data: userService.toCompanyUserView(targetUser, companyId, branchMap),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// FINANCE
// REVOKE COMPANY ACCESS
// ============================================================

const revokeAccess = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    const targetUserId = req.params.id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId query parameter is required",
        errorCode: "COMPANY_ID_REQUIRED",
      });
    }

    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        errorCode: "USER_NOT_FOUND",
      });
    }

    const accessEntry = targetUser.companyAccess.find(
      (access) => access.companyId.toString() === companyId.toString(),
    );

    if (!accessEntry) {
      return res.status(404).json({
        success: false,
        message: "This user does not have access to the specified company",
        errorCode: "ACCESS_ENTRY_NOT_FOUND",
      });
    }

    // --------------------------------------------------------
    // SELF LOCKOUT
    // --------------------------------------------------------

    const callerUser = await User.findById(req.user._id);

    if (userService.wouldSelfLockout(callerUser, targetUserId, companyId)) {
      return res.status(400).json({
        success: false,
        message: "Cannot deactivate your own only remaining company access",
        errorCode: "SELF_LOCKOUT_PREVENTED",
      });
    }

    // Soft revoke
    accessEntry.isActive = false;

    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: "User access revoked for this company",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// HRMS
// UPDATE MY PROFILE
// ============================================================

const updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      dob,
      address,
      department,
      designation,
      gender,
      bloodGroup,
      bankAccountNumber,
      ifscCode,
    } = req.body;

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

    if (phoneNumber && phoneNumber !== user.phone) {
      const existingPhone = await User.findOne({
        phone: phoneNumber,

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

    if (phoneNumber !== undefined) {
      user.phone = phoneNumber;
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

    // --------------------------------------------------------
    // BANK DETAILS
    // --------------------------------------------------------

    if (bankAccountNumber !== undefined) {
      user.bankAccountNumber = bankAccountNumber;
    }

    if (ifscCode !== undefined) {
      user.ifscCode = ifscCode.trim().toUpperCase();
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
      userID: user._id,
    }).lean();

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
      dob,
      address,
      department,
      designation,
      gender,
      bloodGroup,
      bankAccountNumber,
      ifscCode,
      role,
    } = req.body;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (
      !name ||
      !email ||
      !phoneNumber ||
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

    // --------------------------------------------------------
    // CHECK EXISTING USER
    // --------------------------------------------------------

    const existingUser = await User.findOne({
      $or: [
        {
          email: normalizedEmail,
        },
        {
          phone: phoneNumber,
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
    // GENERATE UNIQUE ID
    // --------------------------------------------------------

    const lastUser = await User.findOne({
      uniqueID: {
        $regex: /^NEW\d+$/,
      },
    }).sort({
      createdAt: -1,
    });

    let nextNumber = 1001;

    if (lastUser && lastUser.uniqueID) {
      const lastNumber = parseInt(lastUser.uniqueID.replace("NEW", ""), 10);

      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const uniqueID = `NEW${nextNumber}`;

    // --------------------------------------------------------
    // GENERATE PASSWORD
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

      phone: phoneNumber,

      dob,

      address,

      department,

      designation:
        designation ||
        (normalizedRole === "team lead"
          ? "Team Lead"
          : normalizedRole === "employee"
            ? "Employee"
            : ""),

      gender,

      bloodGroup,

      bankAccountNumber: bankAccountNumber || null,

      ifscCode: ifscCode ? ifscCode.trim().toUpperCase() : null,

      uniqueID,

      passwordHash: generatedPassword,
      plainPassword: generatedPassword,

      role: normalizedRole,

      // Registration credentials must be usable immediately after the email is sent.
      isApproved: true,

      isFirstLogin: true,

      isActive: true,
    });

    // --------------------------------------------------------
    // CREATE EMPLOYEE
    // --------------------------------------------------------

    let employee = null;

    if (normalizedRole === "employee" || normalizedRole === "team lead") {
      try {
        employee = await createEmployeeForUser(user);
      } catch (employeeError) {
        console.error("Employee creation failed:", employeeError);

        await User.findByIdAndDelete(user._id);

        return res.status(500).json({
          success: false,
          message: "Employee registration failed. User was not created.",
          error: employeeError.message,
        });
      }
    }

    // --------------------------------------------------------
    // SEND ADMIN EMAIL
    // --------------------------------------------------------

    try {
      if (process.env.EMAIL_USER && process.env.ADMIN_EMAIL) {
        await transporter.sendMail({
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
              ${user.phone}
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
              <b>Unique ID:</b>
              ${user.uniqueID}
            </p>

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
        });
      }
    } catch (emailError) {
      console.error("Admin email error:", emailError.message);
    }

    try {
      await sendTemporaryPasswordEmail(user.email, generatedPassword, "Kevalon Technology");
    } catch (emailError) {
      console.error("User password email error:", emailError.message);
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,

      message: "Registration successful. Login credentials have been sent to your email.",

      credentials: {
        uniqueID,
      },

      user: {
        _id: user._id,

        name: user.name,

        email: user.email,

        uniqueID: user.uniqueID,

        role: user.role,

        isApproved: user.isApproved,
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
      message: error.message || "Registration failed",
    });
  }
};

// ============================================================
// HRMS
// GET ALL USERS
// ============================================================

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({
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

    if (user.isApproved) {
      return res.status(400).json({
        success: false,
        message: "Employee is already approved",
      });
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

    // --------------------------------------------------------
    // APPROVE
    // --------------------------------------------------------

    user.isApproved = true;

    await user.save();

    return res.status(200).json({
      success: true,

      message: "Employee approved successfully.",

      data: {
        userId: user._id,

        employeeID: employee ? employee.employeeID : null,

        username: user.name,

        email: user.email,

        designation: employee ? employee.designation : user.designation,

        joiningDate: employee ? employee.joiningDate : null,

        isApproved: user.isApproved,
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

    const user = await User.findOne({
      $or: [
        {
          email: loginValue.toLowerCase(),
        },

        {
          name: loginValue,
        },

        {
          uniqueID: loginValue,
        },
      ],
    }).select("+passwordHash");

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

    if (role !== "admin" && role !== "hr" && !user.isApproved) {
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

    await user.save();

    return res.status(200).json({
      success: true,

      message: "Login successful",

      token,

      refreshToken,

      changePassword: user.isFirstLogin,

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
    const { userId, oldPassword, currentPassword, newPassword } = req.body;
    const authenticatedUserId = req.user?._id;
    const requestedUserId = authenticatedUserId || userId;
    const passwordToVerify = oldPassword || currentPassword;

    if (!requestedUserId || !passwordToVerify || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    const user = await User.findById(requestedUserId).select("+passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await user.comparePassword(passwordToVerify);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Old password incorrect",
      });
    }

    user.passwordHash = newPassword;

    user.plainPassword = null;

    user.isFirstLogin = false;
    user.mustChangePassword = false;

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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
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

    user.passwordResetTokenHash = tokenHash;

    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);

    await user.save();

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    try {
      if (process.env.EMAIL_USER) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,

          to: user.email,

          subject: "Password Reset Request",

          html: `
            <h2>Password Reset</h2>

            <p>Hello ${user.name},</p>

            <p>
              Click the link below to reset your password.
            </p>

            <p>
              <a href="${resetUrl}">
                Reset Password
              </a>
            </p>

            <p>
              This link will expire in 30 minutes.
            </p>
          `,
        });
      }
    } catch (emailError) {
      console.error("Reset email error:", emailError.message);
    }

    return res.status(200).json({
      success: true,

      message: "Password reset link sent successfully",
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
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, token and new password are required",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      email: email.trim().toLowerCase(),

      passwordResetTokenHash: tokenHash,

      passwordResetExpires: {
        $gt: new Date(),
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    user.passwordHash = newPassword;

    user.plainPassword = null;

    user.isFirstLogin = false;

    user.passwordResetTokenHash = null;

    user.passwordResetExpires = null;

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

// Import OTP controller methods for backward compatibility
const { sendOTP, verifyOTP } = require("./otpController");

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Finance
  inviteUser,
  listUsers,
  getUserById,
  updateUser,
  revokeAccess,

  // HRMS
  updateProfile,
  getMyProfile,
  registerUser,
  getAllUsers,
  approveEmployee,
  rejectEmployee,

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

