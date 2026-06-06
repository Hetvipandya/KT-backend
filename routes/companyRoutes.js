const express =
  require("express");

const router =
  express.Router();

const {
  createCompany,
  getCompanyDetails,
  updateCompany,
} = require(
  "../controllers/companyController"
);

router.post(
  "/create",
  createCompany
);

router.get(
  "/details",
  getCompanyDetails
);

router.put(
  "/update",
  updateCompany
);

module.exports =
  router;