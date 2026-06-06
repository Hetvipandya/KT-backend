const Team =
  require("../models/Team");

// ================= CREATE TEAM =================
exports.createTeam =
  async (req, res) => {
    try {
      const {
        teamName,
        description,
      } = req.body;

      if (!teamName) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Team name is required",
          });
      }

      const existTeam =
        await Team.findOne({
          teamName,
        });

      if (existTeam) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Team already exists",
          });
      }

      const team =
        await Team.create({
          teamName,
          description,
        });

      return res
        .status(201)
        .json({
          success: true,
          message:
            "Team created successfully",
          data: team,
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

// ================= TEAM LIST =================
exports.getTeamList =
  async (req, res) => {
    try {
      const teams =
        await Team.find()
          .populate(
            "departmentId",
            "departmentName"
          );

      return res
        .status(200)
        .json({
          success: true,
          count:
            teams.length,
          data: teams,
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };