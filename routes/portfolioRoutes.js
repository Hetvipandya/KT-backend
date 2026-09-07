const express = require("express");
const router = express.Router();

const {
  addPortfolio,
  getPortfolios,
  getPortfolioById,
  updatePortfolio,
  deletePortfolio,
} = require("../controllers/portfolioController");

// CREATE
router.post("/add", addPortfolio);

// READ
router.get("/get", getPortfolios);
router.get("/get/:id", getPortfolioById);

// UPDATE
router.put("/edit/:id", updatePortfolio);

// DELETE
router.delete("/delete/:id", deletePortfolio);

module.exports = router;