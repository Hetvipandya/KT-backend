const Role = require("../models/Role");
const Permission = require("../models/Permission");
const { recordAuditEvent } = require("../services/auditLog.service");

// ==========================
// CREATE ROLE
// ==========================
exports.createRole = async (req, res) => {
  try {
    const { roleName, description, permissions } = req.body;

    // check duplicate role
    const existingRole = await Role.findOne({ roleName });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: "Role already exists",
      });
    }

    // ✅ validate permissions
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({
        _id: { $in: permissions },
      });

      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({
          success: false,
          message: "Some permissions are invalid",
        });
      }
    }

    const role = await Role.create({
      roleName,
      description,
      permissions,
    });

    await recordAuditEvent({
      req,
      module: "ROLES",
      action: "CREATE",
      actionType: "ROLE_CREATED",
      entityType: "Role",
      entityId: role._id,
      description: `Role ${role.roleName} created`,
      newValues: role,
      companyId: req.user?.companyId,
    });

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================
// GET ROLE LIST
// ==========================
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find({
      isDeleted: false,
    }).populate("permissions");

    return res.status(200).json({
      success: true,
      count: roles.length,
      data: roles,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================
// GET SINGLE ROLE
// ==========================
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).populate("permissions");

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================
// UPDATE ROLE
// ==========================
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName, description, permissions } = req.body;

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }
    const oldRoleData = role.toObject ? role.toObject() : { ...role };

    // ✅ validate permissions before update
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({
        _id: { $in: permissions },
      });

      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({
          success: false,
          message: "Some permissions are invalid",
        });
      }
    }

    role.roleName = roleName || role.roleName;
    role.description = description || role.description;
    role.permissions = permissions || role.permissions;

    await role.save();

    await recordAuditEvent({
      req,
      module: "ROLES",
      action: "UPDATE",
      actionType: "ROLE_UPDATED",
      entityType: "Role",
      entityId: role._id,
      description: `Role ${role.roleName} updated`,
      oldValues: oldRoleData,
      newValues: role,
      companyId: req.user?.companyId,
    });

    return res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================
// DELETE ROLE (SOFT DELETE)
// ==========================
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    role.isDeleted = true;
    await role.save();

    await recordAuditEvent({
      req,
      module: "ROLES",
      action: "DELETE",
      actionType: "ROLE_DELETED",
      entityType: "Role",
      entityId: role._id,
      description: `Role ${role.roleName} deleted`,
      oldValues: role,
      companyId: req.user?.companyId,
    });

    return res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};