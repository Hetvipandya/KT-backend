const ProjectFollowUp =
  require(
    "../models/ProjectFollowUp"
  );

// =====================
// CREATE FOLLOW-UP
// =====================
exports.createFollowUp =
  async (req, res) => {
    try {
      const {
        projectId,
        followUpType,
        dailyFollowUp,
        weeklyFollowUp,
        monthlyReview,
        managementReview,
        createdBy,
      } = req.body;

      // REQUIRED
      if (
        !projectId ||
        !followUpType
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Project ID and Follow-Up Type are required",
          });
      }

      // DAILY VALIDATION
      if (
        followUpType ===
          "Daily" &&
        !dailyFollowUp
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Daily follow-up data is required",
          });
      }

      // WEEKLY VALIDATION
      if (
        followUpType ===
          "Weekly" &&
        !weeklyFollowUp
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Weekly follow-up data is required",
          });
      }

      // MONTHLY VALIDATION
      if (
        followUpType ===
          "Monthly" &&
        !monthlyReview
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Monthly review data is required",
          });
      }

      // MANAGEMENT VALIDATION
      if (
        followUpType ===
          "Management" &&
        !managementReview
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Management review data is required",
          });
      }

      const followUp =
        await ProjectFollowUp.create(
          {
            projectId,
            followUpType,
            dailyFollowUp,
            weeklyFollowUp,
            monthlyReview,
            managementReview,
            createdBy,
          }
        );

      res.status(201).json({
        success: true,
        message: `${followUpType} created successfully`,
        data: followUp,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// =====================
// GET ALL FOLLOW-UPS
// =====================
exports.getFollowUpList =
  async (req, res) => {
    try {
      const {
        followUpType,
        projectId,
      } = req.query;

      let filter = {};

      // FILTER BY TYPE
      if (
        followUpType
      ) {
        filter.followUpType =
          followUpType;
      }

      // FILTER BY PROJECT
      if (projectId) {
        filter.projectId =
          projectId;
      }

      const followUps =
        await ProjectFollowUp.find(
          filter
        )
          .populate(
            "projectId",
            "projectName"
          )
          .populate(
            "createdBy",
            "name email role"
          )
          .sort({
            createdAt: -1,
          });

      res.status(200).json({
        success: true,
        count:
          followUps.length,
        data: followUps,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// =====================
// GET SINGLE FOLLOW-UP
// =====================
exports.getSingleFollowUp =
  async (req, res) => {
    try {
      const followUp =
        await ProjectFollowUp.findById(
          req.params.id
        )
          .populate(
            "projectId",
            "projectName"
          )
          .populate(
            "createdBy",
            "name email role"
          );

      if (!followUp) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Follow-up not found",
          });
      }

      res.status(200).json({
        success: true,
        data: followUp,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// =====================
// UPDATE FOLLOW-UP
// =====================
exports.updateFollowUp =
  async (req, res) => {
    try {
      const followUp =
        await ProjectFollowUp.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true,
          }
        );

      if (!followUp) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Follow-up not found",
          });
      }

      res.status(200).json({
        success: true,
        message:
          "Follow-up updated successfully",
        data: followUp,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// =====================
// DELETE FOLLOW-UP
// =====================
exports.deleteFollowUp =
  async (req, res) => {
    try {
      const followUp =
        await ProjectFollowUp.findByIdAndDelete(
          req.params.id
        );

      if (!followUp) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Follow-up not found",
          });
      }

      res.status(200).json({
        success: true,
        message:
          "Follow-up deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };