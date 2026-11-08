const mongoose = require("mongoose");

exports.authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated.",
        });
      }

      const normalizeRole = (role) => {
        const compact = String(role || "")
          .trim()
          .toLowerCase()
          .replace(/[_\s-]+/g, "");
        if (compact === "teamlead" || compact === "teamleader" || compact === "tl") return "teamlead";
        if (compact === "superadmin") return "admin";
        return compact;
      };

      const userRole = normalizeRole(req.user.role);
      const allowedRoles = roles.map(normalizeRole);

      if (allowedRoles.includes(userRole)) {
        return next();
      }

      // If teamlead is an allowed role, check if the authenticated user is a designated Team Lead
      if (allowedRoles.includes("teamlead")) {
        const userId = req.user._id || req.user.id || req.user.userId;
        if (userId) {
          try {
            const Employee = require("../models/Employee");
            const Team = require("../models/Team");

            const rawId = String(userId).trim();
            const idQueries = [
              ...(mongoose.Types.ObjectId.isValid(rawId) ? [{ _id: rawId }] : []),
              { userID: rawId },
              { userId: rawId },
            ];
            if (req.user.email) {
              idQueries.push({ email: req.user.email.toLowerCase() });
            }

            const emp = await Employee.findOne({ $or: idQueries })
              .select("_id role isTeamLead designation")
              .lean();

            if (emp) {
              const empRole = normalizeRole(emp.role);
              const empDesignation = normalizeRole(emp.designation);
              if (emp.isTeamLead === true || empRole === "teamlead" || empDesignation === "teamlead") {
                req.user.isTeamLead = true;
                return next();
              }
            }

            const objectId = mongoose.Types.ObjectId.isValid(rawId) ? new mongoose.Types.ObjectId(rawId) : null;
            const leadMatch = objectId ? [rawId, objectId] : [rawId];

            const [hasTeam, hasSubordinate] = await Promise.all([
              Team.exists({
                $or: [
                  { teamLeadUser: { $in: leadMatch } },
                  { teamLeadEmployee: { $in: leadMatch } },
                  { teamLead: { $in: leadMatch } },
                  { teamLeadId: rawId },
                ],
              }),
              Employee.exists({
                $or: [
                  { teamLeadUser: { $in: leadMatch } },
                  { teamLeadEmployee: { $in: leadMatch } },
                  { teamLead: { $in: leadMatch } },
                  { teamLeadId: rawId },
                ],
              }),
            ]);

            if (hasTeam || hasSubordinate) {
              req.user.isTeamLead = true;
              return next();
            }
          } catch (tlErr) {
            console.error("TL resolution error in authorizeRoles:", tlErr);
          }
        }
      }

      return res.status(403).json({
        success: false,
        message: `Role "${req.user.role}" is not authorized to access this resource.`,
        requiredRoles: roles,
      });
    } catch (error) {
      console.error("Role Middleware Error:", error);

      return res.status(500).json({
        success: false,
        message: "Role authorization failed.",
      });
    }
  };
};
