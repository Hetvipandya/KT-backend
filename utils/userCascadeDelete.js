const mongoose = require("mongoose");

const getModel = (name, relativePath) => {
  if (mongoose.models && mongoose.models[name]) {
    return mongoose.models[name];
  }
  try {
    return require(relativePath);
  } catch (err) {
    return null;
  }
};

/**
 * Cascades deletion of a User across Employee, Team, TeamMember, and related collections.
 * 
 * 1. If user is an employee (stored in Employee table):
 *    - Deletes employee record(s) from Employee table
 *    - Deletes employee documents (EmployeeDocument)
 *    - Deletes employee history (EmployeeHistory)
 *    - Deletes attendance, adjustment requests, leaves, leave balances, performance, salary records
 * 2. If user is a Team Lead or in TeamMember:
 *    - Deletes from TeamMember table
 *    - Deletes teams led by this team lead (Team table)
 *    - Removes user/employee from other teams' employees/interns lists
 *    - Unassigns team lead from Projects and Tasks
 *    - Deletes TeamLeadActivity records
 * 3. Cleans up Sessions
 * 
 * @param {Object|String} userIdOrUser - User doc or User _id
 * @param {Object} options - Options
 * @returns {Promise<Object>} Deletion summary
 */
const cascadeDeleteUser = async (userIdOrUser, options = {}) => {
  try {
    let user = null;
    let userId = null;

    if (userIdOrUser && typeof userIdOrUser === "object" && userIdOrUser._id) {
      user = userIdOrUser;
      userId = userIdOrUser._id;
    } else if (userIdOrUser) {
      userId = userIdOrUser;
    }

    const User = getModel("User", "../models/User");
    if (!user && userId && User) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId);
      } else {
        user = await User.findOne({
          $or: [
            { email: String(userId).toLowerCase().trim() },
            { phoneNumber: String(userId).trim() },
          ],
        });
      }
    }

    if (!user && !userId) {
      return { success: false, message: "User not found" };
    }

    const actualUserId = user?._id || userId;
    const userEmail = user?.email ? String(user.email).toLowerCase().trim() : null;

    // ----------------------------------------------------
    // 1. FIND ASSOCIATED EMPLOYEE(S)
    // ----------------------------------------------------
    const Employee = getModel("Employee", "../models/Employee");
    let employees = [];

    if (Employee) {
      const orConditions = [];
      if (actualUserId) {
        orConditions.push({ userID: actualUserId });
        orConditions.push({ userId: actualUserId });
      }
      if (userEmail) {
        orConditions.push({ email: userEmail });
      }

      if (orConditions.length > 0) {
        employees = await Employee.find({ $or: orConditions });
      }
    }

    const employeeIds = employees.map((e) => e._id);
    const allUserIds = [actualUserId].filter(Boolean);

    employees.forEach((e) => {
      if (e.userID) allUserIds.push(e.userID);
      if (e.userId) allUserIds.push(e.userId);
    });

    const uniqueUserIds = [...new Set(allUserIds.map((id) => String(id)))].map((id) =>
      mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
    );

    const allTargetIds = [...new Set([...uniqueUserIds, ...employeeIds])];
    const stringTargetIds = allTargetIds.map((id) => String(id));

    // ----------------------------------------------------
    // 2. DELETE EMPLOYEE DOCUMENTS & HISTORY
    // ----------------------------------------------------
    const EmployeeDocument = getModel("EmployeeDocument", "../models/EmployeeDocument");
    if (EmployeeDocument && (employeeIds.length > 0 || uniqueUserIds.length > 0)) {
      await EmployeeDocument.deleteMany({
        $or: [
          { employeeID: { $in: allTargetIds } },
          { employeeId: { $in: allTargetIds } },
        ],
      });
    }

    const EmployeeHistory = getModel("EmployeeHistory", "../models/EmployeeHistory");
    if (EmployeeHistory && (employeeIds.length > 0 || uniqueUserIds.length > 0)) {
      await EmployeeHistory.deleteMany({
        $or: [
          { employeeID: { $in: allTargetIds } },
          { employeeId: { $in: allTargetIds } },
        ],
      });
    }

    // ----------------------------------------------------
    // 3. DELETE ATTENDANCE, ADJUSTMENTS, LEAVES, PERFORMANCE
    // ----------------------------------------------------
    const Attendance = getModel("Attendance", "../models/Attendance");
    if (Attendance && allTargetIds.length > 0) {
      await Attendance.deleteMany({
        $or: [
          { userId: { $in: allTargetIds } },
          { employeeId: { $in: allTargetIds } },
        ],
      });
    }

    const AdjustmentRequest = getModel("AdjustmentRequest", "../models/AdjustmentRequest");
    if (AdjustmentRequest && allTargetIds.length > 0) {
      await AdjustmentRequest.deleteMany({
        $or: [
          { userId: { $in: allTargetIds } },
          { employeeId: { $in: allTargetIds } },
        ],
      });
    }

    const Leave = getModel("Leave", "../models/Leave");
    if (Leave && allTargetIds.length > 0) {
      await Leave.deleteMany({
        $or: [
          { employeeId: { $in: allTargetIds } },
          { userId: { $in: allTargetIds } },
        ],
      });
    }

    const LeaveBalance = getModel("LeaveBalance", "../models/LeaveBalance");
    if (LeaveBalance && allTargetIds.length > 0) {
      await LeaveBalance.deleteMany({
        $or: [
          { employeeId: { $in: allTargetIds } },
          { userId: { $in: allTargetIds } },
        ],
      });
    }

    const EmployeePerformance = getModel("EmployeePerformance", "../models/EmployeePerformance");
    if (EmployeePerformance && allTargetIds.length > 0) {
      await EmployeePerformance.deleteMany({
        $or: [
          { employeeID: { $in: allTargetIds } },
          { employeeId: { $in: allTargetIds } },
          { userId: { $in: allTargetIds } },
        ],
      });
    }

    // Salary & SalaryStructure
    const Salary = getModel("Salary", "../models/Salary");
    if (Salary && allTargetIds.length > 0) {
      try {
        await Salary.deleteMany({
          $or: [
            { employeeId: { $in: allTargetIds } },
            { userId: { $in: allTargetIds } },
          ],
        });
      } catch (_) {}
    }

    const SalaryStructure = getModel("SalaryStructure", "../models/SalaryStructure");
    if (SalaryStructure && allTargetIds.length > 0) {
      try {
        await SalaryStructure.deleteMany({
          $or: [
            { employeeId: { $in: allTargetIds } },
            { userId: { $in: allTargetIds } },
          ],
        });
      } catch (_) {}
    }

    // ----------------------------------------------------
    // 4. DELETE FROM TEAMMEMBER (CRITICAL: TEAM LEAD / MEMBER)
    // ----------------------------------------------------
    const TeamMember = getModel("TeamMember", "../models/TeamMember");
    if (TeamMember && allTargetIds.length > 0) {
      await TeamMember.deleteMany({
        userId: { $in: allTargetIds },
      });
    }

    // ----------------------------------------------------
    // 5. DELETE / UPDATE TEAMS (TEAM LEAD & MEMBERS)
    // ----------------------------------------------------
    const Team = getModel("Team", "../models/Team");
    if (Team && allTargetIds.length > 0) {
      // Delete any team led by this team lead (User or Employee)
      await Team.deleteMany({
        $or: [
          { teamLeadUser: { $in: allTargetIds } },
          { teamLeadEmployee: { $in: allTargetIds } },
          { teamLeadId: { $in: stringTargetIds } },
          { teamLead: { $in: allTargetIds } },
        ],
      });

      // Remove from any teams where they are an employee or intern
      await Team.updateMany(
        {},
        {
          $pull: {
            employees: { $in: allTargetIds },
            interns: { $in: allTargetIds },
            developers: { $in: allTargetIds },
            designers: { $in: allTargetIds },
            testers: { $in: allTargetIds },
          },
        }
      );
    }

    // ----------------------------------------------------
    // 6. UPDATE PROJECTS (CLEAR TEAM LEAD & REMOVE MEMBERS)
    // ----------------------------------------------------
    const Project = getModel("Project", "../models/projectModel");
    if (Project && allTargetIds.length > 0) {
      await Project.updateMany(
        {
          $or: [
            { teamLeadUser: { $in: allTargetIds } },
            { teamLeadEmployee: { $in: allTargetIds } },
            { teamLead: { $in: allTargetIds } },
          ],
        },
        {
          $set: {
            teamLeadUser: null,
            teamLeadEmployee: null,
            teamLead: null,
          },
        }
      );

      await Project.updateMany(
        {},
        {
          $pull: {
            employees: { $in: allTargetIds },
            interns: { $in: allTargetIds },
            teamMembers: { $in: allTargetIds },
          },
        }
      );
    }

    // ----------------------------------------------------
    // 7. TEAM LEAD ACTIVITY
    // ----------------------------------------------------
    const TeamLeadActivity = getModel("TeamLeadActivity", "../models/TeamLeadActivity");
    if (TeamLeadActivity && allTargetIds.length > 0) {
      await TeamLeadActivity.deleteMany({
        $or: [
          { teamLeadId: { $in: allTargetIds } },
          { employeeId: { $in: allTargetIds } },
        ],
      });
    }

    // ----------------------------------------------------
    // 8. UNASSIGN FROM TASKS
    // ----------------------------------------------------
    const Task = getModel("Task", "../models/taskModel");
    if (Task && allTargetIds.length > 0) {
      await Task.updateMany(
        {
          $or: [
            { assignedTeamLeadUser: { $in: allTargetIds } },
            { assignedTeamLeadEmployee: { $in: allTargetIds } },
          ],
        },
        {
          $set: {
            assignedTeamLeadUser: null,
            assignedTeamLeadEmployee: null,
          },
        }
      );
    }

    // ----------------------------------------------------
    // 9. SESSIONS
    // ----------------------------------------------------
    const Session = getModel("Session", "../models/Session");
    if (Session && allTargetIds.length > 0) {
      await Session.deleteMany({
        userId: { $in: allTargetIds },
      });
    }

    // ----------------------------------------------------
    // 10. DELETE EMPLOYEE(S)
    // ----------------------------------------------------
    if (Employee && employeeIds.length > 0) {
      await Employee.deleteMany({
        _id: { $in: employeeIds },
      });
    }

    return {
      success: true,
      deletedUserId: actualUserId,
      deletedEmployeeIds: employeeIds,
    };
  } catch (error) {
    console.error("Cascade Delete User Error:", error);
    throw error;
  }
};

module.exports = {
  cascadeDeleteUser,
};
