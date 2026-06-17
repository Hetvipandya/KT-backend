const router = require("express").Router();
const ctrl = require("../controllers/recruitmentController");

// ================= JOB =================
router.post("/job/create", ctrl.createJob); 
router.put("/job/publish/:id", ctrl.publishJob);

// ================= CANDIDATE =================
router.post("/candidate/add", ctrl.addCandidate);
router.get(
  "/candidate",
  ctrl.getAllCandidates
);
router.put("/candidate/status/:id", ctrl.updateCandidateStatus);
router.put("/candidate/rate/:id", ctrl.rateCandidate);

// ================= INTERVIEW =================
router.post("/interview/schedule", ctrl.scheduleInterview);
router.put("/interview/complete/:id", ctrl.completeInterview);

// ================= OFFER =================
router.post("/offer/create", ctrl.createOffer);
router.put("/offer/status/:id", ctrl.updateOfferStatus);

module.exports = router;