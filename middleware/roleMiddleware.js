
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated. Please login first.",
        });
      }

      const normalizeRole = (role) =>
        String(role || "")
          .trim()
          .toLowerCase()
          .replace(/[_\s-]+/g, "");

      const userRole = normalizeRole(req.user.role);

      const allowedRoles = roles.map(normalizeRole);

      console.log("Authorization Debug:", {
        userRole: req.user.role,
        normalizedUserRole: userRole,
        allowedRoles: roles,
      });

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Role "${req.user.role}" is not authorized to access this resource.`,
          requiredRoles: roles,
        });
      }

      next();
    } catch (error) {
      console.error("Role Middleware Error:", error);

      return res.status(500).json({
        success: false,
        message: "Role authorization failed.",
      });
    }
  };
};
