// const Attendance = require("../models/Attendance");
// const User = require("../models/User");

// const pad = (value) => String(value).padStart(2, "0");  
  
// // ============================================================
// // GET ALL ATTENDANCE MEMBERS FOR A SPECIFIC DATE
// // ============================================================
// const getDateWiseAttendance = async (date) => {
//   const Employee = require("../models/Employee");
 
//   // ----------------------------------------------------------
//   // 1. Employees + Interns + Team Leads from User collection
//   // ----------------------------------------------------------
//   const users = await User.find({
//     role: {
//       $in: ["employee", "intern", "teamlead"],
//     },
//   }).select(
//     "_id name uniqueID role email department phoneNumber"
//   );

//   // ----------------------------------------------------------
//   // 2. Team Leads which are marked from Employee collection
//   // ----------------------------------------------------------
//   const teamLeadEmployees = await Employee.find({
//     isTeamLead: true,
//   }).select("userId");

//   const teamLeadIds = new Set(
//     teamLeadEmployees
//       .filter((item) => item.userId)
//       .map((item) => item.userId.toString())
//   );

//   // ----------------------------------------------------------
//   // 3. Create members map
//   // ----------------------------------------------------------
//   const membersMap = new Map();

//   users.forEach((user) => {
//     let role = user.role?.toLowerCase();

//     if (teamLeadIds.has(user._id.toString())) {
//       role = "teamlead";
//     }

//     membersMap.set(user._id.toString(), {
//       user,
//       role,
//     });
//   });

//   // ----------------------------------------------------------
//   // 4. Fetch attendance for selected date
//   // ----------------------------------------------------------
//   const attendanceRecords = await Attendance.find({
//     date,
//   })
//     .populate({
//       path: "userId",
//       select:
//         "name uniqueID role email department phoneNumber",
//     })
//     .populate({
//       path: "approvedBy",
//       select: "name uniqueID role",
//     })
//     .sort({
//       updatedAt: -1,
//       createdAt: -1,
//     });

//   // ----------------------------------------------------------
//   // 5. Attendance map - Get latest for each user
//   // ----------------------------------------------------------
//   const attendanceMap = new Map();

//   attendanceRecords.forEach((attendance) => {
//     if (attendance.userId?._id) {
//       const userId = attendance.userId._id.toString();

//       // Keep latest record (sorted by createdAt: -1)
//       if (!attendanceMap.has(userId)) {
//         attendanceMap.set(userId, attendance);
//       }
//     }
//   });

//   // ----------------------------------------------------------
//   // 6. Create final date-wise list
//   // ----------------------------------------------------------
//   const result = [];

//   for (const member of membersMap.values()) {
//     const user = member.user;
//     const userId = user._id.toString();

//     const attendance = attendanceMap.get(userId);

//     // --------------------------------------------------------
//     // No attendance = ABSENT / NOT CHECKED IN
//     // --------------------------------------------------------
//     if (!attendance) {
//       result.push({
//         _id: null,

//         employee: {
//           _id: user._id,
//           name: user.name || "",
//           uniqueID: user.uniqueID || "",
//           email: user.email || "",
//           department: user.department || "",
//           phoneNumber: user.phoneNumber || "",
//           role: member.role || user.role || "",
//         },

//         date,

//         dateDisplay: date,

//         checkInTime: null,
//         checkInTimeDisplay: null,
//         checkInTimeFullDisplay: null,

//         approvedCheckInTime: null,
//         approvedCheckInTimeDisplay: null,
//         approvedCheckInTimeFullDisplay: null,

//         checkOutTime: null,
//         checkOutTimeDisplay: null,
//         checkOutTimeFullDisplay: null,

//         breaks: [],

//         totalBreakTime: 0,
//         totalBreakTimeDisplay: "0h 0m",

//         totalWorkTime: 0,
//         totalWorkTimeDisplay: "0h 0m",
//         totalWorkTimeHours: "0.00 hours",

//         isLate: false,

//         status: "absent",

//         approvalStatus: "not_checked_in",

//         approvedAt: null,
//         approvedAtDisplay: null,
//         approvedAtFullDisplay: null,

//         approvedBy: null,

//         createdAt: null,
//         createdAtDisplay: null,

//         updatedAt: null,
//         updatedAtDisplay: null,
//       });

//       continue;
//     }

//     // --------------------------------------------------------
//     // Attendance exists
//     // --------------------------------------------------------
//     const data = formatAttendanceDocument(attendance);

//     result.push({
//       _id: data._id,

//       employee: {
//         _id: data.userId?._id || user._id,
//         name:
//           data.userId?.name ||
//           user.name ||
//           "",
//         uniqueID:
//           data.userId?.uniqueID ||
//           user.uniqueID ||
//           "",
//         email:
//           data.userId?.email ||
//           user.email ||
//           "",
//         department:
//           data.userId?.department ||
//           user.department ||
//           "",
//         phoneNumber:
//           data.userId?.phoneNumber ||
//           user.phoneNumber ||
//           "",
//         role:
//           member.role ||
//           data.userId?.role ||
//           user.role ||
//           "",
//       },

//       date: data.date || date,
//       dateDisplay: data.dateDisplay || date,

//       checkInTime: data.checkInTime || null,
//       checkInTimeDisplay:
//         data.checkInTimeDisplay || null,
//       checkInTimeFullDisplay:
//         data.checkInTimeFullDisplay || null,

//       approvedCheckInTime:
//         data.approvedCheckInTime || null,
//       approvedCheckInTimeDisplay:
//         data.approvedCheckInTimeDisplay || null,
//       approvedCheckInTimeFullDisplay:
//         data.approvedCheckInTimeFullDisplay || null,

//       checkOutTime: data.checkOutTime || null,
//       checkOutTimeDisplay:
//         data.checkOutTimeDisplay || null,
//       checkOutTimeFullDisplay:
//         data.checkOutTimeFullDisplay || null,

//       breaks: data.breaks || [],

//       totalBreakTime:
//         data.totalBreakTime || 0,
//       totalBreakTimeDisplay:
//         data.totalBreakTimeDisplay || "0h 0m",

//       totalWorkTime:
//         data.totalWorkTime || 0,
//       totalWorkTimeDisplay:
//         data.totalWorkTimeDisplay || "0h 0m",
//       totalWorkTimeHours:
//         data.totalWorkTimeHours || "0.00 hours",

//       isLate: data.isLate || false,

//       status: data.status || "absent",

//       approvalStatus:
//         data.approvalStatus || "pending",

//       approvedAt: data.approvedAt || null,
//       approvedAtDisplay:
//         data.approvedAtDisplay || null,
//       approvedAtFullDisplay:
//         data.approvedAtFullDisplay || null,

//       approvedBy: data.approvedBy
//         ? {
//             _id: data.approvedBy._id,
//             name: data.approvedBy.name,
//             uniqueID: data.approvedBy.uniqueID,
//             role: data.approvedBy.role,
//           }
//         : null,

//       createdAt: data.createdAt || null,
//       createdAtDisplay:
//         data.createdAtDisplay || null,

//       updatedAt: data.updatedAt || null,
//       updatedAtDisplay:
//         data.updatedAtDisplay || null,
//     });
//   }

//   return result;
// };

// const ensureTodayAttendance = async (date = getToday()) => {
//   try {
//     // ============================================
//     // 1. Get Employees + Interns from User
//     // ============================================
//     const users = await User.find({
//       role: {
//         $in: ["employee", "intern"],
//       },
//     }).select("_id role");

//     // ============================================
//     // 2. Get Team Leads from Employee collection
//     // ============================================
//     const Employee = require("../models/Employee");

//     const teamLeadEmployees = await Employee.find({
//       isTeamLead: true,
//     }).select("userId");

//     // ============================================
//     // 3. Create unique member map
//     // ============================================
//     const membersMap = new Map();

//     users.forEach((user) => {
//       membersMap.set(user._id.toString(), {
//         _id: user._id,
//         role: user.role,
//       });
//     });

//     teamLeadEmployees.forEach((employee) => {
//       if (employee.userId) {
//         membersMap.set(employee.userId.toString(), {
//           _id: employee.userId,
//           role: "teamlead",
//         });
//       }
//     });

//     const members = Array.from(membersMap.values());

//     // ============================================
//     // 4. Check existing attendance
//     // ============================================
//     const existingAttendance = await Attendance.find({
//       date,
//     }).select("userId");

//     const existingUserIds = new Set(
//       existingAttendance.map((attendance) =>
//         attendance.userId.toString()
//       )
//     );

//     // ============================================
//     // 5. Create ABSENT records
//     //    for users who have no attendance
//     // ============================================
//     const absentRecords = [];

//     for (const member of members) {
//       const userId = member._id.toString();

//       if (!existingUserIds.has(userId)) {
//         absentRecords.push({
//           userId: member._id,
//           userType: member.role.toLowerCase(),
//           date,

//           checkInTime: null,
//           approvedCheckInTime: null,
//           checkOutTime: null,

//           breaks: [],
//           totalBreakTime: 0,
//           totalWorkTime: 0,

//           isLate: false,

//           status: "absent",
//           approvalStatus: "approved",
//         });
//       }
//     }

//     // ============================================
//     // 6. Insert absent records
//     // ============================================
//     if (absentRecords.length > 0) {
//       await Attendance.insertMany(absentRecords);
//     }

//     return {
//       success: true,
//       date,
//       created: absentRecords.length,
//     };
//   } catch (error) {
//     console.error(
//       "ensureTodayAttendance Error:",
//       error
//     );

//     throw error;
//   }
// };

// // Get IST date parts from any date
// const getISTDateParts = (date = new Date()) => {
//   const utc = date.getTime() + date.getTimezoneOffset() * 60000;
//   const istOffset = 5.5 * 60 * 60000;
//   const istDate = new Date(utc + istOffset);

//   return { 
//     year: istDate.getFullYear(),  
//     month: pad(istDate.getMonth() + 1), 
//     day: pad(istDate.getDate()),
//     hour: pad(istDate.getHours()),
//     minute: pad(istDate.getMinutes()),
//     second: pad(istDate.getSeconds()),
//   };
// };

// // Get today's date in IST format (YYYY-MM-DD)
// const getToday = (date = new Date()) => {
//   const parts = getISTDateParts(date);
//   return `${parts.year}-${parts.month}-${parts.day}`;
// };

// // Format time in IST (HH:MM)
// const formatISTTime = (value) => {
//   if (!value) return null;

//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return null;

//   const parts = new Intl.DateTimeFormat("en-GB", {
//     timeZone: "Asia/Kolkata",
//     hour: "2-digit",
//     minute: "2-digit",
//     hour12: false,
//   }).formatToParts(date);

//   const hour = parts.find((part) => part.type === "hour")?.value;
//   const minute = parts.find((part) => part.type === "minute")?.value;

//   return `${hour}:${minute}`;
// };

// // Format full date time in IST
// const formatISTDateTime = (value) => {
//   if (!value) return null;

//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return null;

//   const parts = new Intl.DateTimeFormat("en-GB", {
//     timeZone: "Asia/Kolkata",
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//     hour: "2-digit",
//     minute: "2-digit",
//     second: "2-digit",
//     hour12: false,
//   }).formatToParts(date);

//   const year = parts.find((p) => p.type === "year")?.value;
//   const month = parts.find((p) => p.type === "month")?.value;
//   const day = parts.find((p) => p.type === "day")?.value;
//   const hour = parts.find((p) => p.type === "hour")?.value;
//   const minute = parts.find((p) => p.type === "minute")?.value;
//   const second = parts.find((p) => p.type === "second")?.value;

//   return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
// };

// // Format attendance document for response
// const formatAttendanceDocument = (attendance) => {
//   if (!attendance) return attendance;

//   const plainAttendance =
//     attendance.toObject?.() ?? JSON.parse(JSON.stringify(attendance));

//   // Add display fields for all date fields
//   const formatDateField = (fieldName) => {
//     if (plainAttendance[fieldName]) {
//       plainAttendance[`${fieldName}Display`] = formatISTTime(
//         plainAttendance[fieldName]
//       );
//       plainAttendance[`${fieldName}FullDisplay`] = formatISTDateTime(
//         plainAttendance[fieldName]
//       );
//     }
//   };

//   formatDateField("checkInTime");
//   formatDateField("checkOutTime");
//   formatDateField("approvedAt");
//   formatDateField("approvedCheckInTime");
//   formatDateField("createdAt");
//   formatDateField("updatedAt");

//   if (plainAttendance.date) {
//     plainAttendance.dateDisplay = plainAttendance.date;
//   }

//   // Format breaks
//   if (plainAttendance.breaks?.length) {
//     plainAttendance.breaks = plainAttendance.breaks.map((breakItem) => ({
//       ...breakItem,
//       startTimeDisplay: formatISTTime(breakItem.startTime),
//       endTimeDisplay: formatISTTime(breakItem.endTime),
//       startTimeFullDisplay: formatISTDateTime(breakItem.startTime),
//       endTimeFullDisplay: formatISTDateTime(breakItem.endTime),
//     }));
//   }

//   // Format total work time
//   if (plainAttendance.totalWorkTime != null) {
//     const hours = Math.floor(plainAttendance.totalWorkTime);
//     const minutes = Math.round((plainAttendance.totalWorkTime - hours) * 60);
//     plainAttendance.totalWorkTimeDisplay = `${hours}h ${minutes}m`;
//     plainAttendance.totalWorkTimeHours = `${Number(
//       plainAttendance.totalWorkTime
//     ).toFixed(2)} hours`;
//   }

//   // Format total break time
//   if (plainAttendance.totalBreakTime != null) {
//     const hours = Math.floor(plainAttendance.totalBreakTime / 60);
//     const minutes = Math.round(plainAttendance.totalBreakTime % 60);
//     plainAttendance.totalBreakTimeDisplay = `${hours}h ${minutes}m`;
//   }

//   return plainAttendance;
// };

// // Convert IST parts to a UTC Date object representing the same instant
// const getISTDateFromParts = ({ year, month, day, hour, minute, second }) => {
//   const utcHour = Number(hour) - 5;
//   const utcMinute = Number(minute) - 30;
//   return new Date(Date.UTC(
//     Number(year),
//     Number(month) - 1,
//     Number(day),
//     utcHour,
//     utcMinute,
//     Number(second)
//   ));
// };

// // Get current time in IST as a Date object representing the current instant
// const getISTNow = () => {
//   const now = new Date();
//   const parts = getISTDateParts(now);
//   return getISTDateFromParts(parts);
// };

// // Get office time at 10:10 AM IST
// const getOfficeTimeIST = () => {
//   const now = new Date();
//   const parts = getISTDateParts(now);
//   return getISTDateFromParts({
//     ...parts,
//     hour: "10",
//     minute: "10",
//     second: "00",
//   });
// };

// // Check if current time is late (after 10:10 AM IST)
// const isLateCheck = () => {
//   const now = getISTNow();
//   const officeTime = getOfficeTimeIST();
//   return now.getTime() > officeTime.getTime();
// };

// // Get working hours between two dates
// const getWorkingHours = (checkIn, checkOut, breakTime = 0) => {
//   if (!checkIn || !checkOut) return 0;
  
//   const checkInDate = new Date(checkIn);
//   const checkOutDate = new Date(checkOut);
  
//   let totalMinutes = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60);
  
//   // Deduct break time (max 60 minutes)
//   const breakMinutes = Math.min(breakTime || 0, 60);
//   totalMinutes -= breakMinutes;
  
//   return Math.max(0, totalMinutes / 60);
// };

// const OFFICE_START_TIME = "10:10";

// // ================= CHECK IN =================
// // ================= CHECK IN =================
// exports.checkIn = async (req, res) => {
//   try {
//     const { userId } = req.body;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId is required",
//       });
//     }

//     // ============================================
//     // 1. Find User
//     // ============================================
//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     const userType = user.role.trim().toLowerCase();
//     const date = getToday();

//     // ============================================
//     // 2. Make sure today's attendance exists
//     // ============================================
//     await ensureTodayAttendance(date);

//     // ============================================
//     // 3. Find today's attendance
//     // ============================================
//     let attendance = await Attendance.findOne({
//       userId,
//       date,
//     });

//     // ============================================
//     // 4. If attendance doesn't exist, create it
//     // ============================================
//     if (!attendance) {
//       attendance = await Attendance.create({
//         userId,
//         userType,
//         date,

//         checkInTime: null,
//         approvedCheckInTime: null,
//         checkOutTime: null,

//         breaks: [],
//         totalBreakTime: 0,
//         totalWorkTime: 0,

//         isLate: false,

//         status: "absent",
//         approvalStatus: "approved",
//       });
//     }

//     // ============================================
//     // 5. Already pending
//     // ============================================
//     if (attendance.approvalStatus === "pending") {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Your check-in request is already pending admin approval.",
//         data: formatAttendanceDocument(attendance),
//       });
//     }

//     // ============================================
//     // 6. Already checked in
//     // ============================================
//     if (
//       attendance.approvalStatus === "approved" &&
//       attendance.checkInTime
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "You have already checked in today.",
//         data: formatAttendanceDocument(attendance),
//       });
//     }

//     // ============================================
//     // 7. CAPTURE ACTUAL CHECK-IN TIME
//     // ============================================
//     // IMPORTANT:
//     // This time is captured when employee clicks
//     // the Check-In button.
//     const actualCheckInTime = getISTNow();

//     // ============================================
//     // 8. Calculate Late / Absent based on
//     //    EMPLOYEE CHECK-IN TIME
//     // ============================================
//     const checkInParts = getISTDateParts(actualCheckInTime);

//     const officeStartTime = getISTDateFromParts({
//       ...checkInParts,
//       hour: "10",
//       minute: "10",
//       second: "00",
//     });

//     const absentCutoffTime = getISTDateFromParts({
//       ...checkInParts,
//       hour: "10",
//       minute: "30",
//       second: "00",
//     });

//     const checkInTimestamp = actualCheckInTime.getTime();

//     const isLate =
//       checkInTimestamp > officeStartTime.getTime() &&
//       checkInTimestamp <= absentCutoffTime.getTime();

//     const isAbsentDueToLate =
//       checkInTimestamp > absentCutoffTime.getTime();

//     // ============================================
//     // 9. Save ACTUAL check-in time immediately
//     // ============================================
//     attendance.userType = userType;

//     // Employee's actual check-in time
//     attendance.checkInTime = actualCheckInTime;

//     // Keep this null until admin approves
//     attendance.approvedCheckInTime = null;

//     attendance.checkOutTime = null;

//     attendance.breaks = [];
//     attendance.totalBreakTime = 0;
//     attendance.totalWorkTime = 0;

//     attendance.isLate = isLate;

//     // ============================================
//     // 10. Status
//     // ============================================
//     if (isAbsentDueToLate) {
//       attendance.status = "half-day";
//     } else {
//       attendance.status = "present";
//     }

//     // ============================================
//     // 11. Send request for approval
//     // ============================================
//     attendance.approvalStatus = "pending";

//     await attendance.save();

//     // ============================================
//     // 12. Response
//     // ============================================
//     let message;

//     if (isAbsentDueToLate) {
//       message =
//         `Check-in request sent successfully. ` +
//         `You checked in at ${formatISTTime(actualCheckInTime)}, ` +
//         `which is after 10:30 AM, so you will be marked half-day after approval.`;
//     } else if (isLate) {
//       message =
//         `Check-in request sent successfully. ` +
//         `You checked in at ${formatISTTime(actualCheckInTime)}. ` +
//         `You are marked as late.`;
//     } else {
//       message =
//         `Check-in request sent successfully at ${formatISTTime(
//           actualCheckInTime
//         )}. Waiting for admin approval.`;
//     }

//     return res.status(201).json({
//       success: true,
//       message,

//       data: formatAttendanceDocument(attendance),
//     });

//   } catch (err) {
//     console.error("CheckIn Error:", err);

//     return res.status(500).json({
//       success: false,
//       message: err.message,
//       error: err,
//     });
//   }
// };

// // ================= GET DATE-WISE ATTENDANCE FOR ADMIN =================
// exports.getAllAttendanceForAdmin = async (req, res) => {
//   try {
//     const requestedDate = req.query.date;

//     // Default = today
//     const date = requestedDate || getToday();

//     // Validate YYYY-MM-DD
//     if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
//       return res.status(400).json({
//         success: false,
//         message: "date must be in YYYY-MM-DD format",
//       });
//     }

//     // ============================================================
//     // IMPORTANT:
//     // Fetch actual Attendance records directly by date.
//     // Do NOT depend on getDateWiseAttendance() here.
//     // ============================================================

//     const attendanceRecords = await getDateWiseAttendance(date);

//     // ============================================================
//     // FORMAT RESPONSE
//     // ============================================================

//     const attendance = attendanceRecords.map((record) => {
//       const formatted = record;
//       const user = record.employee;

//       return {
//         ...formatted,

//         // Keep populated user information available
//         user: user
//           ? {
//               _id: user._id,
//               name: user.name,
//               uniqueID: user.uniqueID,
//               role: user.role,
//               department: user.department,
//               email: user.email,
//             }
//           : null,

//         // This is useful for your existing frontend
//         employee: user
//           ? {
//               _id: user._id,
//               name: user.name,
//               uniqueID: user.uniqueID,
//               role: user.role,
//               department: user.department,
//               email: user.email,
//             }
//           : null,

//         // Make employee name directly available
//         employeeName: user?.name || "Unknown Employee",

//         // Make email directly available
//         email: user?.email || "",
//       };
//     });

//     // ============================================================
//     // STATISTICS
//     // ============================================================

//     const present = attendance.filter(
//       (item) =>
//         String(item.status || "").toLowerCase() === "present"
//     ).length;

//     const late = attendance.filter(
//       (item) =>
//         item.isLate === true &&
//         String(item.status || "").toLowerCase() !== "absent"
//     ).length;

//     const halfDay = attendance.filter(
//       (item) => {
//         const status = String(
//           item.status || ""
//         )
//           .toLowerCase()
//           .trim();

//         return (
//           status === "half-day" ||
//           status === "halfday" ||
//           status === "half day"
//         );
//       }
//     ).length;

//     const absent = attendance.filter(
//       (item) =>
//         String(item.status || "").toLowerCase() === "absent"
//     ).length;

//     const notCheckedIn = attendance.filter(
//       (item) =>
//         String(item.approvalStatus || "")
//           .toLowerCase()
//           .trim() === "not_checked_in"
//     ).length;

//     const pending = attendance.filter(
//       (item) =>
//         String(item.approvalStatus || "")
//           .toLowerCase()
//           .trim() === "pending"
//     ).length;

//     const approved = attendance.filter(
//       (item) =>
//         String(item.approvalStatus || "")
//           .toLowerCase()
//           .trim() === "approved"
//     ).length;

//     // ============================================================
//     // ROLE-WISE
//     // ============================================================

//     const roleWise = {
//       employee: 0,
//       intern: 0,
//       teamlead: 0,
//       other: 0,
//     };

//     attendance.forEach((item) => {
//       const role = String(
//         item?.user?.role ||
//           item?.employee?.role ||
//           item?.userType ||
//           ""
//       )
//         .toLowerCase()
//         .trim();

//       if (role === "employee") {
//         roleWise.employee++;
//       } else if (role === "intern") {
//         roleWise.intern++;
//       } else if (
//         role === "teamlead" ||
//         role === "team lead" ||
//         role === "team_lead"
//       ) {
//         roleWise.teamlead++;
//       } else {
//         roleWise.other++;
//       }
//     });

//     // ============================================================
//     // RESPONSE
//     // ============================================================

//     return res.status(200).json({
//       success: true,

//       date,

//       count: attendance.length,

//       summary: {
//         total: attendance.length,

//         present,
//         late,
//         halfDay,
//         absent,

//         pending,
//         approved,
//         notCheckedIn,

//         roleWise,
//       },

//       attendance,
//     });
//   } catch (err) {
//     console.error(
//       "GetAllAttendanceForAdmin Error:",
//       err
//     );

//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= BREAK START =================
// exports.startBreak = async (req, res) => {
//   try {
//     const { userId } = req.body;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId is required",
//       });
//     }

//     const attendance = await Attendance.findOne({
//       userId,
//       date: getToday(),
//     });

//     if (!attendance) {
//       return res.status(404).json({
//         success: false,
//         message: "Please check in first",
//       });
//     }

//     if (attendance.approvalStatus !== "approved") {
//       return res.status(400).json({
//         success: false,
//         message: "Your check-in request is not approved yet. Please wait for admin approval.",
//       });
//     }

//     if (attendance.checkOutTime) {
//       return res.status(400).json({
//         success: false,
//         message: "Already checked out",
//       });
//     }

//     if (!attendance.checkInTime) {
//       return res.status(400).json({
//         success: false,
//         message: "Please check in first",
//       });
//     }

//     const activeBreak = attendance.breaks.find((b) => !b.endTime);

//     if (activeBreak) {
//       return res.status(400).json({
//         success: false,
//         message: "Break already started",
//       });
//     }

//     attendance.breaks.push({
//       startTime: getISTNow(),
//     });

//     await attendance.save();

//     res.status(200).json({
//       success: true,
//       message: "Break started successfully",
//       data: formatAttendanceDocument(attendance),
//     });

//   } catch (err) {
//     console.error("StartBreak Error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= BREAK END =================
// // ================= BREAK END =================
// exports.endBreak = async (req, res) => {
//   try {
//     const { userId } = req.body;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId is required",
//       });
//     }

//     const attendance = await Attendance.findOne({
//       userId,
//       date: getToday(),
//     });

//     if (!attendance) {
//       return res.status(404).json({
//         success: false,
//         message: "Attendance not found. Please check in first.",
//       });
//     }

//     if (attendance.approvalStatus !== "approved") {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Your check-in request is not approved yet. Please wait for admin approval.",
//       });
//     }

//     if (!attendance.checkInTime) {
//       return res.status(400).json({
//         success: false,
//         message: "Please check in first.",
//       });
//     }

//     if (attendance.checkOutTime) {
//       return res.status(400).json({
//         success: false,
//         message: "Already checked out.",
//       });
//     }

//     const activeBreak = attendance.breaks.find(
//       (breakItem) => !breakItem.endTime
//     );

//     if (!activeBreak) {
//       return res.status(400).json({
//         success: false,
//         message: "No active break found.",
//       });
//     }

//     const endTime = getISTNow();

//     activeBreak.endTime = endTime;

//     const duration =
//       (endTime.getTime() - new Date(activeBreak.startTime).getTime()) /
//       (1000 * 60);

//     activeBreak.duration = Number(
//       Math.max(0, duration).toFixed(2)
//     );

//     attendance.totalBreakTime = Number(
//       (
//         (attendance.totalBreakTime || 0) +
//         Math.max(0, duration)
//       ).toFixed(2)
//     );

//     await attendance.save();

//     return res.status(200).json({
//       success: true,
//       message: "Break ended successfully",
//       totalBreakTime: attendance.totalBreakTime,
//       data: formatAttendanceDocument(attendance),
//     });
//   } catch (err) {
//     console.error("EndBreak Error:", err);

//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= CHECK OUT =================
// exports.checkOut = async (req, res) => {
//   try {
//     const { userId } = req.body;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId is required",
//       });
//     }

//     const attendance = await Attendance.findOne({
//       userId,
//       date: getToday(),
//     });

//     if (!attendance) {
//       return res.status(404).json({
//         success: false,
//         message: "Attendance not found",
//       });
//     }

//     if (attendance.approvalStatus !== "approved") {
//       return res.status(400).json({
//         success: false,
//         message: "Your check-in request is not approved yet. Please wait for admin approval.",
//       });
//     }

//     if (attendance.checkOutTime) {
//       return res.status(400).json({
//         success: false,
//         message: "Already checked out",
//       });
//     }

//     const checkInTime = attendance.approvedCheckInTime || attendance.checkInTime;

//     if (!checkInTime) {
//       return res.status(400).json({
//         success: false,
//         message: "Check-in time not found.",
//       });
//     }

//     // Set checkout time
//     attendance.checkOutTime = getISTNow();

//     // Calculate working hours
//  const totalHours = getWorkingHours(
//   checkInTime,
//   attendance.checkOutTime,
//   attendance.totalBreakTime
// );

// attendance.totalWorkTime = Number(totalHours.toFixed(2));

//     const checkInParts = getISTDateParts(new Date(checkInTime));
//     const absentCutoffTime = getISTDateFromParts({
//       ...checkInParts,
//       hour: "10",
//       minute: "30",
//       second: "00",
//     });

//     if (new Date(checkInTime).getTime() > absentCutoffTime.getTime()) {
//       attendance.status = "half-day";
//     } else if (attendance.totalWorkTime >= 8) {
//       attendance.status = "present";
//     } else if (attendance.totalWorkTime >= 4) {
//       attendance.status = "half-day";
//     } else {
//       attendance.status = "absent";
//     }

//     await attendance.save();

//     res.status(200).json({
//       success: true,
//       message: "Check-Out Successful",
//       totalWorkTime: attendance.totalWorkTime,
//       totalBreakTime: attendance.totalBreakTime,
//       data: formatAttendanceDocument(attendance),
//     });

//   } catch (err) {
//     console.error("CheckOut Error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= ATTENDANCE REPORT =================
// exports.getAttendanceById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const attendance = await Attendance.findById(id)
//       .populate("userId", "name email phoneNumber uniqueID department role")
//       .populate("approvedBy", "name email role uniqueID");

//     if (!attendance) {
//       return res.status(404).json({
//         success: false,
//         message: "Attendance not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: formatAttendanceDocument(attendance),
//     });

//   } catch (err) {
//     console.error("GetAttendanceById Error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= GET PENDING ATTENDANCE =================
// exports.getPendingAttendance = async (req, res) => { 
//   try {
//     const data = await Attendance.find({
//       approvalStatus: "pending",
//     }).populate("userId", "name uniqueID role");

//     res.json({
//       success: true,
//       count: data.length,
//       data: data.map(formatAttendanceDocument),
//     });
//   } catch (err) {
//     console.error("GetPendingAttendance Error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= APPROVE ATTENDANCE =================
// // ================= APPROVE ATTENDANCE =================
// exports.approveAttendance = async (req, res) => {
//   try {
//     const { attendanceId, approvedBy } = req.body;

//     // ============================================
//     // 1. Validate request
//     // ============================================
//     if (!attendanceId || !approvedBy) {
//       return res.status(400).json({
//         success: false,
//         message: "attendanceId and approvedBy are required",
//       });
//     }

//     // ============================================
//     // 2. Check approver
//     // ============================================
//     const approver = await User.findById(approvedBy);

//     if (!approver) {
//       return res.status(404).json({
//         success: false,
//         message: "Approver not found",
//       });
//     }

//     // ============================================
//     // 3. Only Admin / HR can approve
//     // ============================================
//     if (!["admin", "hr"].includes(approver.role.toLowerCase())) {
//       return res.status(403).json({
//         success: false,
//         message: "Only Admin or HR can approve attendance",
//       });
//     }

//     // ============================================
//     // 4. Find attendance request
//     // ============================================
//     const attendance = await Attendance.findById(attendanceId);

//     if (!attendance) {
//       return res.status(404).json({
//         success: false,
//         message: "Attendance request not found",
//       });
//     }

//     // ============================================
//     // 5. Check current approval status
//     // ============================================
//     if (attendance.approvalStatus === "approved") {
//       return res.status(400).json({
//         success: false,
//         message: "Attendance already approved",
//       });
//     }

//     if (attendance.approvalStatus === "rejected") {
//       return res.status(400).json({
//         success: false,
//         message: "Attendance request has already been rejected",
//       });
//     }

//     // ============================================
//     // 6. ACTUAL EMPLOYEE CHECK-IN TIME
//     // ============================================
//     const checkInTime = attendance.checkInTime;

//     if (!checkInTime) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Actual check-in time not found. Employee must check in again.",
//       });
//     }

//     // ============================================
//     // 7. Approval time
//     // ============================================
//     const approvalTime = getISTNow();

//     // ============================================
//     // 8. Create office time limits using
//     //    EMPLOYEE'S CHECK-IN DATE
//     // ============================================
//     const checkInParts = getISTDateParts(
//       new Date(checkInTime)
//     );

//     // 10:10 AM = Late Coming
//     const officeStartTime = getISTDateFromParts({
//       ...checkInParts,
//       hour: "10",
//       minute: "10",
//       second: "00",
//     });

//     // 10:30 AM = Absent cutoff
//     const absentCutoffTime = getISTDateFromParts({
//       ...checkInParts,
//       hour: "10",
//       minute: "30",
//       second: "00",
//     });

//     // ============================================
//     // 9. Calculate status using ACTUAL CHECK-IN
//     // ============================================
//     const checkInTimestamp =
//       new Date(checkInTime).getTime();

//     const isLate =
//       checkInTimestamp > officeStartTime.getTime() &&
//       checkInTimestamp <= absentCutoffTime.getTime();

//     const isAbsentDueToLate =
//       checkInTimestamp > absentCutoffTime.getTime();

//     // ============================================
//     // 10. Approve attendance
//     // ============================================
//     attendance.approvalStatus = "approved";

//     attendance.approvedBy = approver._id;

//     // This is approval time, NOT check-in time
//     attendance.approvedAt = approvalTime;

//     // ============================================
//     // IMPORTANT:
//     // Keep employee's actual check-in time
//     // ============================================
//     attendance.checkInTime = checkInTime;

//     // Approved check-in time = actual check-in time
//     attendance.approvedCheckInTime = checkInTime;

//     attendance.isLate = isLate;

//     // ============================================
//     // 11. Final attendance status
//     // ============================================
//     if (isAbsentDueToLate) {
//       attendance.status = "half-day";
//     } else {
//       attendance.status = "present";
//     }

//     await attendance.save();

//     // ============================================
//     // 12. Response message
//     // ============================================
//     let message;

//     if (isAbsentDueToLate) {
//       message =
//         `Attendance approved, but employee is marked HALF-DAY ` +
//         `because check-in was after 10:30 AM. ` +
//         `(Checked in at ${formatISTTime(checkInTime)})`;
//     } else if (isLate) {
//       message =
//         `Attendance approved by ${approver.role}. ` +
//         `Employee checked in as Late. ` +
//         `(Checked in at ${formatISTTime(checkInTime)})`;
//     } else {
//       message =
//         `Attendance approved by ${approver.role}. ` +
//         `Employee checked in successfully. ` +
//         `(Checked in at ${formatISTTime(checkInTime)})`;
//     }

//     // ============================================
//     // 13. Response
//     // ============================================
//     return res.status(200).json({
//       success: true,
//       message,

//       data: formatAttendanceDocument(attendance),
//     });

//   } catch (err) {
//     console.error("ApproveAttendance Error:", err);

//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     }); 
//   }
// };

// // ================= REJECT ATTENDANCE =================
// exports.rejectAttendance = async (req, res) => {
//   try {
//     const { attendanceId, reason } = req.body;

//     if (!attendanceId) {
//       return res.status(400).json({
//         success: false,
//         message: "attendanceId is required",
//       });
//     }

//     if (!reason || !reason.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: "Rejection reason is required",
//       });
//     }

//     const attendance = await Attendance.findById(attendanceId);

//     if (!attendance) {
//       return res.status(404).json({
//         success: false,
//         message: "Attendance not found",
//       });
//     }

//     if (attendance.approvalStatus === "approved") {
//       return res.status(400).json({
//         success: false,
//         message: "Attendance already approved, cannot reject",
//       });
//     }

//     attendance.approvalStatus = "rejected";
//     attendance.rejectionReason = reason.trim();

//     await attendance.save();

//     return res.json({
//       success: true,
//       message: "Attendance Rejected",
//       data: formatAttendanceDocument(attendance),
//     });
//   } catch (err) {
//     console.error("RejectAttendance Error:", err);

//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= GET MY ATTENDANCE HISTORY =================
// exports.getMyAttendanceHistory = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId is required",
//       });
//     }

//     const attendance = await Attendance.find({ userId })
//       .populate("userId", "name email uniqueID role department")
//       .sort({ date: -1 });

//     res.status(200).json({
//       success: true,
//       count: attendance.length,
//       data: attendance.map(formatAttendanceDocument),
//     });
//   } catch (err) {
//     console.error("GetMyAttendanceHistory Error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= GET ATTENDANCE BY DATE =================
// exports.getAttendanceByDate = async (req, res) => {
//   try {
//     const { date } = req.params;

//     if (!date) {
//       return res.status(400).json({
//         success: false,
//         message: "date is required (YYYY-MM-DD)",
//       });
//     }

//     const attendance = await Attendance.find({ date })
//       .populate("userId", "name uniqueID role department");

//     res.status(200).json({
//       success: true,
//       count: attendance.length,
//       data: attendance.map(formatAttendanceDocument),
//     });
//   } catch (err) {
//     console.error("GetAttendanceByDate Error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= GET SINGLE ATTENDANCE =================
// exports.getSingleAttendance = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const attendance = await Attendance.findById(id)
//       .populate("userId", "name email uniqueID role department");

//     if (!attendance) {
//       return res.status(404).json({
//         success: false,
//         message: "Attendance not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: formatAttendanceDocument(attendance),
//     });
//   } catch (err) {
//     console.error("GetSingleAttendance Error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= GET MONTHLY ATTENDANCE =================
// exports.getMonthlyAttendance = async (req, res) => {
//   try {
//     const { userId, month } = req.params;

//     if (!userId || !month) {
//       return res.status(400).json({
//         success: false,
//         message: "userId and month are required (YYYY-MM)",
//       });
//     }

//     const attendance = await Attendance.find({
//       userId,
//       date: {
//         $regex: `^${month}`,
//       },
//     }).sort({ date: -1 });

//     res.status(200).json({
//       success: true,
//       count: attendance.length,
//       data: attendance.map(formatAttendanceDocument),
//     });
//   } catch (err) {
//     console.error("GetMonthlyAttendance Error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= ADMIN DASHBOARD STATISTICS =================
// exports.getAttendanceStats = async (req, res) => {
//   try {
//     const today = getToday();

//     const stats = await Attendance.aggregate([
//       {
//         $match: {
//           date: today,
//         },
//       },
//       {
//         $group: {
//           _id: "$approvalStatus",
//           count: { $sum: 1 },
//         },
//       },
//     ]);

//     const result = {
//       pending: 0,
//       approved: 0,
//       rejected: 0,
//       total: 0,
//     };

//     stats.forEach((item) => {
//       result[item._id] = item.count;
//       result.total += item.count;
//     });

//     // Get present/absent counts for today
//     const presentCount = await Attendance.countDocuments({
//       date: today,
//       approvalStatus: "approved",
//       status: "present",
//     });

//     const absentCount = await Attendance.countDocuments({
//       date: today,
//       approvalStatus: "approved",
//       status: "absent",
//     });

//     const halfDayCount = await Attendance.countDocuments({
//       date: today,
//       approvalStatus: "approved",
//       status: "half-day",
//     });

//     res.status(200).json({
//       success: true,
//       data: {
//         ...result,
//         present: presentCount,
//         absent: absentCount,
//         halfDay: halfDayCount,
//       },
//     });
//   } catch (err) {
//     console.error("GetAttendanceStats Error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= GET ABSENT ATTENDANCE =================
// exports.getAbsentAttendance = async (req, res) => {
//   try {
//     const { date } = req.params;
    
//     // ============================================
//     // 1. Build query
//     // ============================================
//     const query = {};
    
//     // If date is provided, filter by date
//     if (date) {
//       query.date = date;
//     } else {
//       // Default to today's date
//       query.date = getToday();
//     }
    
//     // Status "absent" - both approvalStatus and status should be considered
//     query.$or = [
//       { 
//         approvalStatus: "approved", 
//         status: "absent" 
//       },
//       { 
//         approvalStatus: "pending", 
//         status: "absent" 
//       }
//     ];
    
//     // ============================================
//     // 2. Fetch absent attendance records
//     // ============================================
//     const absentRecords = await Attendance.find(query)
//       .populate({
//         path: "userId",
//         select: "name uniqueID role email department phoneNumber",
//       })
//       .populate({
//         path: "approvedBy",
//         select: "name uniqueID role",
//       })
//       .sort({ createdAt: -1 });

//     // ============================================
//     // 3. Format response
//     // ============================================
//     const formatted = absentRecords.map((item) => {
//       const data = formatAttendanceDocument(item);

//       return {
//         _id: data._id,

//         employee: {
//           _id: data.userId?._id,
//           name: data.userId?.name || "",
//           uniqueID: data.userId?.uniqueID || "",
//           email: data.userId?.email || "",
//           department: data.userId?.department || "",
//           phoneNumber: data.userId?.phoneNumber || "",
//           role: data.userId?.role || data.userType,
//         },

//         date: data.date,
//         dateDisplay: data.dateDisplay,

//         checkInTime: data.checkInTime,
//         checkInTimeDisplay: data.checkInTimeDisplay,
//         checkInTimeFullDisplay: data.checkInTimeFullDisplay,

//         approvedCheckInTime: data.approvedCheckInTime,
//         approvedCheckInTimeDisplay: data.approvedCheckInTimeDisplay,
//         approvedCheckInTimeFullDisplay: data.approvedCheckInTimeFullDisplay,

//         checkOutTime: data.checkOutTime,
//         checkOutTimeDisplay: data.checkOutTimeDisplay,
//         checkOutTimeFullDisplay: data.checkOutTimeFullDisplay,

//         breaks: data.breaks,
//         totalBreakTime: data.totalBreakTime,
//         totalBreakTimeDisplay: data.totalBreakTimeDisplay,

//         totalWorkTime: data.totalWorkTime,
//         totalWorkTimeDisplay: data.totalWorkTimeDisplay,

//         isLate: data.isLate,
//         status: data.status,
//         approvalStatus: data.approvalStatus,

//         approvedAt: data.approvedAt,
//         approvedAtDisplay: data.approvedAtDisplay,
//         approvedAtFullDisplay: data.approvedAtFullDisplay,

//         approvedBy: data.approvedBy
//           ? {
//               _id: data.approvedBy._id,
//               name: data.approvedBy.name,
//               uniqueID: data.approvedBy.uniqueID,
//               role: data.approvedBy.role,
//             }
//           : null,

//         createdAt: data.createdAt,
//         createdAtDisplay: data.createdAtDisplay,

//         updatedAt: data.updatedAt,
//         updatedAtDisplay: data.updatedAtDisplay,
//       };
//     });

//     // ============================================
//     // 4. Statistics
//     // ============================================
//     const totalAbsent = formatted.length;
    
//     const pendingAbsent = absentRecords.filter(
//       (record) => record.approvalStatus === "pending"
//     ).length;
    
//     const approvedAbsent = absentRecords.filter(
//       (record) => record.approvalStatus === "approved"
//     ).length;

//     // Role-wise breakdown
//     const roleWise = {
//       employee: 0,
//       intern: 0,
//       teamlead: 0,
//       other: 0,
//     };

//     formatted.forEach((record) => {
//       const role = record.employee?.role?.toLowerCase() || "other";
//       if (role === "employee") roleWise.employee++;
//       else if (role === "intern") roleWise.intern++;
//       else if (role === "teamlead" || role === "team lead") roleWise.teamlead++;
//       else roleWise.other++;
//     });

//     // ============================================
//     // 5. Response
//     // ============================================
//     return res.status(200).json({
//       success: true,
//       message: `Absent attendance records for ${query.date}`,
      
//       summary: {
//         total: totalAbsent,
//         pending: pendingAbsent,
//         approved: approvedAbsent,
//         date: query.date,
//         roleWise,
//       },
      
//       data: formatted,
//     });

//   } catch (err) {
//     console.error("GetAbsentAttendance Error:", err);
    
//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= GET ABSENT ATTENDANCE BY DATE RANGE =================
// exports.getAbsentAttendanceByDateRange = async (req, res) => {
//   try {
//     const { startDate, endDate } = req.query;
    
//     // ============================================
//     // 1. Validate dates
//     // ============================================
//     if (!startDate || !endDate) {
//       return res.status(400).json({
//         success: false,
//         message: "startDate and endDate are required (YYYY-MM-DD)",
//       });
//     }

//     // ============================================
//     // 2. Build query
//     // ============================================
//     const query = {
//       date: {
//         $gte: startDate,
//         $lte: endDate,
//       },
//       $or: [
//         { 
//           approvalStatus: "approved", 
//           status: "absent" 
//         },
//         { 
//           approvalStatus: "pending", 
//           status: "absent" 
//         }
//       ]
//     };

//     // ============================================
//     // 3. Fetch absent attendance records
//     // ============================================
//     const absentRecords = await Attendance.find(query)
//       .populate({
//         path: "userId",
//         select: "name uniqueID role email department phoneNumber",
//       })
//       .populate({
//         path: "approvedBy",
//         select: "name uniqueID role",
//       })
//       .sort({ date: -1, createdAt: -1 });

//     // ============================================
//     // 4. Format response
//     // ============================================
//     const formatted = absentRecords.map((item) => {
//       const data = formatAttendanceDocument(item);

//       return {
//         _id: data._id,

//         employee: {
//           _id: data.userId?._id,
//           name: data.userId?.name || "",
//           uniqueID: data.userId?.uniqueID || "",
//           email: data.userId?.email || "",
//           department: data.userId?.department || "",
//           phoneNumber: data.userId?.phoneNumber || "",
//           role: data.userId?.role || data.userType,
//         },

//         date: data.date,
//         dateDisplay: data.dateDisplay,

//         checkInTime: data.checkInTime,
//         checkInTimeDisplay: data.checkInTimeDisplay,
//         checkInTimeFullDisplay: data.checkInTimeFullDisplay,

//         approvedCheckInTime: data.approvedCheckInTime,
//         approvedCheckInTimeDisplay: data.approvedCheckInTimeDisplay,
//         approvedCheckInTimeFullDisplay: data.approvedCheckInTimeFullDisplay,

//         checkOutTime: data.checkOutTime,
//         checkOutTimeDisplay: data.checkOutTimeDisplay,
//         checkOutTimeFullDisplay: data.checkOutTimeFullDisplay,

//         breaks: data.breaks,
//         totalBreakTime: data.totalBreakTime,
//         totalBreakTimeDisplay: data.totalBreakTimeDisplay,

//         totalWorkTime: data.totalWorkTime,
//         totalWorkTimeDisplay: data.totalWorkTimeDisplay,

//         isLate: data.isLate,
//         status: data.status,
//         approvalStatus: data.approvalStatus,

//         approvedAt: data.approvedAt,
//         approvedAtDisplay: data.approvedAtDisplay,
//         approvedAtFullDisplay: data.approvedAtFullDisplay,

//         approvedBy: data.approvedBy
//           ? {
//               _id: data.approvedBy._id,
//               name: data.approvedBy.name,
//               uniqueID: data.approvedBy.uniqueID,
//               role: data.approvedBy.role,
//             }
//           : null,

//         createdAt: data.createdAt,
//         createdAtDisplay: data.createdAtDisplay,

//         updatedAt: data.updatedAt,
//         updatedAtDisplay: data.updatedAtDisplay,
//       };
//     });

//     // ============================================
//     // 5. Daily breakdown
//     // ============================================
//     const dailyBreakdown = {};
    
//     formatted.forEach((record) => {
//       const date = record.date;
//       if (!dailyBreakdown[date]) {
//         dailyBreakdown[date] = {
//           date,
//           count: 0,
//           pending: 0,
//           approved: 0,
//           employees: [],
//         };
//       }
//       dailyBreakdown[date].count++;
      
//       if (record.approvalStatus === "pending") {
//         dailyBreakdown[date].pending++;
//       } else if (record.approvalStatus === "approved") {
//         dailyBreakdown[date].approved++;
//       }
      
//       dailyBreakdown[date].employees.push({
//         _id: record.employee._id,
//         name: record.employee.name,
//         uniqueID: record.employee.uniqueID,
//         role: record.employee.role,
//       });
//     });

//     // ============================================
//     // 6. Response
//     // ============================================
//     return res.status(200).json({
//       success: true,
//       message: `Absent attendance records from ${startDate} to ${endDate}`,
      
//       summary: {
//         total: formatted.length,
//         startDate,
//         endDate,
//         dateRange: `${startDate} to ${endDate}`,
//       },
      
//       dailyBreakdown: Object.values(dailyBreakdown),
      
//       data: formatted,
//     });

//   } catch (err) {
//     console.error("GetAbsentAttendanceByDateRange Error:", err);
    
//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

// // ================= GET USER'S ABSENT ATTENDANCE =================
// // ================= GET DATE-WISE ABSENT ATTENDANCE =================
// exports.getAllAbsentAttendance = async (req, res) => {
//   try {
//     const date = req.query.date || getToday();

//     if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
//       return res.status(400).json({
//         success: false,
//         message: "date must be in YYYY-MM-DD format",
//       });
//     }

//     const attendance = await getDateWiseAttendance(date);

//     const absentRecords = attendance.filter(
//       (item) =>
//         item.status === "absent"
//     );

//     const roleWise = {
//       employee: 0,
//       intern: 0,
//       teamlead: 0,
//       other: 0,
//     };

//     absentRecords.forEach((record) => {
//       const role =
//         record.employee?.role
//           ?.toLowerCase()
//           ?.trim() || "other";

//       if (role === "employee") {
//         roleWise.employee++;
//       } else if (role === "intern") {
//         roleWise.intern++;
//       } else if (
//         role === "teamlead" ||
//         role === "team lead"
//       ) {
//         roleWise.teamlead++;
//       } else {
//         roleWise.other++;
//       }
//     });

//     const notCheckedIn = absentRecords.filter(
//       (item) =>
//         item.approvalStatus ===
//         "not_checked_in"
//     ).length;

//     const checkedInAbsent = absentRecords.filter(
//       (item) =>
//         item.approvalStatus !==
//         "not_checked_in"
//     ).length;

//     return res.status(200).json({
//       success: true,

//       message:
//         `Absent attendance records for ${date}`,

//       summary: {
//         date,

//         total: absentRecords.length,

//         notCheckedIn,

//         checkedInAbsent,

//         roleWise,
//       },

//       data: absentRecords,
//     });
//   } catch (err) {
//     console.error(
//       "GetAllAbsentAttendance Error:",
//       err
//     );

//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

const Attendance = require("../models/Attendance");
const User = require("../models/User");

// ============================================================
// BASIC HELPERS
// ============================================================

const pad = (value) => String(value).padStart(2, "0");

// ============================================================
// DEFAULT SETTINGS
// ============================================================

const DEFAULT_OFFICE_START_TIME = "10:00";
const DEFAULT_LATE_CUTOFF = "10:10";
const DEFAULT_HALF_DAY_CUTOFF = "10:30";
const DEFAULT_ABSENT_CUTOFF = "15:00";
const DEFAULT_OFFICE_END_TIME = "19:00";

const DEFAULT_PRESENT_HOURS = 8;
const DEFAULT_HALF_DAY_HOURS = 4;
const DEFAULT_BREAK_LIMIT = 60;

// ============================================================
// NORMALIZE TIME
// ============================================================

const normalizeTime = (value, fallback) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const parts = value.trim().split(":");

  if (parts.length < 2) {
    return fallback;
  }

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 || 
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return fallback;
  }

  return `${pad(hour)}:${pad(minute)}`;
};

// ============================================================
// TIME TO MINUTES
// ============================================================

const timeToMinutes = (time) => {
  const normalized = normalizeTime(
    time,
    DEFAULT_LATE_CUTOFF
  );

  const [hour, minute] = normalized
    .split(":")
    .map(Number);

  return hour * 60 + minute;
};

// ============================================================
// VALIDATE SETTINGS ORDER
//
// office start <= late cutoff <= absent cutoff <= office end
// ============================================================

const normalizeAttendanceSettings = (source = {}) => {
  const settingsSource =
    source.settings &&
    typeof source.settings === "object"
      ? source.settings
      : source;

  const officeStartTime = normalizeTime(
    settingsSource.officeStartTime,
    DEFAULT_OFFICE_START_TIME
  );

  const lateCutoffTime = normalizeTime(
    settingsSource.lateCutoffTime ??
      settingsSource.lateAfter ??
      settingsSource.lateAfterTime,
    DEFAULT_LATE_CUTOFF
  );

  const halfDayCutoffTime = normalizeTime(
    settingsSource.halfDayCutoffTime ??
      settingsSource.halfDayAfter ??
      settingsSource.halfDayAfterTime,
    DEFAULT_HALF_DAY_CUTOFF
  );

  const absentCutoffTime = normalizeTime(
    settingsSource.absentCutoffTime ??
      settingsSource.absentAfter ??
      settingsSource.absentAfterTime,
    DEFAULT_ABSENT_CUTOFF
  );

  const officeEndTime = normalizeTime(
    settingsSource.officeEndTime,
    DEFAULT_OFFICE_END_TIME
  );

  const presentHours =
    Number(settingsSource.presentHours) ||
    DEFAULT_PRESENT_HOURS;

  const halfDayHours =
    Number(settingsSource.halfDayHours) ||
    DEFAULT_HALF_DAY_HOURS;

  const breakLimit =
    Number(settingsSource.breakLimit) ||
    DEFAULT_BREAK_LIMIT;

  return {
    officeStartTime,
    lateCutoffTime,
    halfDayCutoffTime,
    absentCutoffTime,
    officeEndTime,
    presentHours,
    halfDayHours,
    breakLimit,
  };
};

// ============================================================
// GET ATTENDANCE SETTINGS
// ============================================================

const getAttendanceSettings = (source = {}) => {
  return normalizeAttendanceSettings(source);
};

// ============================================================
// IST DATE PARTS
// ============================================================

const getISTDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(date));

  const get = (type) =>
    parts.find(
      (part) => part.type === type
    )?.value;

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
};

// ============================================================
// GET TODAY IST
// ============================================================

const getToday = (date = new Date()) => {
  const parts = getISTDateParts(date);

  return `${parts.year}-${parts.month}-${parts.day}`;
};

// ============================================================
// FORMAT IST TIME
// ============================================================

const formatISTTime = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find(
    (part) => part.type === "hour"
  )?.value;

  const minute = parts.find(
    (part) => part.type === "minute"
  )?.value;

  return `${hour}:${minute}`;
};

// ============================================================
// FORMAT IST DATE TIME
// ============================================================

const formatISTDateTime = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) =>
    parts.find(
      (part) => part.type === type
    )?.value;

  return `${get("year")}-${get("month")}-${get(
    "day"
  )} ${get("hour")}:${get("minute")}:${get(
    "second"
  )}`;
};

// ============================================================
// IST PARTS -> UTC DATE
// ============================================================

const getISTDateFromParts = ({
  year,
  month,
  day,
  hour,
  minute,
  second,
}) => {
  const utcHour = Number(hour) - 5;
  const utcMinute = Number(minute) - 30;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      utcHour,
      utcMinute,
      Number(second || 0)
    )
  );
};

// ============================================================
// CURRENT IST TIME
// ============================================================

const getISTNow = () => {
  const now = new Date();
  const parts = getISTDateParts(now);

  return getISTDateFromParts(parts);
};

// ============================================================
// CREATE IST TIME FOR A DATE
// ============================================================

const getTimeForDate = (
  date,
  timeString
) => {
  const parts = getISTDateParts(
    new Date(date)
  );

  const normalized = normalizeTime(
    timeString,
    DEFAULT_LATE_CUTOFF
  );

  const [hour, minute] =
    normalized.split(":");

  return getISTDateFromParts({
    ...parts,
    hour,
    minute,
    second: "00",
  });
};

// ============================================================
// CALCULATE ATTENDANCE STATUS
//
// IMPORTANT:
//
// At or before late cutoff = NOT LATE
// After late cutoff and at or before absent cutoff = LATE
// After absent cutoff = ABSENT
//
// ============================================================

const calculateAttendanceStatus = (
  checkInTime,
  settings
) => {
  if (!checkInTime) {
    return {
      isLate: false,
      isAbsentDueToLate: false,
      status: "absent",
    };
  }

  const checkIn = new Date(checkInTime);

  if (Number.isNaN(checkIn.getTime())) {
    return {
      isLate: false,
      isAbsentDueToLate: false,
      status: "absent",
    };
  }

  const lateCutoff = getTimeForDate(
    checkIn,
    settings.lateCutoffTime || DEFAULT_LATE_CUTOFF
  );

  const halfDayCutoff = getTimeForDate(
    checkIn,
    settings.halfDayCutoffTime || DEFAULT_HALF_DAY_CUTOFF
  );

  const absentCutoff = getTimeForDate(
    checkIn,
    settings.absentCutoffTime || DEFAULT_ABSENT_CUTOFF
  );

  const timestamp =
    checkIn.getTime();

  const lateTimestamp =
    lateCutoff.getTime();

  const halfDayTimestamp =
    halfDayCutoff.getTime();

  const absentTimestamp =
    absentCutoff.getTime();

  // ==========================================================
  // NOT LATE (10:00 AM to 10:10 AM)
  // ==========================================================

  if (timestamp <= lateTimestamp) {
    return {
      isLate: false,
      isHalfDay: false,
      isAbsentDueToLate: false,
      status: "present",
      lateCutoff,
      halfDayCutoff,
      absentCutoff,
    };
  }

  // ==========================================================
  // LATE (10:11 AM to 10:30 AM)
  // ==========================================================

  if (timestamp <= halfDayTimestamp) {
    return {
      isLate: true,
      isHalfDay: false,
      isAbsentDueToLate: false,
      status: "present",
      lateCutoff,
      halfDayCutoff,
      absentCutoff,
    };
  }

  // ==========================================================
  // HALF DAY (10:31 AM to 3:00 PM / 15:00)
  // ==========================================================

  if (timestamp <= absentTimestamp) {
    return {
      isLate: true,
      isHalfDay: true,
      isAbsentDueToLate: false,
      status: "half-day",
      lateCutoff,
      halfDayCutoff,
      absentCutoff,
    };
  }

  // ==========================================================
  // ABSENT (> 3:00 PM / 15:00)
  // ==========================================================

  return {
    isLate: true,
    isHalfDay: false,
    isAbsentDueToLate: true,
    status: "absent",
    lateCutoff,
    halfDayCutoff,
    absentCutoff,
  };
};

// ============================================================
// BACKWARD COMPATIBILITY
// ============================================================

const calculateLateStatus = (
  checkInTime,
  lateCutoffTime,
  absentCutoffTime
) => {
  const settings = {
    lateCutoffTime:
      normalizeTime(
        lateCutoffTime,
        DEFAULT_LATE_CUTOFF
      ),

    absentCutoffTime:
      normalizeTime(
        absentCutoffTime,
        DEFAULT_ABSENT_CUTOFF
      ),
  };

  const result =
    calculateAttendanceStatus(
      checkInTime,
      settings
    );

  return result;
};

// ============================================================
// GET WORKING HOURS
// ============================================================

const getWorkingHours = (
  checkIn,
  checkOut,
  breakTime = 0
) => {
  if (!checkIn || !checkOut) {
    return 0;
  }

  const checkInDate =
    new Date(checkIn);

  const checkOutDate =
    new Date(checkOut);

  let totalMinutes =
    (
      checkOutDate.getTime() -
      checkInDate.getTime()
    ) /
    (1000 * 60);

  const breakMinutes = Math.min(
    Number(breakTime) || 0,
    DEFAULT_BREAK_LIMIT
  );

  totalMinutes -= breakMinutes;

  return Math.max(
    0,
    totalMinutes / 60
  );
};

// ============================================================
// FORMAT ATTENDANCE
// ============================================================

const formatAttendanceDocument = (
  attendance
) => {
  if (!attendance) {
    return attendance;
  }

  const plainAttendance =
    attendance.toObject?.() ??
    JSON.parse(
      JSON.stringify(attendance)
    );

  const formatDateField = (
    fieldName
  ) => {
    if (
      plainAttendance[fieldName]
    ) {
      plainAttendance[
        `${fieldName}Display`
      ] = formatISTTime(
        plainAttendance[fieldName]
      );

      plainAttendance[
        `${fieldName}FullDisplay`
      ] = formatISTDateTime(
        plainAttendance[fieldName]
      );
    }
  };

  formatDateField("checkInTime");
  formatDateField("checkOutTime");
  formatDateField("approvedAt");
  formatDateField(
    "approvedCheckInTime"
  );
  formatDateField("createdAt");
  formatDateField("updatedAt");

  if (plainAttendance.date) {
    plainAttendance.dateDisplay =
      plainAttendance.date;
  }

  // ==========================================================
  // BREAKS
  // ==========================================================

  if (
    plainAttendance.breaks?.length
  ) {
    plainAttendance.breaks =
      plainAttendance.breaks.map(
        (breakItem) => ({
          ...breakItem,

          startTimeDisplay:
            formatISTTime(
              breakItem.startTime
            ),

          endTimeDisplay:
            formatISTTime(
              breakItem.endTime
            ),

          startTimeFullDisplay:
            formatISTDateTime(
              breakItem.startTime
            ),

          endTimeFullDisplay:
            formatISTDateTime(
              breakItem.endTime
            ),
        })
      );
  }

  // ==========================================================
  // TOTAL WORK TIME
  // ==========================================================

  if (
    plainAttendance.totalWorkTime !=
    null
  ) {
    const hours = Math.floor(
      Number(
        plainAttendance.totalWorkTime
      )
    );

    const minutes = Math.round(
      (
        Number(
          plainAttendance.totalWorkTime
        ) - hours
      ) * 60
    );

    plainAttendance.totalWorkTimeDisplay =
      `${hours}h ${minutes}m`;

    plainAttendance.totalWorkTimeHours =
      `${Number(
        plainAttendance.totalWorkTime
      ).toFixed(2)} hours`;
  }

  // ==========================================================
  // TOTAL BREAK TIME
  // ==========================================================

  if (
    plainAttendance.totalBreakTime !=
    null
  ) {
    const hours = Math.floor(
      Number(
        plainAttendance.totalBreakTime
      ) / 60
    );

    const minutes = Math.round(
      Number(
        plainAttendance.totalBreakTime
      ) % 60
    );

    plainAttendance.totalBreakTimeDisplay =
      `${hours}h ${minutes}m`;
  }

  return plainAttendance;
};

// ============================================================
// GET DATE-WISE ATTENDANCE
// ============================================================

const getDateWiseAttendance =
  async (date) => {
    const Employee =
      require("../models/Employee");

    const users =
      await User.find({
        isApproved: { $ne: false },
      }).select(
        "_id name uniqueID role email department phoneNumber"
      );

    const teamLeadEmployees =
      await Employee.find({
        isTeamLead: true,
      }).select("userID userId");

    const teamLeadIds = new Set();
    teamLeadEmployees.forEach((item) => {
      const id = item.userID || item.userId;
      if (id) teamLeadIds.add(id.toString());
    });

    const allEmployees = await Employee.find({}).select("_id userID userId");
    const empToUserMap = new Map();
    allEmployees.forEach((emp) => {
      const uId = emp.userID || emp.userId;
      if (uId) {
        empToUserMap.set(emp._id.toString(), uId.toString());
      }
    });

    const membersMap =
      new Map();

    users.forEach((user) => {
      let role =
        user.role?.toLowerCase();

      if (
        teamLeadIds.has(
          user._id.toString()
        )
      ) {
        role = "teamlead";
      }

      membersMap.set(
        user._id.toString(),
        {
          user,
          role,
        }
      );
    });

    const attendanceRecords =
      await Attendance.find({
        date,
      })
        .populate({
          path: "userId",
          select:
            "name uniqueID role email department phoneNumber",
        })
        .populate({
          path: "approvedBy",
          select:
            "name uniqueID role",
        })
        .sort({
          updatedAt: -1,
          createdAt: -1,
        });

    const attendanceMap =
      new Map();

    attendanceRecords.forEach(
      (attendance) => {
        let matchedUserId = attendance.userId?._id
          ? attendance.userId._id.toString()
          : attendance.userId
          ? attendance.userId.toString()
          : null;

        if (matchedUserId && empToUserMap.has(matchedUserId)) {
          matchedUserId = empToUserMap.get(matchedUserId);
        }

        if (
          matchedUserId &&
          !attendanceMap.has(
            matchedUserId
          )
        ) {
          attendanceMap.set(
            matchedUserId,
            attendance
          );
        }
      }
    );

    const result = [];

    for (
      const member of membersMap.values()
    ) {
      const user =
        member.user;

      const userId =
        user._id.toString();

      const attendance =
        attendanceMap.get(userId);

      if (!attendance) {
        result.push({
          _id: null,

          employee: {
            _id: user._id,
            name: user.name || "",
            uniqueID:
              user.uniqueID || "",
            email:
              user.email || "",
            department:
              user.department || "",
            phoneNumber:
              user.phoneNumber || "",
            role:
              member.role ||
              user.role ||
              "",
          },

          date,
          dateDisplay: date,

          checkInTime: null,
          checkInTimeDisplay: null,
          checkInTimeFullDisplay: null,

          approvedCheckInTime: null,
          approvedCheckInTimeDisplay:
            null,
          approvedCheckInTimeFullDisplay:
            null,

          checkOutTime: null,
          checkOutTimeDisplay: null,
          checkOutTimeFullDisplay: null,

          breaks: [],

          totalBreakTime: 0,
          totalBreakTimeDisplay:
            "0h 0m",

          totalWorkTime: 0,
          totalWorkTimeDisplay:
            "0h 0m",

          totalWorkTimeHours:
            "0.00 hours",

          isLate: false,

          status: "absent",

          approvalStatus:
            "not_checked_in",

          approvedAt: null,
          approvedAtDisplay: null,
          approvedAtFullDisplay: null,

          approvedBy: null,

          createdAt: null,
          createdAtDisplay: null,

          updatedAt: null,
          updatedAtDisplay: null,

          lateCutoffTime:
            DEFAULT_LATE_CUTOFF,

          absentCutoffTime:
            DEFAULT_ABSENT_CUTOFF,
        });

        continue;
      }

      const data =
        formatAttendanceDocument(
          attendance
        );

      result.push({
        _id: data._id,

        employee: {
          _id:
            data.userId?._id ||
            user._id,

          name:
            data.userId?.name ||
            user.name ||
            "",

          uniqueID:
            data.userId?.uniqueID ||
            user.uniqueID ||
            "",

          email:
            data.userId?.email ||
            user.email ||
            "",

          department:
            data.userId?.department ||
            user.department ||
            "",

          phoneNumber:
            data.userId?.phoneNumber ||
            user.phoneNumber ||
            "",

          role:
            member.role ||
            data.userId?.role ||
            user.role ||
            "",
        },

        date:
          data.date || date,

        dateDisplay:
          data.dateDisplay || date,

        checkInTime:
          data.checkInTime || null,

        checkInTimeDisplay:
          data.checkInTimeDisplay ||
          null,

        checkInTimeFullDisplay:
          data.checkInTimeFullDisplay ||
          null,

        approvedCheckInTime:
          data.approvedCheckInTime ||
          null,

        approvedCheckInTimeDisplay:
          data.approvedCheckInTimeDisplay ||
          null,

        approvedCheckInTimeFullDisplay:
          data.approvedCheckInTimeFullDisplay ||
          null,

        checkOutTime:
          data.checkOutTime || null,

        checkOutTimeDisplay:
          data.checkOutTimeDisplay ||
          null,

        checkOutTimeFullDisplay:
          data.checkOutTimeFullDisplay ||
          null,

        breaks:
          data.breaks || [],

        totalBreakTime:
          data.totalBreakTime || 0,

        totalBreakTimeDisplay:
          data.totalBreakTimeDisplay ||
          "0h 0m",

        totalWorkTime:
          data.totalWorkTime || 0,

        totalWorkTimeDisplay:
          data.totalWorkTimeDisplay ||
          "0h 0m",

        totalWorkTimeHours:
          data.totalWorkTimeHours ||
          "0.00 hours",

        isLate:
          data.isLate || false,

        status:
          data.status || "absent",

        approvalStatus:
          data.approvalStatus ||
          "pending",

        approvedAt:
          data.approvedAt || null,

        approvedAtDisplay:
          data.approvedAtDisplay ||
          null,

        approvedAtFullDisplay:
          data.approvedAtFullDisplay ||
          null,

        approvedBy:
          data.approvedBy
            ? {
                _id:
                  data.approvedBy._id,
                name:
                  data.approvedBy.name,
                uniqueID:
                  data.approvedBy.uniqueID,
                role:
                  data.approvedBy.role,
              }
            : null,

        createdAt:
          data.createdAt || null,

        createdAtDisplay:
          data.createdAtDisplay ||
          null,

        updatedAt:
          data.updatedAt || null,

        updatedAtDisplay:
          data.updatedAtDisplay ||
          null,

        lateCutoffTime:
          data.lateCutoffTime ||
          DEFAULT_LATE_CUTOFF,

        absentCutoffTime:
          data.absentCutoffTime ||
          DEFAULT_ABSENT_CUTOFF,
      });
    }

    return result;
  };

