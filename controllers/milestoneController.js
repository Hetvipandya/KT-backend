const Milestone =
  require(
    "../models/milestoneModel"
  );

const MilestoneProgress =
  require(
    "../models/MilestoneProgress"
  );


// =======================
// CREATE MILESTONE
// =======================
exports.createMilestone =
  async (req, res) => {
    try {
      const milestone =
        await Milestone.create(
          req.body
        );

      res.status(201).json({
        success: true,
        data: milestone,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// =======================
// GET ALL MILESTONES
// =======================
exports.getMilestones =
  async (req, res) => {
    try {
      const milestones =
        await Milestone.find()
          .populate(
            "projectId"
          )
          .populate(
            "assignedTasks"
          );

      res.json({
        success: true,
        count:
          milestones.length,
        data: milestones,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// =======================
// UPDATE DEADLINE
// =======================
exports.assignDeadline =
  async (req, res) => {
    try {
      const milestone =
        await Milestone.findByIdAndUpdate(
          req.params.id,
          {
            deadline:
              req.body.deadline,
          },
          {
            new: true,
          }
        );

      res.json({
        success: true,
        data: milestone,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// =======================
// TRACK PROGRESS
// =======================
exports.trackProgress =
  async (req, res) => {
    try {
      const {
        progress,
        remarks,
        updatedBy,
      } = req.body;

      const record =
        await MilestoneProgress.create(
          {
            milestoneId:
              req.params.id,
            progress,
            remarks,
            updatedBy,
          }
        );

      await Milestone.findByIdAndUpdate(
        req.params.id,
        {
          progress,
          status:
            progress === 100
              ? "Under Review"
              : "In Progress",
        }
      );

      res.json({
        success: true,
        data: record,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// =======================
// REVIEW MILESTONE
// =======================
exports.reviewMilestone =
  async (req, res) => {
    try {
      const {
        reviewedBy,
        reviewComment,
      } = req.body;

      const milestone =
        await Milestone.findByIdAndUpdate(
          req.params.id,
          {
            reviewedBy,
            reviewComment,
            status:
              "Under Review",
          },
          {
            new: true,
          }
        );

      res.json({
        success: true,
        data: milestone,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// =======================
// COMPLETE MILESTONE
// =======================
exports.completeMilestone =
  async (req, res) => {
    try {
      const milestone =
        await Milestone.findByIdAndUpdate(
          req.params.id,
          {
            status:
              "Completed",

            progress: 100,

            completedAt:
              new Date(),
          },
          {
            new: true,
          }
        );

      res.json({
        success: true,
        data: milestone,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// =======================
// GET SINGLE MILESTONE
// =======================
exports.getMilestoneById =
  async (req, res) => {
    try {
      const milestone =
        await Milestone.findById(
          req.params.id
        )
          .populate(
            "projectId"
          )
          .populate(
            "assignedTasks"
          );

      const progress =
        await MilestoneProgress.find(
          {
            milestoneId:
              req.params.id,
          }
        );

      res.json({
        success: true,
        milestone,
        progress,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };