const express = require("express");
const router = express.Router();

const {
  uploadDocument,
  getAllDocuments,
  getByType,
  deleteDocument,
} = require("../controllers/documentController");

const upload = require("../middleware/uploadMiddleware");

// Upload document
router.post(
  "/upload",
  upload.single("file"),
  uploadDocument
);

// Get all
router.get("/", getAllDocuments);

// Get by type
router.get("/type/:type", getByType);

// Delete
router.delete("/:id", deleteDocument);

module.exports = router;