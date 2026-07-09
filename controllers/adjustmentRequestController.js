const AdjustmentRequest = require("../models/AdjustmentRequest");


// ==========================================
// Create Request
// ==========================================

exports.createAdjustmentRequest =
async (req, res) => {

try {

const {
employeeId,
date,
requestedTime,
sessions,
reason,
} = req.body;

if (
!employeeId ||
!date ||
!reason
) {
return res.status(400).json({
success:false,
message:"Employee, Date and Reason are required.",
});
}

const existing =
await AdjustmentRequest.findOne({
employeeId,
date,
status:"pending",
});

if(existing){
return res.status(400).json({
success:false,
message:"Pending request already exists for this date.",
});
}

const request =
await AdjustmentRequest.create({
employeeId,
date,
requestedTime,
sessions,
reason,
});

res.status(201).json({
success:true,
message:"Adjustment Request Submitted.",
data:request,
});

} catch(error){

res.status(500).json({
success:false,
message:error.message,
});

}

};



// ==========================================
// Get All Requests
// ==========================================

exports.getAllAdjustmentRequests =
async(req,res)=>{

try{

const requests =
await AdjustmentRequest.find()
.populate("employeeId")
.sort({createdAt:-1});

res.json({
success:true,
count:requests.length,
data:requests,
});

}catch(error){

res.status(500).json({
success:false,
message:error.message,
});

}

};



// ==========================================
// Get Single Request
// ==========================================

exports.getSingleAdjustmentRequest =
async(req,res)=>{

try{

const request =
await AdjustmentRequest.findById(req.params.id)
.populate("employeeId");

if(!request){

return res.status(404).json({
success:false,
message:"Request not found.",
});

}

res.json({
success:true,
data:request,
});

}catch(error){

res.status(500).json({
success:false,
message:error.message,
});

}

};



// ==========================================
// Get Employee Requests
// ==========================================

exports.getEmployeeAdjustmentRequests =
async(req,res)=>{

try{

const requests =
await AdjustmentRequest.find({
employeeId:req.params.employeeId,
})
.populate("employeeId")
.sort({createdAt:-1});

res.json({
success:true,
count:requests.length,
data:requests,
});

}catch(error){

res.status(500).json({
success:false,
message:error.message,
});

}

};



// ==========================================
// Update Request
// ==========================================

exports.updateAdjustmentRequest =
async(req,res)=>{

try{

const request =
await AdjustmentRequest.findById(
req.params.id
);

if(!request){

return res.status(404).json({
success:false,
message:"Request not found.",
});

}

if(request.status!="pending"){

return res.status(400).json({
success:false,
message:"Only pending request can be updated.",
});

}

const {
employeeId,
date,
requestedTime,
sessions,
reason,
}=req.body;

if(employeeId)
request.employeeId=employeeId;

if(date)
request.date=date;

if(requestedTime!=undefined)
request.requestedTime=requestedTime;

if(sessions)
request.sessions=sessions;

if(reason)
request.reason=reason;

await request.save();

res.json({
success:true,
message:"Request updated successfully.",
data:request,
});

}catch(error){

res.status(500).json({
success:false,
message:error.message,
});

}

};




// ==========================================
// Delete Request
// ==========================================

exports.deleteAdjustmentRequest =
async(req,res)=>{

try{

const request =
await AdjustmentRequest.findById(
req.params.id
);

if(!request){

return res.status(404).json({
success:false,
message:"Request not found.",
});

}

if(request.status!="pending"){

return res.status(400).json({
success:false,
message:"Approved/Rejected request cannot be deleted.",
});

}

await request.deleteOne();

res.json({
success:true,
message:"Deleted Successfully.",
});

}catch(error){

res.status(500).json({
success:false,
message:error.message,
});

}

};




// ==========================================
// Admin Approve / Reject
// ==========================================

exports.updateAdjustmentStatus =
async(req,res)=>{

try{

const {
status,
adminDecision,
adminNote,
}=req.body;

const request =
await AdjustmentRequest.findById(
req.params.id
);

if(!request){

return res.status(404).json({
success:false,
message:"Request not found.",
});

}

request.status=status;

if(status=="approved"){

request.adminDecision=
adminDecision;

}

request.adminNote=
adminNote || "";

request.resolvedAt=
new Date();

await request.save();

res.json({
success:true,
message:"Status updated successfully.",
data:request,
});

}catch(error){

res.status(500).json({
success:false,
message:error.message,
});

}

};