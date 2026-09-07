const express = require("express");
const router = express.Router();
const positionController = require("../controllers/positionController");

router.post("/add", positionController.addPosition);
router.get("/", positionController.getAllPositions);
router.get("/:id", positionController.getPositionById);
router.put("/:id", positionController.updatePosition);
router.delete("/:id", positionController.deletePosition);

module.exports = router;