// ============================================================
// ENSURE TODAY ATTENDANCE
// ============================================================

const ensureTodayAttendance =
  async (date = getToday()) => {
    try {
      const users =
        await User.find({
          isApproved: { $ne: false },
        }).select("_id role");

      const Employee =
        require("../models/Employee");

      const teamLeadEmployees =
        await Employee.find({
          isTeamLead: true,
        }).select("userId");

      const membersMap =
        new Map();

      users.forEach((user) => {
        membersMap.set(
          user._id.toString(),
          {
            _id: user._id,
            role: user.role,
          }
        );
      });

      teamLeadEmployees.forEach(
        (employee) => {
          if (employee.userId) {
            membersMap.set(
              employee.userId.toString(),
              {
                _id:
                  employee.userId,
                role: "teamlead",
              }
            );
          }
        }
      );

      const existingAttendance =
        await Attendance.find({
          date,
        }).select("userId");

      const existingUserIds =
        new Set(
          existingAttendance.map(
            (attendance) =>
              attendance.userId.toString()
          )
        );

      const absentRecords = [];

      for (
        const member of membersMap.values()
      ) {
        const userId =
          member._id.toString();

        if (
          !existingUserIds.has(
            userId
          )
        ) {
          absentRecords.push({
            userId: member._id,

            userType:
              member.role.toLowerCase(),

            date,

            checkInTime: null,
            approvedCheckInTime: null,
            checkOutTime: null,

            breaks: [],

            totalBreakTime: 0,
            totalWorkTime: 0,

            isLate: false,

            status: "absent",

            approvalStatus:
              "approved",
          });
        }
      }

      if (
        absentRecords.length > 0
      ) {
        await Attendance.insertMany(
          absentRecords
        );
      }

      return {
        success: true,
        date,
        created:
          absentRecords.length,
      };
    } catch (error) {
      console.error(
        "ensureTodayAttendance Error:",
        error
      );

      throw error;
    }
  };

// ============================================================
// CHECK IN
// ============================================================

