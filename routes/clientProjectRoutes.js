const router = require("express").Router();

const ctrl = require(
  "../controllers/clientProjectController"
);

// Client
router.post("/add", ctrl.addClient);
router.get("/clients", ctrl.getClients);

// Meeting
router.post("/meeting/add", ctrl.addMeeting);

// Feedback
router.post("/feedback/add", ctrl.addFeedback);

// Deliverable
router.post("/deliverable/add", ctrl.addDeliverable);
router.get("/deliverables", ctrl.getDeliverables);

module.exports = router;