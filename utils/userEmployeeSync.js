const User = require("../models/User");
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

exports.syncEmployeeToUser = async ({ employee, role, userData = {} }) => {
  let user = null;

  if (employee.userID) {
    user = await User.findById(employee.userID);
  }

  if (!user && (userData.email || employee.email)) {
    user = await User.findOne({ email: userData.email || employee.email });
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

  const payload = {
    name,
    email: userData.email || employee.email || "",
    phoneNumber:
      userData.phoneNumber || employee.mobile || employee.phoneNumber || "",
    dob: formatDob(userData.dob || employee.dob),
    address:
      userData.address ||
      employee.currentAddress ||
      employee.permanentAddress ||
      employee.address ||
      "",
    department: userData.department || employee.department || "",
    designation: userData.designation || employee.designation || "",
    gender: userData.gender || employee.gender || "",
    bloodGroup: userData.bloodGroup || employee.bloodGroup || "",
    role: finalRole,
    isApproved: userData.isApproved ?? true,
    isFirstLogin: userData.isFirstLogin ?? false,
    isActive: userData.isActive ?? true,
  };

  if (!user) {
    const generatedPassword = Math.random().toString(36).slice(-8);

    user = await User.create({
      ...payload,
      password: generatedPassword,
      plainPassword: generatedPassword,
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
    Object.assign(user, payload);
    await user.save();
    await User.findByIdAndUpdate(user._id, { role: finalRole });
  }

  if (employee) {
    let employeeModified = false;
    if (employee.role !== finalRole) {
      employee.role = finalRole;
      employeeModified = true;
    }
    if (!employee.userID && user._id) {
      employee.userID = user._id;
      employeeModified = true;
    }
    if (employeeModified) {
      await employee.save();
    }
  }

  return user;
};
