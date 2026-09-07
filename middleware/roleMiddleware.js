// exports.authorizeRoles =
//   (...roles) => {
//     return (
//       req,
//       res,
//       next 
//     ) => {
//       if (
//         !roles.includes(
//           req.user.role
//         )
//       ) {
//         return res
//           .status(403)
//           .json({
//             success:
//               false,
//             message:
//               `Role (${req.user.role}) not authorized`,
//           });
//       }

//       next();
//     };
//   };

// middleware/roleMiddleware.js

/**
 * Middleware to authorize users based on their roles
 * Supports exact role matching (like "team lead" with space)
 */
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Check if user exists
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated. Please login first.",
      });
    }

    // Get user role from request
    const userRole = req.user.role;

    // Check if user's role matches any of the allowed roles
    // Using exact match (case-sensitive) since enum stores "team lead"
    const userRoleNorm = userRole?.toLowerCase().replace(/[_\s]+/g, "");

    const hasAccess = roles.some(role => {
      const roleNorm = role.toLowerCase().replace(/[_\s]+/g, "");
      return roleNorm === userRoleNorm;
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: `Role "${userRole}" is not authorized to access this resource.`,
        requiredRoles: roles, // Optional: show what roles are required
      });
    }

    next();
  };
};