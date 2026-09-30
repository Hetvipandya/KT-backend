const express = require("express");
const authenticate = require("../middleware/authenticate");
const screenshotController = require("../controllers/screenshot.controller");

const router = express.Router();
 
router.use(authenticate);

router.post("/", screenshotController.createScreenshot);
router.get("/", screenshotController.listScreenshots);
router.get("/:id", screenshotController.getScreenshotById);
router.delete("/:id", screenshotController.deleteScreenshot);

module.exports = router; 