exports.checkIn = async (
  req,
  res
) => {
  try {
    const {
      userId,
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message:
          "userId is required",
      });
    }

    const user =
      await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    const userType =
      user.role
        .trim()
        .toLowerCase();

    const date = getToday();

    // ========================================================
    // READ CURRENT FRONTEND SETTINGS
    // ========================================================

    const settings =
      getAttendanceSettings(
        req.body
      );

    // ========================================================
    // ENSURE ATTENDANCE
    // ========================================================

    await ensureTodayAttendance(
      date
    );

    let attendance =
      await Attendance.findOne({
        userId,
        date,
      });

    if (!attendance) {
      attendance =
        await Attendance.create({
          userId,
          userType,
          date,

          checkInTime: null,
          approvedCheckInTime: null,
          checkOutTime: null,

          breaks: [],

          totalBreakTime: 0,
          totalWorkTime: 0,

          isLate: false,

          status: "absent",

          approvalStatus:
            "approved",
        });
    }

    if (
      attendance.approvalStatus ===
      "pending"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Your check-in request is already pending admin approval.",

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    }

    if (
      attendance.approvalStatus ===
        "approved" &&
      attendance.checkInTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You have already checked in today.",

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    }

    // ========================================================
    // ACTUAL CHECK-IN
    // ========================================================

    const actualCheckInTime =
      getISTNow();

    // ========================================================
    // CALCULATE STATUS
    //
    // THIS USES THE SETTINGS THAT WERE SENT DURING CHECK-IN
    // ========================================================

    const attendanceStatus =
      calculateAttendanceStatus(
        actualCheckInTime,
        settings
      );

    // ========================================================
    // SAVE
    // ========================================================

    attendance.userType =
      userType;

    attendance.checkInTime =
      actualCheckInTime;

    attendance.approvedCheckInTime =
      null;

    attendance.checkOutTime =
      null;

    attendance.breaks = [];

    attendance.totalBreakTime = 0;

    attendance.totalWorkTime = 0;

    attendance.isLate =
      attendanceStatus.isLate;

    // ========================================================
    // SAVE SETTINGS WITH THIS ATTENDANCE
    //
    // IMPORTANT:
    // These settings belong to this attendance record.
    // ========================================================

    attendance.officeStartTime =
      settings.officeStartTime;

    attendance.lateCutoffTime =
      settings.lateCutoffTime;

    attendance.absentCutoffTime =
      settings.absentCutoffTime;

    attendance.officeEndTime =
      settings.officeEndTime;

    attendance.presentHours =
      settings.presentHours;

    attendance.halfDayHours =
      settings.halfDayHours;

    attendance.breakLimit =
      settings.breakLimit;

    // ========================================================
    // STATUS
    // ========================================================

    attendance.status =
      attendanceStatus.status;

    // ========================================================
    // APPROVAL REQUIRED
    // ========================================================

    attendance.approvalStatus =
      "pending";

    await attendance.save();

    // ========================================================
    // MESSAGE
    // ========================================================

    let message;

    if (
      attendanceStatus.isAbsentDueToLate
    ) {
      message =
        `Check-in request sent successfully. ` +
        `You checked in at ${formatISTTime(
          actualCheckInTime
        )}, which is after ${settings.absentCutoffTime}. ` +
        `You will be marked absent after approval.`;
    } else if (
      attendanceStatus.isLate
    ) {
      message =
        `Check-in request sent successfully. ` +
        `You checked in at ${formatISTTime(
          actualCheckInTime
        )}. You are marked as late.`;
    } else {
      message =
        `Check-in request sent successfully at ${formatISTTime(
          actualCheckInTime
        )}. Waiting for admin approval.`;
    }

    return res.status(201).json({
      success: true,

      message,

      settings: {
        officeStartTime:
          settings.officeStartTime,

        lateCutoffTime:
          settings.lateCutoffTime,

        absentCutoffTime:
          settings.absentCutoffTime,

        officeEndTime:
          settings.officeEndTime,

        presentHours:
          settings.presentHours,

        halfDayHours:
          settings.halfDayHours,

        breakLimit:
          settings.breakLimit,
      },

      timerStartTime: null,

      data:
        formatAttendanceDocument(
          attendance
        ),
    });
  } catch (err) {
    console.error(
      "CheckIn Error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ============================================================
// APPROVE ATTENDANCE
//
// CRITICAL FIX:
//
// NEVER let stale frontend settings overwrite the settings
// saved during check-in.
//
// Priority:
//
// 1. Attendance's saved settings
// 2. Request settings
// 3. Defaults
//
// ============================================================

exports.approveAttendance =
  async (req, res) => {
    try {
      const {
        attendanceId,
        approvedBy,
        lateCutoffTime,
        absentCutoffTime,
      } = req.body;

      if (
        !attendanceId ||
        !approvedBy
      ) {
        return res.status(400).json({
          success: false,
          message:
            "attendanceId and approvedBy are required",
        });
      }

      const approver =
        await User.findById(
          approvedBy
        );

      if (!approver) {
        return res.status(404).json({
          success: false,
          message:
            "Approver not found",
        });
      }

      if (
        !["admin", "hr"].includes(
          approver.role
            .toLowerCase()
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only Admin or HR can approve attendance",
        });
      }

      const attendance =
        await Attendance.findById(
          attendanceId
        );

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance request not found",
        });
      }

      if (
        attendance.approvalStatus ===
        "approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Attendance already approved",
        });
      }

      if (
        attendance.approvalStatus ===
        "rejected"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Attendance request has already been rejected",
        });
      }

      const checkInTime =
        attendance.checkInTime;

      if (!checkInTime) {
        return res.status(400).json({
          success: false,
          message:
            "Actual check-in time not found. Employee must check in again.",
        });
      }

      // ======================================================
      // CRITICAL FIX
      //
      // DO NOT blindly use frontend approval values.
      //
      // Attendance already contains the settings that were
      // active when employee checked in.
      // ======================================================

      const settings =
        getAttendanceSettings({
          officeStartTime:
            attendance.officeStartTime ||
            req.body.officeStartTime,

          lateCutoffTime:
            attendance.lateCutoffTime ||
            lateCutoffTime,

          absentCutoffTime:
            attendance.absentCutoffTime ||
            absentCutoffTime,

          officeEndTime:
            attendance.officeEndTime ||
            req.body.officeEndTime,

          presentHours:
            attendance.presentHours ||
            req.body.presentHours,

          halfDayHours:
            attendance.halfDayHours ||
            req.body.halfDayHours,

          breakLimit:
            attendance.breakLimit ||
            req.body.breakLimit,
        });

      // ======================================================
      // APPROVAL TIME
      //
      // This is ONLY approval time.
      // It is NEVER check-in time.
      // ======================================================

      const approvalTime =
        getISTNow();

      // ======================================================
      // CALCULATE USING ACTUAL CHECK-IN
      // ======================================================

      const attendanceStatus =
        calculateAttendanceStatus(
          checkInTime,
          settings
        );

      // ======================================================
      // APPROVE
      // ======================================================

      attendance.approvalStatus =
        "approved";

      attendance.approvedBy =
        approver._id;

      attendance.approvedAt =
        approvalTime;

      // ======================================================
      // ACTUAL CHECK-IN REMAINS UNCHANGED
      // ======================================================

      attendance.checkInTime =
        checkInTime;

      attendance.approvedCheckInTime =
        checkInTime;

      attendance.isLate =
        attendanceStatus.isLate;

      // ======================================================
      // SAVE THE SAME SETTINGS
      // ======================================================

      attendance.officeStartTime =
        settings.officeStartTime;

      attendance.lateCutoffTime =
        settings.lateCutoffTime;

      attendance.absentCutoffTime =
        settings.absentCutoffTime;

      attendance.officeEndTime =
        settings.officeEndTime;

      attendance.presentHours =
        settings.presentHours;

      attendance.halfDayHours =
        settings.halfDayHours;

      attendance.breakLimit =
        settings.breakLimit;

      // ======================================================
      // STATUS
      // ======================================================

      attendance.status =
        attendanceStatus.status;

      await attendance.save();

      // ======================================================
      // MESSAGE
      // ======================================================

      let message;

      if (
        attendanceStatus.isAbsentDueToLate
      ) {
        message =
          `Attendance approved, but employee is marked ABSENT ` +
          `because check-in was after ${settings.absentCutoffTime}. ` +
          `(Checked in at ${formatISTTime(
            checkInTime
          )})`;
      } else if (
        attendanceStatus.isLate
      ) {
        message =
          `Attendance approved by ${approver.role}. ` +
          `Employee checked in as LATE. ` +
          `(Checked in at ${formatISTTime(
            checkInTime
          )})`;
      } else {
        message =
          `Attendance approved by ${approver.role}. ` +
          `Employee checked in successfully. ` +
          `(Checked in at ${formatISTTime(
            checkInTime
          )})`;
      }

      return res.status(200).json({
        success: true,

        message,

        settings: {
          officeStartTime:
            settings.officeStartTime,

          lateCutoffTime:
            settings.lateCutoffTime,

          absentCutoffTime:
            settings.absentCutoffTime,

          officeEndTime:
            settings.officeEndTime,

          presentHours:
            settings.presentHours,

          halfDayHours:
            settings.halfDayHours,

          breakLimit:
            settings.breakLimit,
        },

        // TIMER STARTS FROM ACTUAL CHECK-IN
        timerStartTime:
          attendance.approvedCheckInTime,

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "ApproveAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// CHECK OUT
// ============================================================

exports.checkOut =
  async (req, res) => {
    try {
      const { userId } =
        req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "userId is required",
        });
      }

      const attendance =
        await Attendance.findOne({
          userId,
          date: getToday(),
        });

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance not found",
        });
      }

      // ======================================================
      // APPROVAL REQUIRED
      // ======================================================

      if (
        attendance.approvalStatus !==
        "approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Your check-in request is not approved yet. Please wait for admin approval.",
        });
      }

      if (attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message:
            "Already checked out",
        });
      }

      // ======================================================
      // CHECK ACTIVE BREAK
      // ======================================================

      const activeBreak =
        attendance.breaks?.find(
          (item) => !item.endTime
        );

      if (activeBreak) {
        return res.status(400).json({
          success: false,
          message:
            "Please end your active break before checking out.",
        });
      }

      // ======================================================
      // ACTUAL CHECK-IN
      // ======================================================

      const checkInTime =
        attendance.approvedCheckInTime ||
        attendance.checkInTime;

      if (!checkInTime) {
        return res.status(400).json({
          success: false,
          message:
            "Check-in time not found.",
        });
      }

      // ======================================================
      // SETTINGS
      //
      // ALWAYS USE SETTINGS STORED IN ATTENDANCE
      // ======================================================

      const settings =
        getAttendanceSettings({
          officeStartTime:
            attendance.officeStartTime,

          lateCutoffTime:
            attendance.lateCutoffTime,

          absentCutoffTime:
            attendance.absentCutoffTime,

          officeEndTime:
            attendance.officeEndTime,

          presentHours:
            attendance.presentHours,

          halfDayHours:
            attendance.halfDayHours,

          breakLimit:
            attendance.breakLimit,
        });

      // ======================================================
      // CHECKOUT
      // ======================================================

      const checkoutTime =
        getISTNow();

      attendance.checkOutTime =
        checkoutTime;

      // ======================================================
      // WORKING HOURS
      // ======================================================

      const totalHours =
        getWorkingHours(
          checkInTime,
          checkoutTime,
          attendance.totalBreakTime
        );

      attendance.totalWorkTime =
        Number(
          totalHours.toFixed(2)
        );

      // ======================================================
      // RECALCULATE LATE / ABSENT
      // USING ACTUAL CHECK-IN
      // ======================================================

      const attendanceStatus =
        calculateAttendanceStatus(
          checkInTime,
          settings
        );

      attendance.isLate =
        attendanceStatus.isLate;

      // ======================================================
      // STATUS
      // ======================================================

      if (
        attendanceStatus.isAbsentDueToLate
      ) {
        attendance.status =
          "absent";
      } else if (
        attendanceStatus.status === "half-day" ||
        attendance.totalWorkTime <
          settings.presentHours
      ) {
        attendance.status =
          "half-day";
      } else {
        attendance.status =
          "present";
      }

      await attendance.save();

      return res.status(200).json({
        success: true,

        message:
          "Check-Out Successful",

        totalWorkTime:
          attendance.totalWorkTime,

        totalBreakTime:
          attendance.totalBreakTime,

        timerStartTime:
          attendance.approvedCheckInTime ||
          attendance.checkInTime,

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "CheckOut Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// BREAK START
// ============================================================

exports.startBreak =
  async (req, res) => {
    try {
      const { userId } =
        req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "userId is required",
        });
      }

      const attendance =
        await Attendance.findOne({
          userId,
          date: getToday(),
        });

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Please check in first",
        });
      }

      if (
        attendance.approvalStatus !==
        "approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Your check-in request is not approved yet. Please wait for admin approval.",
        });
      }

      if (attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message:
            "Already checked out",
        });
      }

      if (!attendance.checkInTime) {
        return res.status(400).json({
          success: false,
          message:
            "Please check in first",
        });
      }

      const activeBreak =
        attendance.breaks.find(
          (item) => !item.endTime
        );

      if (activeBreak) {
        return res.status(400).json({
          success: false,
          message:
            "Break already started",
        });
      }

      attendance.breaks.push({
        startTime:
          getISTNow(),
      });

      await attendance.save();

      return res.status(200).json({
        success: true,

        message:
          "Break started successfully",

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "StartBreak Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// BREAK END
// ============================================================

exports.endBreak =
  async (req, res) => {
    try {
      const { userId } =
        req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "userId is required",
        });
      }

      const attendance =
        await Attendance.findOne({
          userId,
          date: getToday(),
        });

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance not found. Please check in first.",
        });
      }

      if (
        attendance.approvalStatus !==
        "approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Your check-in request is not approved yet. Please wait for admin approval.",
        });
      }

      if (!attendance.checkInTime) {
        return res.status(400).json({
          success: false,
          message:
            "Please check in first.",
        });
      }

      if (attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message:
            "Already checked out.",
        });
      }

      const activeBreak =
        attendance.breaks.find(
          (item) => !item.endTime
        );

      if (!activeBreak) {
        return res.status(400).json({
          success: false,
          message:
            "No active break found.",
        });
      }

      const endTime =
        getISTNow();

      activeBreak.endTime =
        endTime;

      const duration =
        (
          endTime.getTime() -
          new Date(
            activeBreak.startTime
          ).getTime()
        ) /
        (1000 * 60);

      const safeDuration =
        Math.max(
          0,
          duration
        );

      activeBreak.duration =
        Number(
          safeDuration.toFixed(2)
        );

      attendance.totalBreakTime =
        Number(
          (
            Number(
              attendance.totalBreakTime ||
                0
            ) + safeDuration
          ).toFixed(2)
        );

      await attendance.save();

      return res.status(200).json({
        success: true,

        message:
          "Break ended successfully",

        totalBreakTime:
          attendance.totalBreakTime,

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "EndBreak Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// REJECT ATTENDANCE
// ============================================================

exports.rejectAttendance =
  async (req, res) => {
    try {
      const {
        attendanceId,
        reason,
      } = req.body;

      if (!attendanceId) {
        return res.status(400).json({
          success: false,
          message:
            "attendanceId is required",
        });
      }

      if (
        !reason ||
        !reason.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rejection reason is required",
        });
      }

      const attendance =
        await Attendance.findById(
          attendanceId
        );

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance not found",
        });
      }

      if (
        attendance.approvalStatus ===
        "approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Attendance already approved, cannot reject",
        });
      }

      attendance.approvalStatus =
        "rejected";

      attendance.rejectionReason =
        reason.trim();

      await attendance.save();

      return res.json({
        success: true,

        message:
          "Attendance Rejected",

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "RejectAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ALL ATTENDANCE FOR ADMIN
// ============================================================

exports.getAllAttendanceForAdmin =
  async (req, res) => {
    try {
      const requestedDate =
        req.query.date;

      const date =
        requestedDate ||
        getToday();

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          date
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "date must be in YYYY-MM-DD format",
        });
      }

      const attendanceRecords =
        await getDateWiseAttendance(
          date
        );

      const attendance =
        attendanceRecords.map(
          (record) => {
            const user =
              record.employee;

            return {
              ...record,

              user: user
                ? {
                    _id: user._id,
                    name: user.name,
                    uniqueID:
                      user.uniqueID,
                    role: user.role,
                    department:
                      user.department,
                    email: user.email,
                  }
                : null,

              employee: user
                ? {
                    _id: user._id,
                    name: user.name,
                    uniqueID:
                      user.uniqueID,
                    role: user.role,
                    department:
                      user.department,
                    email: user.email,
                  }
                : null,

              employeeName:
                user?.name ||
                "Unknown Employee",

              email:
                user?.email || "",
            };
          }
        );

      const present =
        attendance.filter(
          (item) =>
            String(
              item.status || ""
            ).toLowerCase() ===
            "present"
        ).length;

      const late =
        attendance.filter(
          (item) =>
            item.isLate === true &&
            String(
              item.status || ""
            ).toLowerCase() !==
              "absent"
        ).length;

      const halfDay =
        attendance.filter(
          (item) => {
            const status =
              String(
                item.status || ""
              )
                .toLowerCase()
                .trim();

            return (
              status ===
                "half-day" ||
              status ===
                "halfday" ||
              status ===
                "half day"
            );
          }
        ).length;

      const absent =
        attendance.filter(
          (item) =>
            String(
              item.status || ""
            ).toLowerCase() ===
            "absent"
        ).length;

      const notCheckedIn =
        attendance.filter(
          (item) =>
            String(
              item.approvalStatus ||
                ""
            )
              .toLowerCase()
              .trim() ===
            "not_checked_in"
        ).length;

      const pending =
        attendance.filter(
          (item) =>
            String(
              item.approvalStatus ||
                ""
            )
              .toLowerCase()
              .trim() ===
            "pending"
        ).length;

      const approved =
        attendance.filter(
          (item) =>
            String(
              item.approvalStatus ||
                ""
            )
              .toLowerCase()
              .trim() ===
            "approved"
        ).length;

      const roleWise = {
        employee: 0,
        intern: 0,
        teamlead: 0,
        other: 0,
      };

      attendance.forEach(
        (item) => {
          const role =
            String(
              item?.user?.role ||
                item?.employee?.role ||
                item?.userType ||
                ""
            )
              .toLowerCase()
              .trim();

          if (
            role === "employee"
          ) {
            roleWise.employee++;
          } else if (
            role === "intern"
          ) {
            roleWise.intern++;
          } else if (
            role === "teamlead" ||
            role ===
              "team lead" ||
            role ===
              "team_lead"
          ) {
            roleWise.teamlead++;
          } else {
            roleWise.other++;
          }
        }
      );

      return res.status(200).json({
        success: true,

        date,

        count:
          attendance.length,

        summary: {
          total:
            attendance.length,

          present,
          late,
          halfDay,
          absent,

          pending,
          approved,
          notCheckedIn,

          roleWise,
        },

        attendance,
      });
    } catch (err) {
      console.error(
        "GetAllAttendanceForAdmin Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ATTENDANCE BY ID
// ============================================================

exports.getAttendanceById =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const attendance =
        await Attendance.findById(
          id
        )
          .populate(
            "userId",
            "name email phoneNumber uniqueID department role"
          )
          .populate(
            "approvedBy",
            "name email role uniqueID"
          );

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance not found",
        });
      }

      return res.status(200).json({
        success: true,

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "GetAttendanceById Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET PENDING ATTENDANCE
// ============================================================

exports.getPendingAttendance =
  async (req, res) => {
    try {
      const data =
        await Attendance.find({
          approvalStatus:
            "pending",
        }).populate(
          "userId",
          "name uniqueID role"
        );

      return res.json({
        success: true,

        count:
          data.length,

        data: data.map(
          formatAttendanceDocument
        ),
      });
    } catch (err) {
      console.error(
        "GetPendingAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET MY ATTENDANCE HISTORY
// ============================================================

exports.getMyAttendanceHistory =
  async (req, res) => {
    try {
      const { userId } =
        req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "userId is required",
        });
      }

      const attendance =
        await Attendance.find({
          userId,
        })
          .populate(
            "userId",
            "name email uniqueID role department"
          )
          .sort({
            date: -1,
          });

      return res.status(200).json({
        success: true,

        count:
          attendance.length,

        data: attendance.map(
          formatAttendanceDocument
        ),
      });
    } catch (err) {
      console.error(
        "GetMyAttendanceHistory Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ATTENDANCE BY DATE
// ============================================================

exports.getAttendanceByDate =
  async (req, res) => {
    try {
      const { date } =
        req.params;

      if (!date) {
        return res.status(400).json({
          success: false,
          message:
            "date is required (YYYY-MM-DD)",
        });
      }

      const attendance =
        await Attendance.find({
          date,
        }).populate(
          "userId",
          "name uniqueID role department"
        );

      return res.status(200).json({
        success: true,

        count:
          attendance.length,

        data: attendance.map(
          formatAttendanceDocument
        ),
      });
    } catch (err) {
      console.error(
        "GetAttendanceByDate Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET SINGLE ATTENDANCE
// ============================================================

exports.getSingleAttendance =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const attendance =
        await Attendance.findById(
          id
        ).populate(
          "userId",
          "name email uniqueID role department"
        );

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance not found",
        });
      }

      return res.status(200).json({
        success: true,

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "GetSingleAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET MONTHLY ATTENDANCE
// ============================================================

exports.getMonthlyAttendance =
  async (req, res) => {
    try {
      const {
        userId,
        month,
      } = req.params;

      if (
        !userId ||
        !month
      ) {
        return res.status(400).json({
          success: false,
          message:
            "userId and month are required (YYYY-MM)",
        });
      }

      const attendance =
        await Attendance.find({
          userId,

          date: {
            $regex: `^${month}`,
          },
        }).sort({
          date: -1,
        });

      return res.status(200).json({
        success: true,

        count:
          attendance.length,

        data: attendance.map(
          formatAttendanceDocument
        ),
      });
    } catch (err) {
      console.error(
        "GetMonthlyAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// ATTENDANCE STATS
// ============================================================

exports.getAttendanceStats =
  async (req, res) => {
    try {
      const today =
        getToday();

      const stats =
        await Attendance.aggregate([
          {
            $match: {
              date: today,
            },
          },

          {
            $group: {
              _id:
                "$approvalStatus",

              count: {
                $sum: 1,
              },
            },
          },
        ]);

      const result = {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      };

      stats.forEach(
        (item) => {
          if (
            result[
              item._id
            ] !== undefined
          ) {
            result[item._id] =
              item.count;
          }

          result.total +=
            item.count;
        }
      );

      const presentCount =
        await Attendance.countDocuments(
          {
            date: today,
            approvalStatus:
              "approved",
            status:
              "present",
          }
        );

      const absentCount =
        await Attendance.countDocuments(
          {
            date: today,
            approvalStatus:
              "approved",
            status:
              "absent",
          }
        );

      const halfDayCount =
        await Attendance.countDocuments(
          {
            date: today,
            approvalStatus:
              "approved",
            status:
              "half-day",
          }
        );

      return res.status(200).json({
        success: true,

        data: {
          ...result,

          present:
            presentCount,

          absent:
            absentCount,

          halfDay:
            halfDayCount,
        },
      });
    } catch (err) {
      console.error(
        "GetAttendanceStats Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ABSENT ATTENDANCE
// ============================================================

exports.getAbsentAttendance =
  async (req, res) => {
    try {
      const {
        date,
      } = req.params;

      const query = {
        date:
          date || getToday(),

        $or: [
          {
            approvalStatus:
              "approved",
            status:
              "absent",
          },

          {
            approvalStatus:
              "pending",
            status:
              "absent",
          },
        ],
      };

      const absentRecords =
        await Attendance.find(
          query
        )
          .populate({
            path: "userId",
            select:
              "name uniqueID role email department phoneNumber",
          })
          .populate({
            path: "approvedBy",
            select:
              "name uniqueID role",
          })
          .sort({
            createdAt: -1,
          });

      const formatted =
        absentRecords.map(
          (item) => {
            const data =
              formatAttendanceDocument(
                item
              );

            return {
              _id: data._id,

              employee: {
                _id:
                  data.userId?._id,

                name:
                  data.userId?.name ||
                  "",

                uniqueID:
                  data.userId
                    ?.uniqueID ||
                  "",

                email:
                  data.userId?.email ||
                  "",

                department:
                  data.userId
                    ?.department ||
                  "",

                phoneNumber:
                  data.userId
                    ?.phoneNumber ||
                  "",

                role:
                  data.userId?.role ||
                  data.userType,
              },

              date:
                data.date,

              dateDisplay:
                data.dateDisplay,

              checkInTime:
                data.checkInTime,

              checkInTimeDisplay:
                data.checkInTimeDisplay,

              checkInTimeFullDisplay:
                data.checkInTimeFullDisplay,

              approvedCheckInTime:
                data.approvedCheckInTime,

              approvedCheckInTimeDisplay:
                data.approvedCheckInTimeDisplay,

              approvedCheckInTimeFullDisplay:
                data.approvedCheckInTimeFullDisplay,

              checkOutTime:
                data.checkOutTime,

              checkOutTimeDisplay:
                data.checkOutTimeDisplay,

              checkOutTimeFullDisplay:
                data.checkOutTimeFullDisplay,

              breaks:
                data.breaks,

              totalBreakTime:
                data.totalBreakTime,

              totalBreakTimeDisplay:
                data.totalBreakTimeDisplay,

              totalWorkTime:
                data.totalWorkTime,

              totalWorkTimeDisplay:
                data.totalWorkTimeDisplay,

              isLate:
                data.isLate,

              status:
                data.status,

              approvalStatus:
                data.approvalStatus,

              approvedAt:
                data.approvedAt,

              approvedAtDisplay:
                data.approvedAtDisplay,

              approvedAtFullDisplay:
                data.approvedAtFullDisplay,

              approvedBy:
                data.approvedBy
                  ? {
                      _id:
                        data.approvedBy
                          ._id,

                      name:
                        data.approvedBy
                          .name,

                      uniqueID:
                        data.approvedBy
                          .uniqueID,

                      role:
                        data.approvedBy
                          .role,
                    }
                  : null,

              createdAt:
                data.createdAt,

              createdAtDisplay:
                data.createdAtDisplay,

              updatedAt:
                data.updatedAt,

              updatedAtDisplay:
                data.updatedAtDisplay,

              lateCutoffTime:
                data.lateCutoffTime,

              absentCutoffTime:
                data.absentCutoffTime,
            };
          }
        );

      const roleWise = {
        employee: 0,
        intern: 0,
        teamlead: 0,
        other: 0,
      };

      formatted.forEach(
        (record) => {
          const role =
            record.employee?.role
              ?.toLowerCase()
              .trim() ||
            "other";

          if (
            role === "employee"
          ) {
            roleWise.employee++;
          } else if (
            role === "intern"
          ) {
            roleWise.intern++;
          } else if (
            role === "teamlead" ||
            role ===
              "team lead" ||
            role ===
              "team_lead"
          ) {
            roleWise.teamlead++;
          } else {
            roleWise.other++;
          }
        }
      );

      return res.status(200).json({
        success: true,

        message:
          `Absent attendance records for ${query.date}`,

        summary: {
          total:
            formatted.length,

          pending:
            absentRecords.filter(
              (record) =>
                record.approvalStatus ===
                "pending"
            ).length,

          approved:
            absentRecords.filter(
              (record) =>
                record.approvalStatus ===
                "approved"
            ).length,

          date:
            query.date,

          roleWise,
        },

        data: formatted,
      });
    } catch (err) {
      console.error(
        "GetAbsentAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ABSENT ATTENDANCE BY DATE RANGE
// ============================================================

exports.getAbsentAttendanceByDateRange =
  async (req, res) => {
    try {
      const {
        startDate,
        endDate,
      } = req.query;

      if (
        !startDate ||
        !endDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "startDate and endDate are required (YYYY-MM-DD)",
        });
      }

      const query = {
        date: {
          $gte: startDate,
          $lte: endDate,
        },

        $or: [
          {
            approvalStatus:
              "approved",
            status:
              "absent",
          },

          {
            approvalStatus:
              "pending",
            status:
              "absent",
          },
        ],
      };

      const absentRecords =
        await Attendance.find(
          query
        )
          .populate({
            path: "userId",
            select:
              "name uniqueID role email department phoneNumber",
          })
          .populate({
            path: "approvedBy",
            select:
              "name uniqueID role",
          })
          .sort({
            date: -1,
            createdAt: -1,
          });

      const formatted =
        absentRecords.map(
          (item) => {
            const data =
              formatAttendanceDocument(
                item
              );

            return {
              _id: data._id,

              employee: {
                _id:
                  data.userId?._id,

                name:
                  data.userId?.name ||
                  "",

                uniqueID:
                  data.userId
                    ?.uniqueID ||
                  "",

                email:
                  data.userId?.email ||
                  "",

                department:
                  data.userId
                    ?.department ||
                  "",

                phoneNumber:
                  data.userId
                    ?.phoneNumber ||
                  "",

                role:
                  data.userId?.role ||
                  data.userType,
              },

              date:
                data.date,

              dateDisplay:
                data.dateDisplay,

              checkInTime:
                data.checkInTime,

              checkInTimeDisplay:
                data.checkInTimeDisplay,

              checkInTimeFullDisplay:
                data.checkInTimeFullDisplay,

              approvedCheckInTime:
                data.approvedCheckInTime,

              approvedCheckInTimeDisplay:
                data.approvedCheckInTimeDisplay,

              approvedCheckInTimeFullDisplay:
                data.approvedCheckInTimeFullDisplay,

              checkOutTime:
                data.checkOutTime,

              checkOutTimeDisplay:
                data.checkOutTimeDisplay,

              checkOutTimeFullDisplay:
                data.checkOutTimeFullDisplay,

              breaks:
                data.breaks,

              totalBreakTime:
                data.totalBreakTime,

              totalBreakTimeDisplay:
                data.totalBreakTimeDisplay,

              totalWorkTime:
                data.totalWorkTime,

              totalWorkTimeDisplay:
                data.totalWorkTimeDisplay,

              isLate:
                data.isLate,

              status:
                data.status,

              approvalStatus:
                data.approvalStatus,

              approvedAt:
                data.approvedAt,

              approvedAtDisplay:
                data.approvedAtDisplay,

              approvedAtFullDisplay:
                data.approvedAtFullDisplay,

              approvedBy:
                data.approvedBy
                  ? {
                      _id:
                        data.approvedBy
                          ._id,

                      name:
                        data.approvedBy
                          .name,

                      uniqueID:
                        data.approvedBy
                          .uniqueID,

                      role:
                        data.approvedBy
                          .role,
                    }
                  : null,

              createdAt:
                data.createdAt,

              createdAtDisplay:
                data.createdAtDisplay,

              updatedAt:
                data.updatedAt,

              updatedAtDisplay:
                data.updatedAtDisplay,
            };
          }
        );

      const dailyBreakdown =
        {};

      formatted.forEach(
        (record) => {
          const recordDate =
            record.date;

          if (
            !dailyBreakdown[
              recordDate
            ]
          ) {
            dailyBreakdown[
              recordDate
            ] = {
              date:
                recordDate,

              count: 0,

              pending: 0,

              approved: 0,

              employees: [],
            };
          }

          dailyBreakdown[
            recordDate
          ].count++;

          if (
            record.approvalStatus ===
            "pending"
          ) {
            dailyBreakdown[
              recordDate
            ].pending++;
          } else if (
            record.approvalStatus ===
            "approved"
          ) {
            dailyBreakdown[
              recordDate
            ].approved++;
          }

          dailyBreakdown[
            recordDate
          ].employees.push({
            _id:
              record.employee._id,

            name:
              record.employee.name,

            uniqueID:
              record.employee.uniqueID,

            role:
              record.employee.role,
          });
        }
      );

      return res.status(200).json({
        success: true,

        message:
          `Absent attendance records from ${startDate} to ${endDate}`,

        summary: {
          total:
            formatted.length,

          startDate,
          endDate,

          dateRange:
            `${startDate} to ${endDate}`,
        },

        dailyBreakdown:
          Object.values(
            dailyBreakdown
          ),

        data: formatted,
      });
    } catch (err) {
      console.error(
        "GetAbsentAttendanceByDateRange Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ALL ABSENT ATTENDANCE
// ============================================================

exports.getAllAbsentAttendance =
  async (req, res) => {
    try {
      const date =
        req.query.date ||
        getToday();

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          date
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "date must be in YYYY-MM-DD format",
        });
      }

      const attendance =
        await getDateWiseAttendance(
          date
        );

      const absentRecords =
        attendance.filter(
          (item) =>
            item.status ===
            "absent"
        );

      const roleWise = {
        employee: 0,
        intern: 0,
        teamlead: 0,
        other: 0,
      };

      absentRecords.forEach(
        (record) => {
          const role =
            record.employee?.role
              ?.toLowerCase()
              ?.trim() ||
            "other";

          if (
            role === "employee"
          ) {
            roleWise.employee++;
          } else if (
            role === "intern"
          ) {
            roleWise.intern++;
          } else if (
            role === "teamlead" ||
            role ===
              "team lead" ||
            role ===
              "team_lead"
          ) {
            roleWise.teamlead++;
          } else {
            roleWise.other++;
          }
        }
      );

      const notCheckedIn =
        absentRecords.filter(
          (item) =>
            item.approvalStatus ===
            "not_checked_in"
        ).length;

      const checkedInAbsent =
        absentRecords.filter(
          (item) =>
            item.approvalStatus !==
            "not_checked_in"
        ).length;

      return res.status(200).json({
        success: true,

        message:
          `Absent attendance records for ${date}`,

        summary: {
          date,

          total:
            absentRecords.length,

          notCheckedIn,

          checkedInAbsent,

          roleWise,
        },

        data: absentRecords,
      });
    } catch (err) {
      console.error(
        "GetAllAbsentAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

exports.recalculateAllAttendance = async (req, res) => {
  try {
    const settings = getAttendanceSettings(req.user || {});
    const records = await Attendance.find({});
    let updatedCount = 0;

    for (const record of records) {
      let newStatus = record.status;
      let newIsLate = record.isLate;

      if (!record.checkInTime) {
        newStatus = "absent";
        newIsLate = false;
      } else {
        const attStatus = determineAttendanceStatus(record.checkInTime, settings);
        newIsLate = attStatus.isLate;

        if (attStatus.isAbsentDueToLate) {
          newStatus = "absent";
        } else if (
          attStatus.status === "half-day" ||
          (record.totalWorkTime || 0) < settings.presentHours
        ) {
          newStatus = "half-day";
        } else {
          newStatus = "present";
        }
      }

      if (record.status !== newStatus || record.isLate !== newIsLate) {
        record.status = newStatus;
        record.isLate = newIsLate;
        await record.save();
        updatedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully recalculated attendance. Updated ${updatedCount} out of ${records.length} records.`,
      updatedCount,
      totalRecords: records.length,
    });
  } catch (error) {
    console.error("RecalculateAllAttendance Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};