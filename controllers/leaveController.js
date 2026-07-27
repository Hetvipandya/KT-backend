// const Leave =
//   require("../models/Leave");

// const LeaveBalance =
//   require(
//     "../models/LeaveBalance"
//   );

// const Holiday =
//   require(
//     "../models/Holiday"
//   );

//   const User = require("../models/User");

// // ================= APPLY LEAVE =================
// exports.applyLeave = async (req, res) => {
//   try {
//     const {
//       userId,
//       leaveType,
//       startDate,
//       endDate,
//       reason,
//     } = req.body;

//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     const totalDays =
//       Math.ceil(
//         (new Date(endDate) - new Date(startDate)) /
//           (1000 * 60 * 60 * 24)
//       ) + 1;

//     const leave = await Leave.create({
//       employeeId: userId,
//       applicantRole: user.role, // <-- NEW FIELD
//       leaveType,
//       startDate,
//       endDate,
//       totalDays,
//       reason,

//       // Team Lead leave goes directly to HR
//       status:
//         user.role === "teamlead"
//           ? "pending_hr"
//           : "pending",

//       teamLeadStatus:
//         user.role === "teamlead"
//           ? "skipped"
//           : "pending",
//     });
//       // Auto create leave balance if not exists
//       const existingBalance =
//         await LeaveBalance.findOne(
//           {
//             employeeId:
//               userId,
//           }
//         );

//       if (
//         !existingBalance
//       ) {
//         await LeaveBalance.create(
//           {
//             employeeId:
//               userId,
//             totalLeaves: 20,
//             usedLeaves: 0,
//             remainingLeaves: 20,
//           }
//         );
//       }

//       res.status(201).json({
//         success: true,
//         message:
//           "Leave request sent successfully",
//         data: leave,
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message:
//           error.message,
//       });
//     }
//   };

// exports.getAllLeaves = async (req, res) => {
//   console.log("=== getAllLeaves function STARTED ===");
//   console.log("User from token:", req.user ? req.user._id : "No user");
  
//   try {
//     console.log("Attempting to find leaves...");
//     const leaves = await Leave.find({})
//       .populate({
//         path: "employeeId",
//         select: "name email role uniqueID",
//       })
//       .sort({ createdAt: -1 });
    
//     console.log(`Found ${leaves.length} leaves`);
    
//     return res.status(200).json({
//       success: true,
//       total: leaves.length,
//       data: leaves,
//     });
//   } catch (error) {
//     console.log("GET ALL LEAVES ERROR:", error);
//     console.log("Error stack:", error.stack);
    
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

// const updateLeaveBalance = async (leave) => {
//   let balance = await LeaveBalance.findOne({
//     employeeId: leave.employeeId,
//   });

//   if (!balance) {
//     balance = await LeaveBalance.create({
//       employeeId: leave.employeeId,
//       totalLeaves: 20,
//       usedLeaves: 0,
//       remainingLeaves: 20,
//     });
//   }

//   balance.usedLeaves += leave.totalDays;
//   balance.remainingLeaves -= leave.totalDays;

//   await balance.save();
// };

// // ================= TEAM LEAD APPROVAL =================
// exports.teamLeadApproval = async (req, res) => {
//   try {
//     const { leaveId, status, remark } = req.body;

//     if (!leaveId) {
//       return res.status(400).json({
//         success: false,
//         message: "Leave ID is required",
//       });
//     }

//     if (!["approved", "rejected"].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Status must be approved or rejected",
//       });
//     }

//     const leave = await Leave.findById(leaveId);

//     if (!leave) {
//       return res.status(404).json({
//         success: false,
//         message: "Leave not found",
//       });
//     }

//     if (["approved", "rejected"].includes(leave.status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Leave already processed",
//       });
//     }

//     leave.teamLeadStatus = status;
//     leave.remark = remark || leave.remark;

//     if (status === "approved") {
//       leave.status = "pending_hr";
//     } else {
//       leave.status = "rejected";
//     }

//     await leave.save();

//     res.status(200).json({
//       success: true,
//       message:
//         status === "approved"
//           ? "Leave approved by team lead and forwarded to HR"
//           : "Leave rejected by team lead",
//       data: leave,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   } 
// };

// // ================= HR APPROVAL =================
// exports.hrApproval = async (req, res) => {
//   try {
//     const { leaveId, status, remark } = req.body;

//     if (!leaveId) {
//       return res.status(400).json({
//         success: false,
//         message: "Leave ID is required",
//       });
//     }

//     if (!["approved", "rejected"].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Status must be approved or rejected",
//       });
//     }

//     const leave = await Leave.findById(leaveId);

//     if (!leave) {
//       return res.status(404).json({
//         success: false,
//         message: "Leave not found",
//       });
//     }

//     if (leave.teamLeadStatus !== "approved") {
//       return res.status(400).json({
//         success: false,
//         message: "Leave must be approved by team lead first",
//       });
//     }

//     if (["approved", "rejected"].includes(leave.status) && leave.hrStatus !== "pending") {
//       return res.status(400).json({
//         success: false,
//         message: "Leave already processed by HR",
//       });
//     }

//     leave.hrStatus = status;
//     leave.remark = remark || leave.remark;

// if (status === "approved") {
//   leave.hrStatus = "approved";
//   leave.status = "approved";

//   // Employee/Intern અને Team Lead બંને માટે balance update
//   await updateLeaveBalance(leave);
// } else {
//   leave.hrStatus = "rejected";
//   leave.status = "rejected";
// }

// leave.remark = remark || leave.remark;

// await leave.save();

// return res.status(200).json({
//   success: true,
//   message:
//     status === "approved"
//       ? "Leave approved successfully"
//       : "Leave rejected successfully",
//   data: leave,
// });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


// // ================= GET USER LEAVES =================
// exports.getMyLeaves =
//   async (req, res) => {
//     try {
//       const {
//         userId,
//       } = req.params;

//       const leaves =
//         await Leave.find({
//           employeeId:
//             userId,
//         })
//           .populate(
//             "employeeId",
//             "name email role"
//           )
//           .sort({
//             createdAt: -1,
//           });

//       res.status(200).json({
//         success: true,
//         total:
//           leaves.length,
//         data: leaves,
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message:
//           error.message,
//       });
//     }
//   };

// // ================= GET LEAVE BALANCE =================
// exports.getLeaveBalance =
//   async (req, res) => {
//     try {
//       const {
//         userId,
//       } = req.params;

//       let balance =
//         await LeaveBalance.findOne(
//           {
//             employeeId:
//               userId,
//           }
//         );

//       // Auto create if not exists
//       if (!balance) {
//         balance =
//           await LeaveBalance.create(
//             {
//               employeeId:
//                 userId,
//               totalLeaves: 20,
//               usedLeaves: 0,
//               remainingLeaves: 20,
//             }
//           );
//       }

//       res.status(200).json({
//         success: true,
//         data: balance,
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message:
//           error.message,
//       });
//     }
//   };

// // ================= CREATE HOLIDAY =================
// exports.createHoliday =
//   async (req, res) => {
//     try {
//       const {
//         holidayName,
//         holidayDate,
//         isPublicHoliday,
//       } = req.body;

//       const holiday =
//         await Holiday.create({
//           holidayName,
//           holidayDate,
//           isPublicHoliday,
//         });

//       res.status(201).json({
//         success: true,
//         message:
//           "Holiday created successfully",
//         data: holiday,
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message:
//           error.message,
//       });
//     }
//   };

// // ================= GET ALL HOLIDAYS =================
// exports.getAllHolidays =
//   async (req, res) => {
//     try {
//       const holidays =
//         await Holiday.find().sort(
//           {
//             holidayDate: 1,
//           }
//         );

//       res.status(200).json({
//         success: true,
//         total:
//           holidays.length,
//         data: holidays,
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message:
//           error.message,
//       });
//     }
//   };

const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const Holiday = require("../models/Holiday");
const User = require("../models/User");

// ================= APPLY LEAVE =================
exports.applyLeave = async (req, res) => {
  try {
    const { userId, leaveType, startDate, endDate, reason } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const totalDays =
      Math.ceil(
        (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
      ) + 1;

    // Check if leave balance is sufficient (optional)
    const balance = await LeaveBalance.findOne({ employeeId: userId });
    if (balance && balance.remainingLeaves < totalDays) {
      return res.status(400).json({
        success: false,
        message: "Insufficient leave balance",
      });
    }

    const leave = await Leave.create({
      employeeId: userId,
      applicantRole: user.role,
      leaveType,
      startDate,
      endDate,
      totalDays,
      reason,
      // Team Lead leave goes directly to HR
      status: user.role === "teamlead" ? "pending_hr" : "pending",
      teamLeadStatus: user.role === "teamlead" ? "skipped" : "pending",
      hrStatus: "pending",
    });

    // Auto create leave balance if not exists
    const existingBalance = await LeaveBalance.findOne({ employeeId: userId });

    if (!existingBalance) {
      await LeaveBalance.create({
        employeeId: userId,
        totalLeaves: 20,
        usedLeaves: 0,
        remainingLeaves: 20,
      });
    }

    res.status(201).json({
      success: true,
      message: "Leave request sent successfully",
      data: leave,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET ALL LEAVES (Role-Based) =================
exports.getAllLeaves = async (req, res) => {
  console.log("=== getAllLeaves function STARTED ===");
  console.log("User from token:", req.user ? req.user._id : "No user");
  console.log("User role:", req.user ? req.user.role : "No role");

  try {
    const { role, _id } = req.user; // Assuming req.user is set by auth middleware

    let filter = {};
    
    // ROLE-BASED FILTERING
    if (role === "teamlead") {
      // Team Lead can only see Employee and Intern leaves (not other Team Leads)
      filter = {
        $and: [
          { applicantRole: { $in: ["employee", "intern"] } },
          { teamLeadStatus: "pending" },
        ],
      };
    } else if (role === "hr") {
      // HR can see all leaves that are pending_hr or approved/rejected
      filter = {
        $or: [
          { status: "pending_hr" },
          { status: "approved" },
          { status: "rejected" },
        ],
      };
    } else if (role === "employee" || role === "intern") {
      // Employees/Interns can only see their own leaves
      filter = { employeeId: _id };
    }

    console.log("Applied filter:", filter);

    const leaves = await Leave.find(filter)
      .populate({
        path: "employeeId",
        select: "name email role uniqueID",
      })
      .sort({ createdAt: -1 });

    console.log(`Found ${leaves.length} leaves for role: ${role}`);

    return res.status(200).json({
      success: true,
      total: leaves.length,
      data: leaves,
    });
  } catch (error) {
    console.log("GET ALL LEAVES ERROR:", error);
    console.log("Error stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// ================= GET TEAM LEAD PENDING LEAVES =================
exports.getTeamLeadPendingLeaves = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user || user.role !== "teamlead") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Team Leads can view pending leaves.",
      });
    }

    // Get all employees and interns under this team lead (if you have team mapping)
    // For now, fetch all pending employee/intern leaves
    const leaves = await Leave.find({
      applicantRole: { $in: ["employee", "intern"] },
      teamLeadStatus: "pending",
      status: "pending",
    })
      .populate({
        path: "employeeId",
        select: "name email role uniqueID",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: leaves.length,
      data: leaves,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET HR PENDING LEAVES =================
exports.getHRPendingLeaves = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user || user.role !== "hr") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only HR can view pending leaves.",
      });
    }

    const leaves = await Leave.find({
      status: "pending_hr",
      hrStatus: "pending",
    })
      .populate({
        path: "employeeId",
        select: "name email role uniqueID",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: leaves.length,
      data: leaves,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= UPDATE LEAVE BALANCE =================
const updateLeaveBalance = async (leave) => {
  let balance = await LeaveBalance.findOne({
    employeeId: leave.employeeId,
  });

  if (!balance) {
    balance = await LeaveBalance.create({
      employeeId: leave.employeeId,
      totalLeaves: 20,
      usedLeaves: 0,
      remainingLeaves: 20,
    });
  }

  balance.usedLeaves += leave.totalDays;
  balance.remainingLeaves -= leave.totalDays;

  await balance.save();
};

// ================= TEAM LEAD APPROVAL =================
exports.teamLeadApproval = async (req, res) => {
  try {
    const { leaveId, status, remark } = req.body;

    if (!leaveId) {
      return res.status(400).json({
        success: false,
        message: "Leave ID is required",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    const leave = await Leave.findById(leaveId).populate("employeeId");

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave not found",
      });
    }

    // Check if this is an employee/intern leave
    if (!["employee", "intern"].includes(leave.applicantRole)) {
      return res.status(400).json({
        success: false,
        message: "Team Lead can only approve employee/intern leaves",
      });
    }

    if (leave.teamLeadStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Leave already processed by Team Lead",
      });
    }

    leave.teamLeadStatus = status;
    leave.remark = remark || leave.remark;

    if (status === "approved") {
      leave.status = "pending_hr";
      leave.hrStatus = "pending";
    } else {
      leave.status = "rejected";
      leave.hrStatus = "rejected";
    }

    await leave.save();

    res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Leave approved by team lead and forwarded to HR"
          : "Leave rejected by team lead",
      data: leave,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= HR APPROVAL =================
exports.hrApproval = async (req, res) => {
  try {
    const { leaveId, status, remark } = req.body;

    if (!leaveId) {
      return res.status(400).json({
        success: false,
        message: "Leave ID is required",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    const leave = await Leave.findById(leaveId).populate("employeeId");

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave not found",
      });
    }

    // For team lead leaves, skip team lead approval check
    if (leave.applicantRole === "teamlead") {
      if (leave.status !== "pending_hr") {
        return res.status(400).json({
          success: false,
          message: "Leave not in pending HR state",
        });
      }
    } else {
      // For employee/intern, check if team lead approved
      if (leave.teamLeadStatus !== "approved") {
        return res.status(400).json({
          success: false,
          message: "Leave must be approved by team lead first",
        });
      }
    }

    if (leave.hrStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Leave already processed by HR",
      });
    }

    if (status === "approved") {
      leave.hrStatus = "approved";
      leave.status = "approved";
      
      // Update leave balance for all approved leaves
      await updateLeaveBalance(leave);
    } else {
      leave.hrStatus = "rejected";
      leave.status = "rejected";
    }

    leave.remark = remark || leave.remark;
    await leave.save();

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Leave approved successfully"
          : "Leave rejected successfully",
      data: leave,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET USER LEAVES =================
exports.getMyLeaves = async (req, res) => {
  try {
    const { userId } = req.params;

    const leaves = await Leave.find({ employeeId: userId })
      .populate("employeeId", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      total: leaves.length,
      data: leaves,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET LEAVE BALANCE =================
exports.getLeaveBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    let balance = await LeaveBalance.findOne({ employeeId: userId });

    if (!balance) {
      balance = await LeaveBalance.create({
        employeeId: userId,
        totalLeaves: 20,
        usedLeaves: 0,
        remainingLeaves: 20,
      });
    }

    res.status(200).json({
      success: true,
      data: balance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= CREATE HOLIDAY =================
exports.createHoliday = async (req, res) => {
  try {
    const { holidayName, holidayDate, isPublicHoliday } = req.body;

    const holiday = await Holiday.create({
      holidayName,
      holidayDate,
      isPublicHoliday,
    });

    res.status(201).json({
      success: true,
      message: "Holiday created successfully",
      data: holiday,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET ALL HOLIDAYS =================
exports.getAllHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ holidayDate: 1 });

    res.status(200).json({
      success: true,
      total: holidays.length,
      data: holidays,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};