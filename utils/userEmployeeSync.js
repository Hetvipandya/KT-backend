const User = require("../models/User");
const Employee = require("../models/Employee");
const sanitizeUserUpdatePayload = require("./userPayloadSanitizer");
const { sendRegistrationEmail } = require("./mailer");

const normalizeRole = (role) => {
  if (!role) return null;

  const normalized = String(role)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "");

  if (normalized === "teamlead" || normalized === "teamleader") {
    return "team lead";
  }

  if (normalized === "intern") {
    return "intern";
  }

  return String(role).trim().toLowerCase();
};

const formatDob = (value) => {
  if (!value) return "";

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }

    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("-");
      return `${year}-${month}-${day}`;
    }

    return trimmed;
  }

  return "";
};

const isEmployeeInactive = (employee) =>
  [employee?.employeeStatus, employee?.status].some(
    (status) =>
      String(status || "")
        .trim()
        .toLowerCase() === "inactive",
  );

exports.syncEmployeeActiveStatus = async (employee) => {
  if (!employee) {
    return null;
  }

  let user = null;
  const userId = employee.userID || employee.userId;
  if (userId) {
    user = await User.findById(userId);
  }
  if (!user && employee.email) {
    user = await User.findOne({ email: employee.email });
  }

  if (isEmployeeInactive(employee)) {
    if (user && user.isActive !== false) {
      user.isActive = false;
      await user.save();
    }
    return user;
  }

  if (user?.isActive === false) {
    Object.assign(employee, {
      employeeStatus: "Inactive",
      status: "INACTIVE",
    });
    await employee.save();
  }

  return user;
};

exports.syncEmployeeToUser = async ({ employee, role, userData = {} }) => {
  let user = null;

  if (employee.userID) {
    const q = User.findById(employee.userID);
    user = typeof q?.select === "function" ? await q.select("+password +passwordHash") : await q;
  }

  if (!user && (userData.email || employee.email)) {
    const q = User.findOne({ email: userData.email || employee.email });
    user = typeof q?.select === "function" ? await q.select("+password +passwordHash") : await q;
  }

  const shouldBeInactive =
    isEmployeeInactive(employee) ||
    user?.isActive === false ||
    userData.isActive === false;
  const employeeStatusModified =
    shouldBeInactive && !isEmployeeInactive(employee);

  if (employeeStatusModified) {
    Object.assign(employee, {
      employeeStatus: "Inactive",
      status: "INACTIVE",
    });
  }

  const name =
    userData.name ||
    [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();

  let finalRole;
  if (employee?.isTeamLead) {
    finalRole = "team lead";
  } else {
    const candidateRole = normalizeRole(userData.role || role || employee?.role || user?.role || "employee");
    if (candidateRole === "teamlead" || candidateRole === "team lead") {
      finalRole = "team lead";
    } else {
      finalRole = candidateRole || "employee";
    }
  }

  const safeUserData = sanitizeUserUpdatePayload(userData || {});

  const profileImgValue =
    safeUserData.profileImage ||
    safeUserData.profileImg ||
    employee?.profileImage ||
    employee?.profileImg ||
    user?.profileImage ||
    user?.profileImg ||
    "";

  const uniqueIDVal =
    safeUserData.uniqueID ||
    safeUserData.employeeID ||
    employee?.employeeID ||
    employee?.employeeCode ||
    user?.uniqueID ||
    null;

  const payload = {
    name,
    email: safeUserData.email || employee.email || "",
    phoneNumber: safeUserData.phoneNumber || safeUserData.phone || employee.phoneNumber || employee.mobile || "",
    dob: formatDob(safeUserData.dob || employee.dob),
    profileImage: profileImgValue,
    profileImg: profileImgValue,
    address:
      safeUserData.address ||
      employee.currentAddress ||
      employee.permanentAddress ||
      employee.address ||
      "",
    department: safeUserData.department || employee.department || "",
    designation: safeUserData.designation || employee.designation || user?.designation || "",
    gender: safeUserData.gender || employee.gender || "",
    bloodGroup: safeUserData.bloodGroup || employee.bloodGroup || "",
    role: finalRole,
    isApproved: shouldBeInactive
      ? user?.isApproved ?? false
      : userData.isApproved ?? user?.isApproved ?? true,
    isFirstLogin: userData.isFirstLogin ?? false,
    isActive: !shouldBeInactive && (userData.isActive ?? user?.isActive ?? true),
  };

  if (uniqueIDVal) {
    payload.uniqueID = uniqueIDVal;
  }

  if (!user) {
    const generatedPassword = Math.random().toString(36).slice(-8);

    user = await User.create({
      ...payload,
      password: generatedPassword,
    });

    try {
      await sendRegistrationEmail({
        name: user.name,
        email: user.email,
        password: generatedPassword,
        role: user.role,
      });
    } catch (err) {
      console.error("❌ Failed to send registration email in syncEmployeeToUser:", err.message);
    }
  } else {
    // Never overwrite a user who already has a valid, emailed temp password.
    // Approval and employee sync must not regenerate credentials for an existing account.
    // Existing users must NEVER have their credentials modified or regenerated during employee sync
    delete payload.password;
    delete payload.passwordHash;

    Object.assign(user, payload);
    await user.save();
    await User.findByIdAndUpdate(user._id, { role: finalRole, designation: payload.designation });
  }

  if (employee) {
    let employeeModified = employeeStatusModified;
    if (employee.role !== finalRole) {
      employee.role = finalRole;
      employeeModified = true;
    }
    if (payload.designation && employee.designation !== payload.designation) {
      employee.designation = payload.designation;
      employeeModified = true;
    }
    if (!employee.userID && user._id) {
      employee.userID = user._id;
      employeeModified = true;
    }
    if (employeeModified) {
      if (typeof employee.save === "function") {
        await employee.save();
      } else if (employee._id) {
        await Employee.findByIdAndUpdate(employee._id, {
          role: employee.role,
          designation: employee.designation,
          userID: employee.userID,
          isTeamLead: employee.isTeamLead,
        });
      }
    }
  }

  if (finalRole === "team lead" || employee?.isTeamLead) {
    const { ensureTeamLeadUniqueID } = require("./teamLeadId");
    await ensureTeamLeadUniqueID({ user, employee });
  }

  return user;
};
