// const AdjustmentRequest = require("../models/AdjustmentRequest");
// const Attendance = require("../models/Attendance");

// const parseISTDateTime = (dateString, timeString) => {
//   const [year, month, day] = dateString.split("-").map(Number);
//   const [hour, minute] = timeString.split(":").map(Number);
//   return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0));
// };

// // ==========================================
// // Create Request
// // ==========================================

// exports.createAdjustmentRequest =
// async (req, res) => {

// try { 

// const {
// employeeId,
// date,
// requestedTime,
// sessions,
// reason,
// } = req.body;

// if (
// !employeeId ||
// !date ||
// !reason
// ) {
// return res.status(400).json({
// success:false,
// message:"Employee, Date and Reason are required.",
// });
// }

// const existing =
// await AdjustmentRequest.findOne({
// employeeId,
// date,
// status:"pending",
// });

// if(existing){
// return res.status(400).json({
// success:false,
// message:"Pending request already exists for this date.",
// });
// }

// const request =
// await AdjustmentRequest.create({
// employeeId,
// date,
// requestedTime,
// sessions,
// reason,
// });

// res.status(201).json({
// success:true,
// message:"Adjustment Request Submitted.",
// data:request,
// });

// } catch(error){

// res.status(500).json({
// success:false,
// message:error.message,
// });

// }

// };

// exports.getPendingAdjustmentRequests = async (req, res) => {
//   try {
//     const requests = await AdjustmentRequest.find({
//       status: "pending",
//     })
//       .populate({
//         path: "employeeId",
//         select: "name firstName lastName" // Make sure these fields exist
//       })
//       .sort({ createdAt: -1 });

//     res.status(200).json({
//       success: true,
//       count: requests.length,
//       data: requests,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };



// // ==========================================
// // Get All Requests
// // ==========================================

// exports.getAllAdjustmentRequests =
// async(req,res)=>{

// try{

// const requests =
// await AdjustmentRequest.find()
// .populate("employeeId")
// .sort({createdAt:-1});

// res.json({
// success:true,
// count:requests.length,
// data:requests,
// });

// }catch(error){

// res.status(500).json({
// success:false,
// message:error.message,
// });

// }

// };



// // ==========================================
// // Get Single Request
// // ==========================================

// exports.getSingleAdjustmentRequest =
// async(req,res)=>{

// try{

// const request =
// await AdjustmentRequest.findById(req.params.id)
// .populate("employeeId");

// if(!request){

// return res.status(404).json({
// success:false,
// message:"Request not found.",
// });

// }

// res.json({
// success:true,
// data:request,
// });

// }catch(error){

// res.status(500).json({
// success:false,
// message:error.message,
// });

// }

// };



// // ==========================================
// // Get Employee Requests
// // ==========================================

// exports.getEmployeeAdjustmentRequests =
// async(req,res)=>{

// try{

// const requests =
// await AdjustmentRequest.find({
// employeeId:req.params.employeeId,
// })
// .populate("employeeId")
// .sort({createdAt:-1});

// res.json({
// success:true,
// count:requests.length,
// data:requests,
// });

// }catch(error){

// res.status(500).json({
// success:false,
// message:error.message,
// });

// }

// };



// // ==========================================
// // Update Request
// // ==========================================

// exports.updateAdjustmentRequest =
// async(req,res)=>{

// try{

// const request =
// await AdjustmentRequest.findById(
// req.params.id
// );

// if(!request){

// return res.status(404).json({
// success:false,
// message:"Request not found.",
// });

// }

// if(request.status!="pending"){

// return res.status(400).json({
// success:false,
// message:"Only pending request can be updated.",
// });

// }

// const {
// employeeId,
// date,
// requestedTime,
// sessions,
// reason,
// }=req.body;

// if(employeeId)
// request.employeeId=employeeId;

// if(date)
// request.date=date;

// if(requestedTime!=undefined)
// request.requestedTime=requestedTime;

// if(sessions)
// request.sessions=sessions;

// if(reason)
// request.reason=reason;

// await request.save();

// res.json({
// success:true,
// message:"Request updated successfully.",
// data:request,
// });

// }catch(error){

// res.status(500).json({
// success:false,
// message:error.message,
// });

// }

// };




// // ==========================================
// // Delete Request
// // ==========================================

// exports.deleteAdjustmentRequest =
// async(req,res)=>{

// try{

// const request =
// await AdjustmentRequest.findById(
// req.params.id
// );

// if(!request){

// return res.status(404).json({
// success:false,
// message:"Request not found.",
// });

// }

// if(request.status!="pending"){

// return res.status(400).json({
// success:false,
// message:"Approved/Rejected request cannot be deleted.",
// });

// }

// await request.deleteOne();

// res.json({
// success:true,
// message:"Deleted Successfully.",
// });

// }catch(error){

// res.status(500).json({
// success:false,
// message:error.message,
// });

// }

// };




// // ==========================================
// // Admin Approve / Reject
// // ==========================================

// exports.updateAdjustmentStatus = async (req, res) => {
//   try {

//     const {
//       status,
//       adminDecision,
//       adminNote
//     } = req.body;

//     const request =
//       await AdjustmentRequest.findById(req.params.id);

//     if (!request) {
//       return res.status(404).json({
//         success: false,
//         message: "Adjustment request not found"
//       });
//     }

//     request.status = status;
//     request.adminDecision = adminDecision || null;
//     request.adminNote = adminNote || "";
//     request.resolvedAt = new Date();

//     // ==========================
//     // Update Attendance
//     // ==========================

//     if (status === "approved") {

//       const attendance =
//         await Attendance.findOne({
//           userId: request.employeeId,
//           date: request.date
//         });

//       if (!attendance) {
//         return res.status(404).json({
//           success: false,
//           message: "Attendance not found."
//         });
//       }

//       // First Session
//       if (
//         request.sessions &&
//         request.sessions.length > 0
//       ) {

//         const first =
//           request.sessions[0];

//         const last =
//           request.sessions[
//           request.sessions.length - 1
//           ];

//         // Check In
//         if (first.checkin) {

//           const checkIn = parseISTDateTime(
//             request.date,
//             first.checkin
//           );

//           attendance.checkInTime = checkIn;
//           attendance.approvedCheckInTime = checkIn;
//         }

//         // Check Out
//         if (last.checkout) {

//           const checkOut = parseISTDateTime(
//             request.date,
//             last.checkout
//           );

//           attendance.checkOutTime = checkOut;

//           let totalMinutes =
//             (checkOut -
//               attendance.checkInTime) /
//             (1000 * 60);

//           totalMinutes -=
//             Math.min(
//               attendance.totalBreakTime,
//               60
//             );

//           if (totalMinutes < 0)
//             totalMinutes = 0;

//           attendance.totalWorkTime =
//             Number(
//               (
//                 totalMinutes / 60
//               ).toFixed(2)
//             );
//         }

//       }

//       // Attendance Status

//       if (adminDecision) {
//         attendance.status =
//           adminDecision;
//       }

//       attendance.approvalStatus =
//         "approved";

//       await attendance.save();

//     }

//     await request.save();

//     res.json({
//       success: true,
//       message:
//         "Adjustment processed successfully.",
//       data: request
//     });

//   } catch (err) {

//     res.status(500).json({
//       success: false,
//       message: err.message
//     });

//   }
// };


const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const TeamLead = require("../models/Team");

// Helper function to parse time
const parseTimeToDate = (dateStr, timeStr) => {
  if (!timeStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0));
};

// Helper to get employee name from different sources - FIXED
const getEmployeeName = async (employeeId) => {
  if (!employeeId) return 'Unknown Employee';
  
  try {
    // 1. Check in Employee collection
    let employee = await Employee.findById(employeeId).lean();
    if (employee) {
      const firstName = employee.firstName || '';
      const lastName = employee.lastName || '';
      const name = employee.name || '';
      return [firstName, lastName].filter(Boolean).join(' ') || name || 'Unknown Employee';
    }

    // 2. Check in User collection (for interns)
    let user = await User.findById(employeeId).lean();
    if (user) {
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      const name = user.name || '';
      return [firstName, lastName].filter(Boolean).join(' ') || name || 'Unknown Employee';
    }

    // 3. Check in TeamLead collection
  // Team Lead
const team = await TeamLead.findOne({
    teamLeadUser: employeeId
})
.populate({
    path: "teamLeadUser",
    select: "name"
})
.lean();

if (team && team.teamLeadUser) {
    return team.teamLeadUser.name;
}
    if (teamLead) {
      const firstName = teamLead.firstName || '';
      const lastName = teamLead.lastName || '';
      const name = teamLead.name || '';
      return [firstName, lastName].filter(Boolean).join(' ') || name || 'Unknown Employee';
    }

    // 4. If not found in any collection, try to find in any collection with different ID field
    // Check Employee with employeeId field
    let employeeByEmpId = await Employee.findOne({ employeeId: employeeId }).lean();
    if (employeeByEmpId) {
      const firstName = employeeByEmpId.firstName || '';
      const lastName = employeeByEmpId.lastName || '';
      const name = employeeByEmpId.name || '';
      return [firstName, lastName].filter(Boolean).join(' ') || name || 'Unknown Employee';
    }

    // Check User with employeeId field
    let userByEmpId = await User.findOne({ employeeId: employeeId }).lean();
    if (userByEmpId) {
      const firstName = userByEmpId.firstName || '';
      const lastName = userByEmpId.lastName || '';
      const name = userByEmpId.name || '';
      return [firstName, lastName].filter(Boolean).join(' ') || name || 'Unknown Employee';
    }

    return 'Unknown Employee';
    
  } catch (error) {
    console.error('Error getting employee name:', error);
    return 'Unknown Employee';
  }
};

// ==========================================
// Direct Adjustment - Immediate Attendance Update
// ==========================================

exports.createDirectAdjustment = async (req, res) => {
  try {
    const {
      employeeId,
      date,
      sessions,
      reason,
    } = req.body;

    // Validate required fields
    if (!employeeId || !date || !reason) {
      return res.status(400).json({
        success: false,
        message: "Employee, Date and Reason are required.",
      });
    }

    // Check if any session has data
    let hasAnyTime = false;
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        if (session.checkin || session.breakStart || session.breakEnd || session.checkout) {
          hasAnyTime = true;
          break;
        }
      }
    }

    if (!hasAnyTime) {
      return res.status(400).json({
        success: false,
        message: "At least one time field is required.",
      });
    }

    // Get employee name from any source
    const employeeName = await getEmployeeName(employeeId);
    
    // Determine user type by checking which collection the employee belongs to
// ======================================
// Detect User Type
// ======================================

let userType = "employee";

try {

    // Employee collection
    const employee = await Employee.findById(employeeId).lean();

    if (employee) {

        userType = "employee";

    } else {

        // User collection
        const user = await User.findById(employeeId).lean();

        if (user) {

            if (user.role === "intern") {
                userType = "intern";
            }

            else if (user.role === "admin") {
                userType = "admin";
            }

            else if (user.role === "hr") {
                userType = "admin";     // અથવા Attendance enum માં hr add કર
            }

            else {

                // Team Collection માં check કર
                const team = await TeamLead.findOne({
                    teamLeadUser: user._id
                }).lean();

                if (team) {
                    userType = "team lead"; // Attendance schema પ્રમાણે રાખજે
                }
            }
        }
    }

} catch (err) {

    console.error("User type error :", err);

}

    // Find or create attendance record
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({
      userId: employeeId,
      date: attendanceDate
    });

    if (!attendance) {
      // Create new attendance record with userType
      attendance = new Attendance({
        userId: employeeId,
        userType: userType, // Add this required field
        date: attendanceDate,
        status: 'present',
        checkInTime: null,
        checkOutTime: null,
        totalBreakTime: 0,
        totalWorkTime: 0,
        approvalStatus: 'approved',
        sessions: []
      });
    } else {
      // Update userType if it's missing or different
      if (!attendance.userType) {
        attendance.userType = userType;
      }
    }

    // Update sessions with the new times
    if (sessions && sessions.length > 0) {
      const firstSession = sessions[0];
      const lastSession = sessions[sessions.length - 1];

      // Handle Check In
      if (firstSession.checkin) {
        const checkInTime = parseTimeToDate(date, firstSession.checkin);
        if (checkInTime) {
          attendance.checkInTime = checkInTime;
          attendance.approvedCheckInTime = checkInTime;
        }
      }

      // Handle Check Out
      if (lastSession.checkout) {
        const checkOutTime = parseTimeToDate(date, lastSession.checkout);
        if (checkOutTime) {
          attendance.checkOutTime = checkOutTime;
        }
      }

      // Calculate break time
      let totalBreakMinutes = 0;
      for (const session of sessions) {
        if (session.breakStart && session.breakEnd) {
          const breakStart = parseTimeToDate(date, session.breakStart);
          const breakEnd = parseTimeToDate(date, session.breakEnd);
          if (breakStart && breakEnd) {
            const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
            totalBreakMinutes += breakMinutes;
          }
        }
      }
      attendance.totalBreakTime = Math.min(totalBreakMinutes, 120);

      // Calculate total work time
      if (attendance.checkInTime && attendance.checkOutTime) {
        let totalMinutes = (attendance.checkOutTime - attendance.checkInTime) / (1000 * 60);
        totalMinutes -= attendance.totalBreakTime;
        if (totalMinutes < 0) totalMinutes = 0;
        attendance.totalWorkTime = Number((totalMinutes / 60).toFixed(2));
      }

      // Set approval status
      attendance.approvalStatus = 'approved';
    }

    // Save attendance
    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully.",
      data: {
        attendance,
        employeeName
      }
    });

  } catch (error) {
    console.error('Error in direct adjustment:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// ==========================================
// Get Adjustment History - FIXED
// ==========================================

exports.getAdjustmentHistory = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const query = {};
    if (employeeId) query.userId = employeeId;

    const attendances = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(20);

    // Get employee names for each attendance
    const adjustments = await Promise.all(attendances.map(async (att) => {
      const name = await getEmployeeName(att.userId);
      return {
        _id: att._id,
        employeeId: att.userId,
        employeeName: name,
        date: att.date,
        checkInTime: att.checkInTime,
        checkOutTime: att.checkOutTime,
        totalBreakTime: att.totalBreakTime,
        totalWorkTime: att.totalWorkTime,
        status: att.status,
      };
    }));

    res.status(200).json({
      success: true,
      data: adjustments
    });
  } catch (error) {
    console.error('Error fetching adjustment history:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// Test endpoint to debug employee name
// ==========================================

exports.testGetEmployeeName = async (req, res) => {
  try {
    const { id } = req.params;
    const name = await getEmployeeName(id);
    res.json({
      success: true,
      employeeId: id,
      employeeName: name
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};