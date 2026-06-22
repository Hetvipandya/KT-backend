  const InterviewRound = require("../models/InterviewRound");
  const Interview = require("../models/Interview");
  const Candidate = require("../models/Candidate");

  exports.approveCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved", 
      },
      { new: true }
    );

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    res.json({
      success: true,
      message: "Candidate approved successfully",
      data: candidate,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.rejectCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
      },
      { new: true }
    );

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    res.json({
      success: true,
      message: "Candidate rejected successfully",
      data: candidate,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

  exports.createInterview = async (req, res) => { 
    try { 
      console.log("API HIT");
      const interview = await Interview.create(req.body);
      res.status(201).json({
        success: true,
        message: "Interview created successfully",
        data: interview,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ 
        success: false,
        message: error.message,
      });
    }
  };

  exports.getAllInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find()
      .populate("candidateId")   // candidate details
      .populate("approvedBy");   // jo approvedBy hoy to user details

    res.status(200).json({
      success: true,
      count: interviews.length,
      data: interviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getInterviewById = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate("candidateId")
      .populate("approvedBy");

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    res.json({
      success: true,
      data: interview,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

  exports.addRound = async (req, res) => {
    try {
      const { interviewId, roundType, interviewerName } = req.body;

      // check interview exists
      const interview = await Interview.findById(interviewId);
      if (!interview) {
        return res.status(404).json({
          success: false,
          message: "Interview not found",
        });
      } 

      const round = await InterviewRound.create({
        interviewId,
        roundType,
        interviewerName,
      });

      res.status(201).json({
        success: true,
        message: "Interview round created successfully",
        data: round,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

exports.approveInterview = async (req, res) => {
  try {
    const interview =
      await Interview.findByIdAndUpdate(
        req.params.id,
        {
          status: "approved",
          approvedAt: new Date(),
        },
        { new: true }
      );

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    res.json({
      success: true,
      message: "Candidate approved successfully",
      data: interview,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

  exports.rejectInterview =
  async (req, res) => {
    try {
      const interview =
        await Interview.findByIdAndUpdate(
          req.params.id,
          {
            status:
              "rejected",
            rejectionReason:
              req.body.reason,
          },
          { new: true }
        );

      if (!interview) {
        return res
          .status(404)
          .json({
            success:
              false,
            message:
              "Interview not found",
          });
      }

      res.json({
        success: true,
        message:
          "Candidate rejected successfully",
        data: interview,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


  // =========================
  // 🔹 GET ALL ROUNDS
  // =========================
  exports.getAllRounds = async (req, res) => {
    try {
      const rounds = await InterviewRound.find()
        .populate("interviewId");

      res.json({
        success: true,
        data: rounds,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


  // =========================
  // 🔹 GET ROUNDS BY INTERVIEW ID
  // =========================
  exports.getRoundsByInterview = async (req, res) => {
    try {
      const rounds = await InterviewRound.find({
        interviewId: req.params.interviewId,
      });

      res.json({
        success: true,
        data: rounds,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


  // =========================
  // 🔹 UPDATE ROUND (feedback / rating / status)
  // =========================
  exports.updateRound = async (req, res) => {
    try {
      const round = await InterviewRound.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      if (!round) {
        return res.status(404).json({
          success: false,
          message: "Round not found",
        });
      }

      res.json({
        success: true,
        message: "Round updated successfully",
        data: round,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


  // =========================
  // 🔹 DELETE ROUND
  // =========================
  exports.deleteRound = async (req, res) => {
    try {
      const round = await InterviewRound.findByIdAndDelete(req.params.id);

      if (!round) {
        return res.status(404).json({
          success: false,
          message: "Round not found",
        });
      }

      res.json({
        success: true,
        message: "Round deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };