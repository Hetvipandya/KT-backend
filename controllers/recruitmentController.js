const Job = require("../models/Job");
const Candidate = require("../models/Candidate"); 
const Interview = require("../models/Interview");
const Offer = require("../models/Offer");

//
// ================= JOB ================= 
//

exports.createJob = async (req, res) => {
  try {
    const job = await Job.create(req.body);
    res.status(201).json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find()
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: jobs.length,
      data: jobs,
    });
  } catch (error) {
    console.log(
      "Get All Jobs Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllCandidates = async (req, res) => {
  try {
    const candidates = await Candidate.find();

    res.status(200).json({
      success: true,
      count: candidates.length,
      candidates,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.publishJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      {
        isPublished: true,
        status: req.body.status, // ✅ ADD THIS
      },
      { new: true }
    );

    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

//
// ================= CANDIDATE =================
//

exports.addCandidate = async (req, res) => {
  try {
    console.log("BODY =", req.body);
    console.log("FILE =", req.file);

   const candidate =
  await Candidate.create({
    jobId: req.body.jobId,
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    resume: req.file
      ? req.file.path
      : "",
  });

    res.status(201).json({
      success: true,
      candidate,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateCandidateStatus = async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    res.json({ success: true, candidate });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.rateCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { rating: req.body.rating },
      { new: true }
    );

    res.json({ success: true, candidate });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

//
// ================= INTERVIEW =================
//

exports.scheduleInterview = async (req, res) => {
  try {
    const interview = await Interview.create(req.body);

    await Candidate.findByIdAndUpdate(req.body.candidateId, {
      status: "interview",
    });

    res.status(201).json({ success: true, interview });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.completeInterview = async (req, res) => {
  try {
    const interview = await Interview.findByIdAndUpdate(
      req.params.id,
      {
        status: "completed",
        feedback: req.body.feedback,
        rating: req.body.rating,
      },
      { new: true }
    );

    res.json({ success: true, interview });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

//
// ================= OFFER =================
//

exports.createOffer = async (req, res) => {
  try {
    const offer = await Offer.create(req.body);

    await Candidate.findByIdAndUpdate(req.body.candidateId, {
      status: "offer_sent",
    });

    res.status(201).json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.updateOfferStatus = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (req.body.status === "accepted") {
      await Candidate.findByIdAndUpdate(offer.candidateId, {
        status: "joined",
      });
    }

    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};