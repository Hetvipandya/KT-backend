const express = require("express");
const router = express.Router();

const {
  createContact,
  getAllContacts,
  getSingleContact,
  updateContact,
  deleteContact,
} = require("../controllers/contactController");

router.post("/create", createContact);
router.get("/", getAllContacts);
router.get("/:id", getSingleContact);
router.put("/:id", updateContact);
router.delete("/:id", deleteContact);

module.exports = router;