const Leave =
  require("../models/Leave");

const LeaveBalance =
  require(
    "../models/LeaveBalance"
  );

const Holiday =
  require(
    "../models/Holiday"
  );

// ================= APPLY LEAVE =================
exports.applyLeave =
  async (req, res) => {
    try {
      const {
        userId,
        leaveType,
        startDate,
        endDate,
        reason, 
      } = req.body;

      if (!userId) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "User ID is required",
          });
      }

      const totalDays =
        Math.ceil(
          (
            new Date(endDate) -
            new Date(startDate)
          ) /
            (
              1000 *
              60 *
              60 *
              24
            )
        ) + 1;

      const leave =
        await Leave.create({
          employeeId:
            userId,
          leaveType,
          startDate,
          endDate,
          totalDays,
          reason,
        });

      // Auto create leave balance if not exists
      const existingBalance =
        await LeaveBalance.findOne(
          {
            employeeId:
              userId,
          }
        );

      if (
        !existingBalance
      ) {
        await LeaveBalance.create(
          {
            employeeId:
              userId,
            totalLeaves: 20,
            usedLeaves: 0,
            remainingLeaves: 20,
          }
        );
      }

      res.status(201).json({
        success: true,
        message:
          "Leave request sent successfully",
        data: leave,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

exports.getAllLeaves =
  async (req, res) => {
    try {
      const leaves =
        await Leave.find({})
          .populate({
            path:
              "employeeId",
            select:
              "firstName lastName email role employeeID",
          })
          .sort({
            createdAt: -1,
          });

      return res
        .status(200)
        .json({
          success: true,
          total:
            leaves.length,
          data: leaves,
        });
    } catch (error) {
      console.log(
        "GET ALL LEAVES ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

// ================= TEAM LEAD APPROVAL =================
exports.teamLeadApproval =
  async (req, res) => {
    try {
      const {
        leaveId,
        status,
        remark,
      } = req.body;

      const leave =
        await Leave.findById(
          leaveId
        );

      if (!leave) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Leave not found",
          });
      }

      leave.teamLeadStatus =
        status;

      leave.remark =
        remark;

      if (
        status === "approved"
      ) {
        leave.status =
          "pending_hr";
      } else {
        leave.status =
          "rejected";
      }

      await leave.save();

      res.status(200).json({
        success: true,
        message:
          "Team lead action completed",
        data: leave,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ================= HR APPROVAL =================
exports.hrApproval =
  async (req, res) => {
    try {
      const {
        leaveId,
        status,
        remark,
      } = req.body;

      const leave =
        await Leave.findById(
          leaveId
        );

      if (!leave) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Leave not found",
          });
      }

      leave.hrStatus =
        status;

      leave.remark =
        remark;

      if (
        status === "approved"
      ) {
        leave.status =
          "approved";

        let balance =
          await LeaveBalance.findOne(
            {
              employeeId:
                leave.employeeId,
            }
          );

        // Create balance if missing
        if (!balance) {
          balance =
            await LeaveBalance.create(
              {
                employeeId:
                  leave.employeeId,
                totalLeaves: 20,
                usedLeaves: 0,
                remainingLeaves: 20,
              }
            );
        }

        balance.usedLeaves +=
          leave.totalDays;

        balance.remainingLeaves -=
          leave.totalDays;

        await balance.save();
      } else {
        leave.status =
          "rejected";
      }

      await leave.save();

      res.status(200).json({
        success: true,
        message:
          "HR approval completed",
        data: leave,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ================= GET USER LEAVES =================
exports.getMyLeaves =
  async (req, res) => {
    try {
      const {
        userId,
      } = req.params;

      const leaves =
        await Leave.find({
          employeeId:
            userId,
        })
          .populate(
            "employeeId",
            "name email role"
          )
          .sort({
            createdAt: -1,
          });

      res.status(200).json({
        success: true,
        total:
          leaves.length,
        data: leaves,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ================= GET LEAVE BALANCE =================
exports.getLeaveBalance =
  async (req, res) => {
    try {
      const {
        userId,
      } = req.params;

      let balance =
        await LeaveBalance.findOne(
          {
            employeeId:
              userId,
          }
        );

      // Auto create if not exists
      if (!balance) {
        balance =
          await LeaveBalance.create(
            {
              employeeId:
                userId,
              totalLeaves: 20,
              usedLeaves: 0,
              remainingLeaves: 20,
            }
          );
      }

      res.status(200).json({
        success: true,
        data: balance,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ================= CREATE HOLIDAY =================
exports.createHoliday =
  async (req, res) => {
    try {
      const {
        holidayName,
        holidayDate,
        isPublicHoliday,
      } = req.body;

      const holiday =
        await Holiday.create({
          holidayName,
          holidayDate,
          isPublicHoliday,
        });

      res.status(201).json({
        success: true,
        message:
          "Holiday created successfully",
        data: holiday,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ================= GET ALL HOLIDAYS =================
exports.getAllHolidays =
  async (req, res) => {
    try {
      const holidays =
        await Holiday.find().sort(
          {
            holidayDate: 1,
          }
        );

      res.status(200).json({
        success: true,
        total:
          holidays.length,
        data: holidays,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };