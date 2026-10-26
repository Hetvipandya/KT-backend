const Team =
  require("../models/Team");

const TeamMember =
  require( 
    "../models/TeamMember" 
  );
const { notifyNewAssignments } = require("../utils/assignmentNotifications");
const toArray = (value) => Array.isArray(value) ? value : value ? [value] : [];
  
// =================
// CREATE TEAM
// =================
exports.createTeam = async (req, res) => {
  try {
    const { 
      projectId,
      projectManager,
      teamLead,
      developers,
      interns,
      designers,
      testers,
    } = req.body;

    if (!projectId || !projectManager) {
      return res.status(400).json({
        success: false,
        message: "Project ID and Project Manager are required",
      });
    }

    // 1. Create Team
    const team = await Team.create({
      projectId,
      projectManager,
      teamLead,
      developers,
      interns,
      designers,
      testers,
    });

    // 2. INSERT TEAM LEAD INTO TEAMMEMBER (IMPORTANT FIX)
    if (teamLead) {
      await TeamMember.create({
        userId: teamLead,
        projectId,
        role: "Team Lead",
        status: "Assigned",
      });
    }

    await notifyNewAssignments({ after: teamLead ? [{ id: teamLead, kind: "employee" }] : [], action: "TEAM_LEAD_ASSIGNED", entityType: "Team", recordId: team._id, recordName: team.name });
    await notifyNewAssignments({
      after: [
        ...toArray(developers).map((id) => ({ id, kind: "employee" })),
        ...toArray(designers).map((id) => ({ id, kind: "employee" })),
        ...toArray(testers).map((id) => ({ id, kind: "employee" })),
      ],
      action: "TEAM_EMPLOYEE_ASSIGNED", entityType: "Team", recordId: team._id, recordName: team.name,
    });
    await notifyNewAssignments({ after: toArray(interns).map((id) => ({ id, kind: "user" })), action: "TEAM_INTERN_ASSIGNED", entityType: "Team", recordId: team._id, recordName: team.name });

    return res.status(201).json({
      success: true,
      message: "Team created successfully",
      data: team,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// =================
// ASSIGN TEAM
// =================
exports.assignTeam =
  async (req, res) => {
    try {
      const {
        projectId,
        projectManager,
        teamLead,
        developers,
        interns,
        designers,
        testers,
      } = req.body;

      const team =
        await Team.create({
          projectId,
          projectManager,
          teamLead,
          developers,
          interns,
          designers,
          testers,
        });

      await notifyNewAssignments({ after: teamLead ? [{ id: teamLead, kind: "employee" }] : [], action: "TEAM_LEAD_ASSIGNED", entityType: "Team", recordId: team._id, recordName: team.name });
      await notifyNewAssignments({
        after: [
          ...toArray(developers).map((id) => ({ id, kind: "employee" })),
          ...toArray(designers).map((id) => ({ id, kind: "employee" })),
          ...toArray(testers).map((id) => ({ id, kind: "employee" })),
        ],
        action: "TEAM_EMPLOYEE_ASSIGNED", entityType: "Team", recordId: team._id, recordName: team.name,
      });
      await notifyNewAssignments({ after: toArray(interns).map((id) => ({ id, kind: "user" })), action: "TEAM_INTERN_ASSIGNED", entityType: "Team", recordId: team._id, recordName: team.name });

      return res
        .status(201)
        .json({
          success: true,
          message:
            "Team assigned successfully",
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

// =================
// TEAM LIST
// =================
exports.getTeamList =
  async (req, res) => {
    try {
      const teams =
        await Team.find()
          .populate(
            "projectId",
            "projectName"
          )
          .populate(
            "projectManager",
            "name email"
          )
          .populate(
            "teamLead",
            "name email"
          )
          .populate(
            "developers",
            "name email"
          )
          .populate(
            "interns",
            "name email"
          )
          .populate(
            "designers",
            "name email"
          )
          .populate(
            "testers",
            "name email"
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

// =================
// UPDATE TEAM
// =================
exports.updateTeam =
  async (req, res) => {
    try {
      const team =
        await Team.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
          }
        );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Team updated successfully",
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

// =================
// REMOVE TEAM
// =================
exports.removeTeam =
  async (req, res) => {
    try {
      await Team.findByIdAndDelete(
        req.params.id
      );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Team removed successfully",
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