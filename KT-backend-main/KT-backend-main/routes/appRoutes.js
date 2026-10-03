const express = require("express");
const router = express.Router();
const applicationController = require("../controllers/applicationController");

router.post("/create", applicationController.createApplication);
router.get("/all", applicationController.getApplications);
router.get("/:id", applicationController.getApplicationById);
router.put("/update/:id", applicationController.updateApplicationById);
router.delete("/delete/:id", applicationController.deleteApplication);

module.exports = router;