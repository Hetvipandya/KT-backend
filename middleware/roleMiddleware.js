
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated.",
        });
      }

      const normalizeRole = (role) =>
        String(role || "")
          .trim()
          .toLowerCase()
          .replace(/[_\s-]+/g, "");

      const userRole = normalizeRole(req.user.role);

      const allowedRoles = roles.map(normalizeRole);

      console.log("========== AUTHORIZATION TRACE ==========");
      console.log("URL:", req.originalUrl);
      console.log("METHOD:", req.method);
      console.log("USER ROLE:", req.user.role);
      console.log("ALLOWED ROLES:", roles);

      console.trace("AUTHORIZE ROLES CALL STACK");

      console.log("==========================================");

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
