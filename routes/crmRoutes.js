const express =
  require("express");

const router =
  express.Router();

const {
  // Lead
  createLead,
  getAllLeads,
  getSingleLead,
  updateLead,
  deleteLead,
  updateLeadStatus,

  // FollowUp
  createFollowUp,
  getFollowUps,
  getSingleFollowUp,
  updateFollowUp,
  deleteFollowUp,

  // Customer
  createCustomer,
  getCustomers,
  getSingleCustomer,
  updateCustomer,
  deleteCustomer,

} = require(
  "../controllers/crmController"
);


// ===========================
// LEAD ROUTES
// ===========================

// Create Lead
router.post(
  "/lead/create",
  createLead
);

// Get All Leads
router.get(
  "/leads",
  getAllLeads
);

// Get Single Lead
router.get(
  "/lead/:id",
  getSingleLead
);

// Update Lead
router.put(
  "/lead/update/:id",
  updateLead
);

// Delete Lead
router.delete(
  "/lead/delete/:id",
  deleteLead
);

// Update Lead Status
router.put(
  "/lead/status/:id",
  updateLeadStatus
);



// ===========================
// FOLLOWUP ROUTES
// ===========================

// Create FollowUp
router.post(
  "/followup/create",
  createFollowUp
);

// Get All FollowUps
router.get(
  "/followups",
  getFollowUps
);

// Get Single FollowUp
router.get(
  "/followup/:id",
  getSingleFollowUp
);

// Update FollowUp
router.put(
  "/followup/update/:id",
  updateFollowUp
);

// Delete FollowUp
router.delete(
  "/followup/delete/:id",
  deleteFollowUp
);



// ===========================
// CUSTOMER ROUTES
// ===========================

// Create Customer
router.post(
  "/customer/create",
  createCustomer
);

// Get All Customers
router.get(
  "/customers",
  getCustomers
);

// Get Single Customer
router.get(
  "/customer/:id",
  getSingleCustomer
);

// Update Customer
router.put(
  "/customer/update/:id",
  updateCustomer
);

// Delete Customer
router.delete(
  "/customer/delete/:id",
  deleteCustomer
);


module.exports =
  router;