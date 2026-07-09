const express = require("express");

const router = express.Router();

const {

createAdjustmentRequest,
 getPendingAdjustmentRequests,
getAllAdjustmentRequests,
getSingleAdjustmentRequest,
getEmployeeAdjustmentRequests,
updateAdjustmentRequest,
deleteAdjustmentRequest,
updateAdjustmentStatus,

} = require("../controllers/adjustmentRequestController");



// Employee

router.post(
"/create",
createAdjustmentRequest
);
router.get(
  "/pending",
  getPendingAdjustmentRequests
);
router.get(
"/employee/:employeeId",
getEmployeeAdjustmentRequests
);

router.put(
"/update/:id",
updateAdjustmentRequest
);

router.delete(
"/delete/:id",
deleteAdjustmentRequest
);



// Admin

router.get(
"/all",
getAllAdjustmentRequests
);

router.get(
"/:id",
getSingleAdjustmentRequest
);

router.put(
"/status/:id",
updateAdjustmentStatus
);



module.exports = router;