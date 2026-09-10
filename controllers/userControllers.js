// const User =
//   require("../models/User"); 
//   const Employee =
//   require("../models/Employee");

// const bcrypt =
//   require("bcryptjs"); 

// const jwt =
//   require("jsonwebtoken"); 

// const nodemailer =
//   require("nodemailer"); 

//   const axios = require("axios");

// const { syncEmployeeToUser } = require("../utils/userEmployeeSync");
 
// // ================= EMAIL CONFIG =================
// const transporter =
//   nodemailer.createTransport(
//     {
//       service: 
//         "gmail",

//       auth: {
//         user:
//           process.env
//             .EMAIL_USER,

//         pass:
//           process.env
//             .EMAIL_PASS,
//       },
//     }
//   );

// // ================= JWT TOKEN =================
// const generateToken =
//   (userId) => {
//     return jwt.sign(
//       {
//         id: userId,
//       },
//       process.env
//         .JWT_SECRET,
//       {
//         expiresIn:
//           "7d",
//       }
//     );
//   };

// // ================= GENERATE OTP =================
// const generateOTP =
//   () =>
//     Math.floor(
//       100000 +
//         Math.random() *
//           900000 
//     ).toString();

//     const createDefaultAdmin =
//   async () => {
//     try {
//       const adminExists =
//         await User.findOne({
//           role: "admin",
//         });

//       if (adminExists) {
//         return;
//       }

//       const admin =
//         new User({
//           name: "admin",

//           email:
//             "admin@gmail.com", 

//           phoneNumber:
//             "9999999999",

//           dob:
//             "01-01-2000",

//           address:
//             "Ahmedabad",

//           department:
//             "Administration",

//           bloodGroup:
//             "O+",

//           uniqueID:
//             "ADMIN001",

//           password:
//             "admin123",

//           plainPassword:
//             "admin123",

//           role:
//             "admin",

//           isApproved:
//             true,

//           isFirstLogin:
//             false,

//           isActive:
//             true,
//         });

//       await admin.save();

   
//     } catch (error) {
//       console.log(
//         "❌ Admin Create Error:",
//         error.message
//       );
//     }
//   };

// // run admin creation
// createDefaultAdmin();

// const createDefaultHR =
//   async () => {
//     try {
//       const hrExists =
//         await User.findOne({
//           role: "hr",
//         });

//       if (hrExists) {
//         return;
//       }

//       const hr =
//         new User({
//           name: "hr",

//           email:
//             "hr@gmail.com",

//           phoneNumber:
//             "8888888888",

//           dob:
//             "01-01-2000",

//           address:
//             "Ahmedabad",

//           department:
//             "HR",

//           bloodGroup:
//             "O+",

//           uniqueID:
//             "HR001",

//           password:
//             "hr123",

//           plainPassword:
//             "hr123",

//           role:
//             "hr",

//           isApproved:
//             true,

//           isFirstLogin:
//             false,

//           isActive:
//             true,
//         });

//       await hr.save();

//       console.log(
//         "✅ Default HR Created"
//       );
//     } catch (error) {
//       console.log(
//         "❌ HR Create Error:",
//         error.message
//       );
//     }
//   };
//   createDefaultHR();

//   exports.updateProfile = async (req, res) => {
//   try {
//     const {
//       name,
//       email,
//       phoneNumber,
//       dob,
//       address,
//       department,
//       bloodGroup,
//     } = req.body;

//     const user = await User.findById(req.user._id);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Email duplicate check
//     if (email && email !== user.email) {
//       const existingEmail = await User.findOne({
//         email,
//         _id: { $ne: user._id },
//       });

//       if (existingEmail) {
//         return res.status(400).json({
//           success: false,
//           message: "Email already exists",
//         });
//       }
//     }

//     // Phone duplicate check
//     if (
//       phoneNumber &&
//       phoneNumber !== user.phoneNumber
//     ) {
//       const existingPhone = await User.findOne({
//         phoneNumber,
//         _id: { $ne: user._id },
//       });

//       if (existingPhone) {
//         return res.status(400).json({
//           success: false,
//           message: "Phone number already exists",
//         });
//       }
//     }

//     // Update fields
//     user.name = name || user.name;
//     user.email = email || user.email;
//     user.phoneNumber =
//       phoneNumber || user.phoneNumber;
//     user.dob = dob || user.dob;
//     user.address = address || user.address;
//     user.department =
//       department || user.department;
//     user.bloodGroup =
//       bloodGroup || user.bloodGroup;

//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: "Profile updated successfully",
//       profile: {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         phoneNumber: user.phoneNumber,
//         dob: user.dob,
//         address: user.address,
//         department: user.department,
//         bloodGroup: user.bloodGroup,
//         uniqueID: user.uniqueID,
//         role: user.role,
//       },
//     });
//   } catch (error) {
//     console.log("Update Profile Error:", error);

//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

//   exports.getMyProfile = async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id).select(
//       "-password -plainPassword -refreshToken -forgotPasswordOTP -otpExpireTime"
//     );

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       profile: {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         phoneNumber: user.phoneNumber,
//         dob: user.dob,
//         address: user.address,
//         department: user.department,
//         bloodGroup: user.bloodGroup,
//         uniqueID: user.uniqueID,
//         role: user.role,
//         isApproved: user.isApproved,
//         isFirstLogin: user.isFirstLogin,
//         lastLogin: user.lastLogin,
//         isActive: user.isActive,
//       },
//     });
//   } catch (error) {
//     console.log("Profile Error:", error);

//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // ================= REGISTER USER =================
// exports.registerUser =
//   async (req, res) => {
//     try {
//       const { 
//         name,
//         email,
//         phoneNumber,
//         dob,
//         address, 
//         department,
//         bloodGroup,
//         role
//       } = req.body;

//       // ================= VALIDATION =================
//       if (
//         !name ||
//         !email ||
//         !phoneNumber ||
//         !dob ||
//         !address ||
//         !department ||
//         !bloodGroup ||
//         !role
//       ) {
//         return res
//           .status(400)
//           .json({
//             success:
//               false,
//             message:
//               "All fields are required",
//           });
//       }

//       // ================= CHECK EXISTING USER =================
//       const existingUser =
//         await User.findOne({
//           $or: [
//             { email },
//             {
//               phoneNumber,
//             },
//           ],
//         });

//       if (
//         existingUser
//       ) {
//         return res
//           .status(400)
//           .json({
//             success:
//               false,
//             message:
//               "User already exists",
//           });
//       }

//       // ================= GENERATE UNIQUE ID =================
//  // ================= GENERATE UNIQUE ID =================
// const lastUser =
//   await User.findOne({
//     uniqueID: {
//       $regex: /^NEW\d+$/,
//     },
//   })
//     .sort({
//       createdAt: -1,
//     });

// let nextNumber = 1001;

// if (
//   lastUser &&
//   lastUser.uniqueID
// ) {
//   const lastNumber =
//     parseInt(
//       lastUser.uniqueID.replace(
//         "NEW",
//         ""
//       )
//     );

//   nextNumber =
//     isNaN(lastNumber)
//       ? 1001
//       : lastNumber + 1;
// }

// const uniqueID =
//   `NEW${nextNumber}`;

//       // ================= GENERATE PASSWORD =================
//       const generatedPassword =
//         Math.random()
//           .toString(36)
//           .slice(-8);

//       // ================= SAVE USER =================
//       const user =
//         await User.create(
//           {
//             name,
//             email,
//             phoneNumber, 
//             dob,
//             address,
//             department,
//             bloodGroup,
//             uniqueID,

//             password:
//               generatedPassword,

//             plainPassword:
//               generatedPassword,

//               role,

//             isApproved:
//               false,

//             isFirstLogin:
//               true,
//           }
//         );
//         // ================= CREATE EMPLOYEE =================
// if (role === "employee" || role === "team lead") {
//   // Generate Employee ID
//   const lastEmployee = await Employee.findOne().sort({
//     createdAt: -1,
//   });

//   let nextEmployeeNumber = 1001;

//   if (lastEmployee && lastEmployee.employeeID) {
//     const lastNumber = parseInt(
//       lastEmployee.employeeID.replace("EMP", "")
//     );

//     nextEmployeeNumber = isNaN(lastNumber)
//       ? 1001
//       : lastNumber + 1;
//   }

//   const employeeID = `EMP${nextEmployeeNumber}`;

//   const employee = await Employee.create({
//     employeeID,
//     userID: user._id,

//     firstName: name,
//     lastName: "",

//     email,
//     mobile: phoneNumber,

//     dob,
//     bloodGroup,

//     currentAddress: address,
//     permanentAddress: address,

//     designation: role === "team lead" ? "Team Lead" : "Employee",

//     department,

//     joiningDate: new Date(),

//     employeeStatus: "Active",
//     isTeamLead: role === "team lead",
//   });

//   await syncEmployeeToUser({
//     employee,
//     role,
//     userData: {
//       name,
//       email,
//       phoneNumber,
//       dob,
//       address,
//       department,
//       bloodGroup,
//       role,
//       isApproved: false,
//       isFirstLogin: true,
//     },
//   });
// }

//       // ================= SEND EMAIL =================
//       try {
//         await transporter.sendMail(
//           {
//             from:
//               process.env
//                 .EMAIL_USER,

//             to:
//               process.env
//                 .ADMIN_EMAIL,

//             subject:
//               "New Employee Registration",

//             html: `
//               <h2>
//                 New Employee Registration
//               </h2>

//               <p>
//                 <b>Name:</b>
//                 ${name}
//               </p>

//               <p>
//                 <b>Email:</b>
//                 ${email}
//               </p>

//               <p>
//                 <b>Phone:</b>
//                 ${phoneNumber}
//               </p>

//               <p>
//                 <b>Department:</b>
//                 ${department}
//               </p>

//               <hr />

//               <h3>
//                 Login Credentials
//               </h3>

//               <p>
//                 <b>Unique ID:</b>
//                 ${uniqueID}
//               </p>

//               <p>
//                 <b>Password:</b>
//                 ${generatedPassword}
//               </p>

//               <p>
//                 Please approve
//                 employee from
//                 admin panel.
//               </p>
//             `,
//           }
//         );

//         console.log(
//           "✅ Email sent successfully"
//         );
//       } catch (
//         emailError
//       ) {
//         console.log(
//           "❌ Email Error:",
//           emailError.message
//         );
//       }

//       // ================= RESPONSE =================
//       res
//         .status(201)
//         .json({
//           success:
//             true,

//           message:
//             "Registration successful. Waiting for admin approval.",

//           credentials:
//             {
//               uniqueID,
//               password:
//                 generatedPassword,
//             },

//           user: {
//             _id:
//               user._id,
//             name:
//               user.name,
//             email:
//               user.email,
//             uniqueID:
//               user.uniqueID,
//             role:
//               user.role,
//             isApproved:
//               user.isApproved,
//           },
//         });
//     } catch (
//       error
//     ) {
//       console.log(
//         "Register Error:",
//         error
//       );

//       res
//         .status(500)
//         .json({
//           success:
//             false,
//           message:
//             error.message,
//         });
//     }
//   };

// // ================= GET ALL USERS =================
// exports.getAllUsers =
//   async (req, res) => {
//     try {
//       const users =
//         await User.find()
//           .sort({
//             createdAt:
//               -1,
//           });

//       res.status(200).json({
//         success:
//           true,
//         totalUsers:
//           users.length,
//         users,
//       });
//     } catch (
//       error
//     ) {
//       res
//         .status(500)
//         .json({
//           success:
//             false,  
//           message: 
//             error.message,
//         });
//     }
//   };

// // ================= APPROVE EMPLOYEE =================
// // ================= APPROVE EMPLOYEE =================
// exports.approveEmployee = async (req, res) => {
//   try {
//     const { userId } = req.body;

//     // ================= FIND USER =================
//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // ================= ALREADY APPROVED CHECK =================
//     if (user.isApproved) {
//       return res.status(400).json({
//         success: false,
//         message: "Employee is already approved",
//       });
//     }

//     // ================= CHECK EMAIL =================
//     if (!user.email) {
//       return res.status(400).json({
//         success: false,
//         message: "Employee email not found",
//       });
//     }

//     // ================= CHECK PASSWORD =================
//     if (!user.plainPassword) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Employee password not available. Please reset/generate password first.",
//       });
//     }

//     // ================= SEND APPROVAL EMAIL =================
//     await axios.post(
//       "https://api.emailjs.com/api/v1.0/email/send",
//       {
//         service_id: process.env.EMAILJS_SERVICE_ID,

//         template_id: process.env.EMAILJS_TEMPLATE_ID,

//         user_id: process.env.EMAILJS_PUBLIC_KEY,

//         template_params: {
//           name: user.name,
//           email: user.email,
//           password: user.plainPassword,
//           uniqueID: user.uniqueID,
//           role: user.role,
//         },
//       }
//     );

//     // ================= APPROVE USER =================
//     user.isApproved = true;

//     await user.save();

//     // ================= RESPONSE =================
//     return res.status(200).json({
//       success: true,
//       message:
//         "Employee approved successfully and login credentials sent to email.",
//       data: {
//         userId: user._id,
//         name: user.name,
//         email: user.email,
//         uniqueID: user.uniqueID,
//         role: user.role,
//       },
//     });
//   } catch (error) {
//     console.log("Approve Employee Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };
// // exports.approveEmployee =
// //   async (req, res) => {
// //     try {
// //       const {
// //         userId,
// //       } = req.body;

// //       const user =
// //         await User.findById(
// //           userId
// //         );

// //       if (!user) {
// //         return res
// //           .status(404)
// //           .json({
// //             success:
// //               false,
// //             message:
// //               "User not found",
// //           });
// //       }

// //       user.isApproved =
// //         true;

// //       await user.save();

// //       res.json({
// //         success:
// //           true,
// //         message:
// //           "Employee approved successfully",
// //       });
// //     } catch (
// //       error
// //     ) {
// //       res
// //         .status(500)
// //         .json({
// //           success:
// //             false,
// //           message:
// //             error.message,
// //         });
// //     }
// //   };

//   // ================= REJECT EMPLOYEE =================
// exports.rejectEmployee =
//   async (req, res) => {
//     try {
//       const { userId } = req.body;

//       const user =
//         await User.findById(userId);

//       if (!user) {
//         return res
//           .status(404)
//           .json({
//             success: false,
//             message: "User not found",
//           });
//       }

//       user.isApproved = false;

//       await user.save();

//       res.json({
//         success: true,
//         message: "Employee rejected successfully",
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   };

// // ================= LOGIN =================
// exports.loginUser =
//   async (req, res) => {
//     try {
//       const {
//         login,
//         password,
//         deviceId,
//       } = req.body;

//       // ================= VALIDATION =================
//       if (
//         !login ||
//         !password
//       ) {
//         return res
//           .status(400)
//           .json({
//             success:
//               false,

//             message:
//               "Login and password required",
//           });
//       }

//       // ================= FIND USER =================
//    const user =
//   await User.findOne({
//     $or: [
//       {
//         email:
//           login
//             .trim()
//             .toLowerCase(),
//       },

//       {
//         name:
//           login.trim(),
//       },

//       {
//         uniqueID:
//           login.trim(),
//       },
//     ],
//   });

//       // ================= USER NOT FOUND =================
//       if (!user) {
//         return res
//           .status(404)
//           .json({
//             success:
//               false,

//             message:
//               "User not found",
//           });
//       }

//       // ================= APPROVAL CHECK =================
//      if (
//   user.role !== "admin" &&
//   user.role !== "hr" &&
//   !user.isApproved
// ) {
//   return res
//     .status(403)
//     .json({
//       success:
//         false,

//       message:
//         "Admin approval pending",
//     });
// }

//       // ================= ONE DEVICE LOGIN =================
//       if (
//         user.deviceId &&
//         deviceId &&
//         user.deviceId !==
//           deviceId
//       ) {
//         return res
//           .status(401)
//           .json({
//             success:
//               false,

//             message:
//               "Already logged in another device",
//           });
//       }

//       // ================= PASSWORD MATCH =================
//       const isMatch =
//         await bcrypt.compare(
//           password.trim(),
//           user.password
//         );

//       if (!isMatch) {
//         return res
//           .status(400)
//           .json({
//             success:
//               false,

//             message:
//               "Invalid Password",
//           });
//       }

//       // ================= TOKEN =================
//       const token =
//         generateToken(
//           user._id
//         );

//       const refreshToken =
//         generateToken(
//           user._id
//         );

//       // ================= SAVE LOGIN =================
//       user.refreshToken =
//         refreshToken;

//       user.deviceId =
//         deviceId || null;

//       user.lastLogin = 
//         new Date();

//       await user.save();

//       // ================= RESPONSE =================
//       res.status(200).json({
//         success:
//           true,

//         message:
//           "Login successful",

//         token,
//         refreshToken,

//         changePassword:
//           user.isFirstLogin,

//         user: {
//           _id:
//             user._id,

//           name:
//             user.name,

//           email:
//             user.email,

//           role:
//             user.role,
//         },
//       });
//     } catch (
//       error
//     ) {
//       console.log(
//         "Login Error:",
//         error
//       );

//       res
//         .status(500)
//         .json({
//           success:
//             false,

//           message:
//             error.message,
//         });
//     }
//   };
//   // ================= CHANGE PASSWORD =================
// exports.changePassword =
//   async (req, res) => {
//     try {
//       const {
//         userId,
//         oldPassword,
//         newPassword,
//       } = req.body;

//       const user =
//         await User.findById(
//           userId
//         );

//       if (!user) {
//         return res
//           .status(404)
//           .json({
//             success:
//               false,
//             message:
//               "User not found",
//           });
//       }

//       const isMatch =
//         await bcrypt.compare(
//           oldPassword,
//           user.password
//         );

//       if (!isMatch) {
//         return res
//           .status(400)
//           .json({
//             success:
//               false,
//             message:
//               "Old password incorrect",
//           });
//       }

//       user.password =
//         newPassword;

//       user.isFirstLogin =
//         false;

//       await user.save();

//       res.json({
//         success:
//           true,
//         message:
//           "Password changed successfully",
//       });
//     } catch (
//       error
//     ) {
//       res
//         .status(500)
//         .json({
//           success:
//             false,
//           message:
//             error.message,
//         });
//     }
//   };

// // ================= SEND OTP =================
// exports.sendOTP =
//   async (req, res) => {
//     try {
//       const {
//         email,
//       } = req.body;

//       const user =
//         await User.findOne(
//           { email }
//         );

//       if (!user) {
//         return res
//           .status(404)
//           .json({
//             success:
//               false,
//             message:
//               "User not found",
//           });
//       }

//       const otp =
//         generateOTP();

//       user.forgotPasswordOTP =
//         otp;

//       user.otpExpireTime =
//         new Date(
//           Date.now() +
//             5 * 60 * 1000
//         );

//       await user.save();

//       await transporter.sendMail(
//         {
//           from:
//             process.env
//               .EMAIL_USER,

//           to:
//             email,

//           subject:
//             "OTP Verification",

//           html: `
//             <h2>
//               OTP Verification
//             </h2>

//             <p>
//               Your OTP is:
//             </p>

//             <h1>
//               ${otp}
//             </h1>

//             <p>
//               OTP valid for
//               5 minutes.
//             </p>
//           `,
//         }
//       );

//       res.json({
//         success:
//           true,
//         message:
//           "OTP sent successfully",
//       });
//     } catch (
//       error
//     ) {
//       res
//         .status(500)
//         .json({
//           success:
//             false,
//           message:
//             error.message,
//         });
//     }
//   };

// // ================= VERIFY OTP =================
// exports.verifyOTP =
//   async (req, res) => {
//     try {
//       const {
//         email,
//         otp,
//       } = req.body;

//       const user =
//         await User.findOne(
//           {
//             email,
//           }
//         );

//       if (!user) {
//         return res
//           .status(404)
//           .json({
//             success:
//               false,
//             message:
//               "User not found",
//           });
//       }

//       if (
//         user.forgotPasswordOTP !==
//         otp
//       ) {
//         return res
//           .status(400)
//           .json({
//             success:
//               false,
//             message:
//               "Invalid OTP",
//           });
//       }

//       if (
//         user.otpExpireTime <
//         new Date()
//       ) {
//         return res
//           .status(400)
//           .json({
//             success:
//               false,
//             message:
//               "OTP expired",
//           });
//       }

//       user.otpVerified =
//         true;

//       await user.save();

//       res.json({
//         success:
//           true,
//         message:
//           "OTP verified successfully",
//       });
//     } catch (
//       error
//     ) {
//       res
//         .status(500)
//         .json({
//           success:
//             false,
//           message:
//             error.message,
//         });
//     }
//   };

// // ================= FORGOT PASSWORD =================
// exports.forgotPassword =
//   async (req, res) => {
//     try {
//       const {
//         email,
//       } = req.body;

//       const user =
//         await User.findOne(
//           {
//             email,
//           }
//         );

//       if (!user) {
//         return res
//           .status(404)
//           .json({
//             success:
//               false,
//             message:
//               "User not found",
//           });
//       }

//       const otp =
//         generateOTP();

//       user.forgotPasswordOTP =
//         otp;

//       user.otpExpireTime =
//         new Date(
//           Date.now() +
//             5 * 60 * 1000
//         );

//       await user.save();

//       await transporter.sendMail(
//         {
//           from:
//             process.env
//               .EMAIL_USER,

//           to:
//             email,

//           subject:
//             "Forgot Password OTP",

//           html: `
//             <h2>
//               Reset Password OTP
//             </h2>

//             <h1>
//               ${otp}
//             </h1>
//           `,
//         }
//       );

//       res.json({
//         success:
//           true,
//         message:
//           "OTP sent to email",
//       });
//     } catch (
//       error
//     ) {
//       res
//         .status(500)
//         .json({
//           success:
//             false,
//           message:
//             error.message,
//         });
//     }
//   };

// // ================= RESET PASSWORD =================
// exports.resetPassword = async (req, res) => {
//   try {
//     const { email, newPassword } = req.body;

//     if (!email || !newPassword) {
//       return res.status(400).json({
//         success: false,
//         message: "Email and new password are required",
//       });
//     }

//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Update password
//     user.password = newPassword;      // Will be hashed by pre("save") if you have one
//     user.plainPassword = newPassword; // Store plain password
//     user.isFirstLogin = false;

//     await user.save();

//     return res.status(200).json({
//       success: true,
//       message: "Password reset successfully",
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // ================= REFRESH TOKEN =================
// exports.refreshUserToken =
//   async (req, res) => {
//     try {
//       const {
//         refreshToken,
//       } = req.body;

//       if (
//         !refreshToken
//       ) {
//         return res
//           .status(401)
//           .json({
//             success:
//               false,
//             message:
//               "Refresh token required",
//           });
//       }

//       const user =
//         await User.findOne(
//           {
//             refreshToken,
//           }
//         );

//       if (!user) {
//         return res
//           .status(401)
//           .json({
//             success:
//               false,
//             message:
//               "Invalid refresh token",
//           });
//       }

//       const token =
//         generateToken(
//           user._id
//         );

//       res.json({
//         success:
//           true,
//         token,
//       });
//     } catch (
//       error
//     ) {
//       res
//         .status(500)
//         .json({
//           success:
//             false,
//           message:
//             error.message,
//         });
//     }
//   };

// // ================= LOGOUT =================
// exports.logoutUser =
//   async (req, res) => {
//     try {
//       const { 
//         userId,
//       } = req.body;

//       const user =
//         await User.findById(
//           userId
//         );

//       if (!user) {
//         return res
//           .status(404)
//           .json({
//             success:
//               false,
//             message:
//               "User not found",
//           });
//       }

//       user.refreshToken =
//         null;

//       user.deviceId =
//         null;

//       await user.save();

//       res.json({
//         success:
//           true,
//         message:
//           "Logout successful",
//       });
//     } catch (
//       error
//     ) {
//       res
//         .status(500)
//         .json({
//           success:
//             false,
//           message:
//             error.message,
//         });
//     }
//   };


const User = require("../models/User");
const Employee = require("../models/Employee");
const generateEmployeeID = require("../utils/employeeId");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const axios = require("axios");

const { syncEmployeeToUser } = require("../utils/userEmployeeSync");
const { sendRegistrationEmail, sendForgotPasswordEmail, sendCustomEmail } = require("../utils/mailer");

// ================= JWT TOKEN =================
const generateToken = (userId) => {
  return jwt.sign(
    {
      id: userId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// ================= GENERATE OTP =================
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ================= GENERATE TEMPORARY PASSWORD =================
const generateTemporaryPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// ======================================================
// CREATE DEFAULT ADMIN
// ======================================================
const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({
      role: "admin",
    });

    if (adminExists) {
      return;
    }

    const admin = new User({
      name: "admin",

      email: "admin@gmail.com",

      phoneNumber: "9999999999",

      dob: "01-01-2000",

      address: "Ahmedabad",

      department: "Administration",

      bloodGroup: "O+",

      uniqueID: "ADMIN001",

      password: "admin123",

      plainPassword: "admin123",

      role: "admin",

      isApproved: true,

      isFirstLogin: false,

      isActive: true,
    });

    await admin.save();

    console.log("✅ Default Admin Created");
  } catch (error) {
    console.log(
      "❌ Admin Create Error:",
      error.message
    );
  }
};

// Run admin creation
createDefaultAdmin();

// ======================================================
// CREATE DEFAULT HR
// ======================================================
const createDefaultHR = async () => {
  try {
    const hrExists = await User.findOne({
      role: "hr",
    });

    if (hrExists) {
      return;
    }

    const hr = new User({
      name: "hr",

      email: "hr@gmail.com",

      phoneNumber: "8888888888",

      dob: "01-01-2000",

      address: "Ahmedabad",

      department: "HR",

      bloodGroup: "O+",

      uniqueID: "HR001",

      password: "hr123",

      plainPassword: "hr123",

      role: "hr",

      isApproved: true,

      isFirstLogin: false,

      isActive: true,
    });

    await hr.save();

    console.log("✅ Default HR Created");
  } catch (error) {
    console.log(
      "❌ HR Create Error:",
      error.message
    );
  }
};

createDefaultHR();

// ======================================================
// UPDATE PROFILE
// USER -> EMPLOYEE SYNC
// ======================================================
exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      dob,
      address,
      department,
      bloodGroup,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ==================================================
    // EMAIL DUPLICATE CHECK
    // ==================================================
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({
        email,
        _id: { $ne: user._id },
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // ==================================================
    // PHONE DUPLICATE CHECK
    // ==================================================
    if (
      phoneNumber &&
      phoneNumber !== user.phoneNumber
    ) {
      const existingPhone = await User.findOne({
        phoneNumber,
        _id: { $ne: user._id },
      });

      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already exists",
        });
      }
    }

    // ==================================================
    // UPDATE USER
    // ==================================================
    user.name = name || user.name;
    user.email = email || user.email;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.dob = dob || user.dob;
    user.address = address || user.address;
    user.department = department || user.department;
    user.bloodGroup = bloodGroup || user.bloodGroup;

    await user.save();

    // ==================================================
    // USER -> EMPLOYEE SYNC
    // ==================================================
    const employee = await Employee.findOne({
      userID: user._id,
    });

    if (employee) {
      // ----------------------------------------------
      // NAME
      // ----------------------------------------------
      if (user.name !== undefined) {
        employee.firstName = user.name;
      }

      // ----------------------------------------------
      // EMAIL
      // ----------------------------------------------
      if (user.email !== undefined) {
        employee.email = user.email;
      }

      // ----------------------------------------------
      // PHONE
      // ----------------------------------------------
      if (user.phoneNumber !== undefined) {
        employee.mobile = user.phoneNumber;
      }

      // ----------------------------------------------
      // DOB
      // ----------------------------------------------
      if (user.dob !== undefined) {
        employee.dob = user.dob;
      }

      // ----------------------------------------------
      // ADDRESS
      // ----------------------------------------------
      if (user.address !== undefined) {
        employee.currentAddress = user.address;
        employee.permanentAddress = user.address;
      }

      // ----------------------------------------------
      // DEPARTMENT
      // ----------------------------------------------
      if (user.department !== undefined) {
        employee.department = user.department;
      }

      // ----------------------------------------------
      // BLOOD GROUP
      // ----------------------------------------------
      if (user.bloodGroup !== undefined) {
        employee.bloodGroup = user.bloodGroup;
      }

      await employee.save();

      console.log(
        `✅ User -> Employee synced successfully: ${employee._id}`
      );
    } else {
      console.log(
        `⚠️ Employee record not found for User: ${user._id}`
      );
    }

    // ==================================================
    // RESPONSE
    // ==================================================
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",

      profile: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        dob: user.dob,
        address: user.address,
        department: user.department,
        bloodGroup: user.bloodGroup,
        uniqueID: user.uniqueID,
        role: user.role,
      },

      employee: employee || null,
    });

  } catch (error) {
    console.log(
      "Update Profile Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// GET MY PROFILE
// ======================================================
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(
      req.user._id
    ).select(
      "-password -plainPassword -refreshToken -forgotPasswordOTP -otpExpireTime"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    } 

    return res.status(200).json({
      success: true,

      profile: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        dob: user.dob,
        address: user.address,
        department: user.department,
        bloodGroup: user.bloodGroup,
        uniqueID: user.uniqueID,
        role: user.role,
        isApproved: user.isApproved,
        isFirstLogin: user.isFirstLogin,
        lastLogin: user.lastLogin,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.log(
      "Profile Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// REGISTER USER
// ======================================================
// ======================================================
// REGISTER USER
// ======================================================
exports.registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      dob,
      address,
      department,
      gender,
      designation,
      bloodGroup,
      role,
    } = req.body;

    // ==================================================
    // NORMALIZE ROLE & VALIDATION
    // ==================================================
    const normalizedRole = (role || "").trim().toLowerCase();
    const isAdminUser = normalizedRole === "admin";

    if (
      !name ||
      !email ||
      (!isAdminUser &&
        (!phoneNumber ||
          !dob ||
          !address ||
          !department ||
          !gender ||
          !designation ||
          !bloodGroup))
    ) {
      return res.status(400).json({
        success: false,
        message: isAdminUser
          ? "Name and Email are required for admin"
          : "All fields are required",
      });
    }

    const allowedRoles = [
      "employee",
      "team lead",
      "hr",
      "intern",
      "accountant",
      "admin",
    ];

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role selected",
      });
    }

    // ==================================================
    // NORMALIZE EMAIL
    // ==================================================
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    // ==================================================
    // CHECK EXISTING USER
    // ==================================================
    const existingUser = await User.findOne({
      $or: [
        {
          email: normalizedEmail,
        },
        {
          phoneNumber,
        },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // ==================================================
    // GENERATE UNIQUE USER ID
    // ==================================================
    const lastUser = await User.findOne({
      uniqueID: {
        $regex: /^NEW\d+$/,
      },
    }).sort({
      createdAt: -1,
    });

    let nextNumber = 1001;

    if (
      lastUser &&
      lastUser.uniqueID
    ) {
      const lastNumber = parseInt(
        lastUser.uniqueID.replace(
          "NEW",
          ""
        )
      );

      if (!isNaN(lastNumber)) {
        nextNumber =
          lastNumber + 1;
      }
    }

    const uniqueID =
      `NEW${nextNumber}`;

    // ==================================================
    // GENERATE PASSWORD
    // ==================================================
    const generatedPassword =
      Math.random()
        .toString(36)
        .slice(-8);

    // ==================================================
    // CREATE USER
    // ==================================================
    const user = await User.create({
      name: name.trim(),

      email: normalizedEmail,

      phoneNumber,

      dob,

      address,

      department,

      gender,

      designation,

      bloodGroup,

      uniqueID,

      password:
        generatedPassword,

      plainPassword:
        generatedPassword,

      role: normalizedRole,

      isApproved: false,

      isFirstLogin: true,

      isActive: true,
    });

    // ==================================================
    // CREATE EMPLOYEE RECORD
    // EMPLOYEE + TEAM LEAD BOTH USE EMPLOYEE COLLECTION
    // ==================================================
    let employee = null;

    if (
      normalizedRole === "employee" ||
      normalizedRole === "team lead"
    ) {
      try {
        // ==============================================
        // GENERATE EMPLOYEE ID
        // ==============================================
        const employeeID = await generateEmployeeID(Employee);

        // ==============================================
        // CREATE EMPLOYEE
        // ==============================================
        employee =
          await Employee.create({
            employeeID,

            // IMPORTANT
            // User._id is stored here
            userID: user._id,

            firstName:
              name.trim(),

            lastName: "",

            email:
              normalizedEmail,

            mobile:
              phoneNumber,

            gender,

            dob,

            bloodGroup,

            address,

            currentAddress:
              address,

            permanentAddress:
              address,

            designation:
              designation ||
              (normalizedRole === "team lead"
                ? "Team Lead"
                : "Employee"),

            department,

            joiningDate:
              new Date(),

            employeeStatus:
              "Active",

            isTeamLead:
              normalizedRole ===
              "team lead",
          });

        console.log(
          "✅ Employee record created:",
          employee._id
        );

        console.log(
          "✅ Employee User ID:",
          employee.userID
        );

        console.log(
          "✅ Employee ID:",
          employee.employeeID
        );

        // ==============================================
        // SYNC EMPLOYEE DATA TO USER
        // ==============================================
        if (
          typeof syncEmployeeToUser ===
          "function"
        ) {
          await syncEmployeeToUser({
            employee,

            role:
              normalizedRole,

            userData: {
              name:
                name.trim(),

              email:
                normalizedEmail,

              phoneNumber,

              dob,

              address,

              department,

              bloodGroup,

              role:
                normalizedRole,

              isApproved:
                false,

              isFirstLogin:
                true,
            },
          });
        }
      } catch (employeeError) {
        console.error(
          "❌ Employee creation failed:",
          employeeError
        );

        // ==============================================
        // IMPORTANT:
        // If Employee creation fails,
        // delete newly created User
        // ==============================================
        await User.findByIdAndDelete(
          user._id
        );

        return res.status(500).json({
          success: false,
          message:
            "Employee registration failed. User was not created.",
          error:
            employeeError.message,
        });
      }
    }

    // ==================================================
    // SEND REGISTRATION SUCCESS EMAIL TO USER VIA BREVO
    // ==================================================
    console.log(`Registration successful for: ${user.email}`);

    let emailResult = { success: false };
    try {
      emailResult = await sendRegistrationEmail({
        name: user.name,
        email: user.email,
        password: user.plainPassword || generatedPassword,
        role: user.role,
      });
    } catch (brevoErr) {
      console.error("❌ Brevo sending error:", brevoErr.message);
    }

    // ==================================================
    // SEND NOTIFICATION EMAIL TO ADMIN (NON-BLOCKING VIA BREVO)
    // ==================================================
    if (process.env.ADMIN_EMAIL) {
      sendCustomEmail({
        to: process.env.ADMIN_EMAIL,
        subject: "New Employee Registration",
        htmlContent: `
          <h2>New Employee Registration</h2>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${normalizedEmail}</p>
          <p><b>Phone:</b> ${phoneNumber}</p>
          <p><b>Department:</b> ${department}</p>
          <p><b>Role:</b> ${normalizedRole}</p>
          <p><b>Unique ID:</b> ${uniqueID}</p>
          ${employee ? `<p><b>Employee ID:</b> ${employee.employeeID}</p>` : ""}
          <hr />
          <p>Please approve this employee from the admin panel.</p>
        `,
      }).catch((err) => console.log("Admin email notification:", err.message));
    }

    // ==================================================
    // RESPONSE
    // ==================================================
    return res.status(201).json({
      success: true,
      emailSent: emailResult.success,
      message:
        "Registration successful. Waiting for admin approval.",

      credentials: {
        uniqueID,
      },

      user: {
        _id:
          user._id,

        name:
          user.name,

        email:
          user.email,

        uniqueID:
          user.uniqueID,

        role:
          user.role,

        isApproved:
          user.isApproved,
      },

      employee:
        employee
          ? {
              _id:
                employee._id,

              employeeID:
                employee.employeeID,

              userID:
                employee.userID,

              designation:
                employee.designation,

              department:
                employee.department,
            }
          : null,
    });
  } catch (error) {
    console.error(
      "❌ Register Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Registration failed",
    });
  }
};

// ======================================================
// GET ALL USERS
// ======================================================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,

      totalUsers: users.length,

      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// ======================================================
// APPROVE EMPLOYEE
// ======================================================
exports.approveEmployee = async (req, res) => {
  try {
    const { userId } = req.body;

    // ==================================================
    // VALIDATE USER ID
    // ==================================================
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // ==================================================
    // FIND USER
    // ==================================================
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ==================================================
    // CHECK ALREADY APPROVED
    // ==================================================
    if (user.isApproved) {
      return res.status(400).json({
        success: false,
        message: "Employee is already approved",
      });
    }

    // ==================================================
    // FIND EMPLOYEE
    // ==================================================
    let employee = await Employee.findOne({
      userID: user._id,
    });

    // ==================================================
    // IF EMPLOYEE RECORD DOES NOT EXIST
    // CREATE IT AUTOMATICALLY
    // ==================================================
    if (!employee) {
      console.log(
        "⚠️ Employee record missing. Creating automatically..."
      );

      // ==============================================
      // FIND LAST EMPLOYEE ID
      // ==============================================
      const employeeID = await generateEmployeeID(Employee);

      // ==============================================
      // CREATE EMPLOYEE RECORD
      // ==============================================
      employee = await Employee.create({
        employeeID,

        // IMPORTANT:
        // User ID stored in Employee table
        userID: user._id,

        firstName:
          user.name || "",

        lastName: "",

        email:
          user.email || "",

        mobile:
          user.phoneNumber || "",

        gender:
          user.gender || "Other",

        dob:
          user.dob || "",

        bloodGroup:
          user.bloodGroup || "",

        address:
          user.address || "",

        currentAddress:
          user.address || "",

        permanentAddress:
          user.address || "",

        designation:
          user.designation ||
          (user.role === "team lead"
            ? "Team Lead"
            : "Employee"),

        department:
          user.department || "",

        joiningDate:
          new Date(),

        employeeStatus:
          "Active",

        isTeamLead:
          user.role === "team lead",
      });

      console.log(
        "✅ Employee record created:",
        employee._id
      );

      console.log(
        "✅ Employee ID:",
        employee.employeeID
      );
    }

    // ==================================================
    // APPROVE USER
    // ==================================================
    user.isApproved = true;

    await user.save();

    // ==================================================
    // RESPONSE
    // ==================================================
    return res.status(200).json({
      success: true,

      message:
        "Employee approved successfully.",

      data: {
        userId:
          user._id,

        employeeID:
          employee.employeeID,

        username:
          user.name,

        email:
          user.email,

        designation:
          employee.designation,

        joiningDate:
          employee.joiningDate
            ? new Date(
                employee.joiningDate
              ).toLocaleDateString(
                "en-IN",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }
              )
            : "",

        isApproved:
          user.isApproved,
      },
    });
  } catch (error) {
    console.error(
      "❌ Approve Employee Error:",
      error 
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to approve employee.",
    });
  }
};

// ======================================================
// REJECT EMPLOYEE
// ======================================================
exports.rejectEmployee = async (
  req,
  res
) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(
      userId
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isApproved = false;

    await user.save();

    return res.json({
      success: true,

      message:
        "Employee rejected successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// ======================================================
// LOGIN
// ======================================================
exports.loginUser = async (req, res) => {
  try {
    const {
      login,
      password,
      deviceId,
    } = req.body;

    // ================= VALIDATION =================
    if (!login || !password) {
      return res.status(400).json({
        success: false,

        message:
          "Login and password required",
      });
    }

    // ================= FIND USER =================
    const user = await User.findOne({
      $or: [
        {
          email: login
            .trim()
            .toLowerCase(),
        },

        {
          name: login.trim(),
        },

        {
          uniqueID: login.trim(),
        },
      ],
    });

    // ================= USER NOT FOUND =================
    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    // ================= EXACT CASE MATCH CHECK =================
    const trimmedLogin = login.trim();
    const isExactMatch =
      user.email.toLowerCase() === trimmedLogin.toLowerCase() ||
      user.name.toLowerCase() === trimmedLogin.toLowerCase() ||
      user.uniqueID === trimmedLogin;

    if (!isExactMatch) {
      return res.status(400).json({
        success: false,

        message: "Invalid Email or Password",
      });
    }

    // ================= APPROVAL CHECK =================
    if (
      user.role !== "admin" &&
      user.role !== "hr" &&
      !user.isApproved
    ) {
      return res.status(403).json({
        success: false,

        message:
          "Admin approval pending",
      });
    }

    // ================= ONE DEVICE LOGIN =================
    if (
      user.deviceId &&
      deviceId &&
      user.deviceId !== deviceId
    ) {
      return res.status(401).json({
        success: false,

        message:
          "Already logged in another device",
      });
    }

    // ================= PASSWORD MATCH =================
    const isMatch =
      await bcrypt.compare(
        password.trim(),
        user.password
      );

    if (!isMatch) {
      return res.status(400).json({
        success: false,

        message: "Invalid Password",
      });
    }

    // ================= TOKEN =================
    const token =
      generateToken(user._id);

    const refreshToken =
      generateToken(user._id);

    // ================= SAVE LOGIN =================
    user.refreshToken =
      refreshToken;

    user.deviceId =
      deviceId || null;

    user.lastLogin =
      new Date();

    await user.save();

    // ================= RESPONSE =================
    return res.status(200).json({
      success: true,

      message: "Login successful",

      token,

      refreshToken,

      changePassword:
        user.isFirstLogin,

      user: {
        _id: user._id,

        name: user.name,

        email: user.email,

        role: user.role,
      },
    });
  } catch (error) {
    console.log(
      "Login Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// ======================================================
// CHANGE PASSWORD
// ======================================================
exports.changePassword = async (
  req,
  res
) => {
  try {
    const {
      userId,
      oldPassword,
      newPassword,
    } = req.body;

    const user = await User.findById(
      userId
    );

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    // ================= OLD PASSWORD CHECK =================
    const isMatch =
      await bcrypt.compare(
        oldPassword,
        user.password
      );

    if (!isMatch) {
      return res.status(400).json({
        success: false,

        message:
          "Old password incorrect",
      });
    }

    // ================= UPDATE PASSWORD =================
    user.password = newPassword;

    // Clear old plain password
    user.plainPassword = undefined;

    user.isFirstLogin = false;

    await user.save();

    return res.json({
      success: true,

      message:
        "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// ======================================================
// SEND OTP
// ======================================================
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    const otp = generateOTP();

    user.forgotPasswordOTP = otp;

    user.otpExpireTime = new Date(
      Date.now() + 5 * 60 * 1000
    );

    await user.save();

    sendCustomEmail({
      to: email,
      subject: "OTP Verification",
      htmlContent: `
        <h2>OTP Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>OTP valid for 5 minutes.</p>
      `,
    }).catch((err) => console.log("OTP email error:", err.message));

    return res.json({
      success: true,

      message:
        "OTP sent successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// ======================================================
// VERIFY OTP
// ======================================================
exports.verifyOTP = async (
  req,
  res
) => {
  try {
    const {
      email,
      otp,
    } = req.body;

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    if (
      user.forgotPasswordOTP !==
      otp
    ) {
      return res.status(400).json({
        success: false,

        message: "Invalid OTP",
      });
    }

    if (
      user.otpExpireTime <
      new Date()
    ) {
      return res.status(400).json({
        success: false,

        message: "OTP expired",
      });
    }

    user.otpVerified = true;

    await user.save();

    return res.json({
      success: true,

      message:
        "OTP verified successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// ======================================================
// FORGOT PASSWORD (BREVO TRANSACTIONAL EMAIL)
// ======================================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // 1. Find user in database
    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email",
      });
    }

    // 2. Generate a secure single-use crypto reset token (valid for 15 minutes)
    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // 3. Construct Reset Password Link (Host dynamic URL for Mobile & Web)
    const host = req.get("host");
    const isHttps =
      req.protocol === "https" ||
      req.headers["x-forwarded-proto"] === "https" ||
      host.includes("onrender.com");
    const protocol = isHttps ? "https" : "http";
    const baseUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    // 4. Send Brevo Transactional Email with Reset Link
    const emailResult = await sendCustomEmail({
      to: user.email,
      name: user.name || user.email,
      subject: "Reset Your Password - Kevalon Technology",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f8fafc; border-radius: 10px;">
          <div style="background-color: #111827; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">KEVALON TECHNOLOGY</h1>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hello <b>${user.name || "User"}</b>,</p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">We received a request to reset your password. Click the button below to create your new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #4f46e5; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #64748b; font-size: 13px;">If the button doesn't work, copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #4f46e5; font-size: 12px;"><a href="${resetLink}" style="color: #4f46e5;">${resetLink}</a></p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 25px;">⏳ This is a single-use link valid for 15 minutes. If you did not request a password reset, please ignore this email.</p>
          </div>
        </div>
      `,
    });

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again later.",
      });
    }

    console.log(`Password reset link sent to: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process forgot password request",
    });
  }
};

// ======================================================
// RENDER RESET PASSWORD HTML PAGE (FOR MOBILE/WEB DIRECT LINK)
// ======================================================
exports.renderResetPasswordPage = async (req, res) => {
  try {
    const token = req.query.token || "";

    // 1. Verify if token exists and is valid (not used, not expired)
    let isValid = false;
    if (token) {
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() },
      });

      if (user) {
        isValid = true;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Kevalon Technology</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #ffffff; width: 100%; max-width: 420px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #111827; padding: 26px 20px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 1.5px; }
    .header p { color: #94a3b8; font-size: 11px; margin-top: 4px; letter-spacing: 1px; }
    .body { padding: 30px 24px; }
    .title { font-size: 18px; font-weight: 700; color: #0f172a; text-align: center; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #64748b; text-align: center; margin-bottom: 24px; }
    .form-group { margin-bottom: 18px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px; }
    .input-wrapper { position: relative; }
    .input-wrapper input { width: 100%; padding: 11px 40px 11px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 14px; color: #0f172a; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
    .input-wrapper input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }
    .toggle-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 14px; padding: 4px; display: flex; align-items: center; justify-content: center; }
    .toggle-btn:hover { color: #475569; }
    .btn { width: 100%; padding: 13px; background: #4f46e5; color: #ffffff; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
    .btn:hover { background: #4338ca; }
    .btn:disabled { background: #94a3b8; cursor: not-allowed; }
    .alert { padding: 12px; border-radius: 10px; font-size: 13px; font-weight: 500; margin-bottom: 18px; display: none; }
    .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
    .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
    .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8; }
    .expired-box { text-align: center; padding: 10px 0; }
    .expired-icon { font-size: 48px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>KEVALON</h1>
      <p>TECHNOLOGY</p>
    </div>
    <div class="body">
      ${
        !isValid
          ? `
      <!-- EXPIRED LINK SCREEN -->
      <div class="expired-box">
        <div class="expired-icon">⚠️</div>
        <h2 class="title" style="color: #b91c1c;">Link Expired</h2>
        <p class="subtitle" style="margin-top: 8px; color: #475569;">
          This password reset link has already been used or has expired.
        </p>
        <div class="alert alert-error" style="display: block; margin-top: 16px;">
          For security reasons, password reset links can only be used once. Please request a new link from your mobile app or login screen.
        </div>
      </div>
      `
          : `
      <!-- ACTIVE RESET FORM -->
      <div id="formSection">
        <h2 class="title">Reset Your Password</h2>
        <p class="subtitle">Enter and confirm your new password below</p>
        
        <div id="errorAlert" class="alert alert-error"></div>
        <div id="successAlert" class="alert alert-success"></div>

        <form id="resetForm" onsubmit="handleSubmit(event)">
          <input type="hidden" id="token" value="${token}">
          
          <div class="form-group">
            <label for="newPassword">New Password</label>
            <div class="input-wrapper">
              <input type="password" id="newPassword" placeholder="••••••••" required minlength="6" autocomplete="new-password">
              <button type="button" class="toggle-btn" onclick="togglePassword('newPassword', this)" aria-label="Toggle Password Visibility">
                <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <div class="input-wrapper">
              <input type="password" id="confirmPassword" placeholder="••••••••" required minlength="6" autocomplete="new-password">
              <button type="button" class="toggle-btn" onclick="togglePassword('confirmPassword', this)" aria-label="Toggle Password Visibility">
                <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          <button type="submit" id="submitBtn" class="btn">Submit New Password</button>
        </form>
      </div>

      <div id="successSection" style="display: none; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
        <h2 class="title" style="color: #15803d;">Password Reset Successful!</h2>
        <p class="subtitle" style="margin-top: 8px;">Your new password has been saved. You can now login on your mobile app or admin portal with your new password.</p>
      </div>
      `
      }

      <div class="footer">
        © ${new Date().getFullYear()} Kevalon Technology. All rights reserved.
      </div>
    </div>
  </div>

  <script>
    const eyeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    const eyeOffSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';

    function togglePassword(inputId, btn) {
      const input = document.getElementById(inputId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = eyeOffSvg;
      } else {
        input.type = 'password';
        btn.innerHTML = eyeSvg;
      }
    }

    async function handleSubmit(e) {
      e.preventDefault();
      const token = document.getElementById('token').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const errorAlert = document.getElementById('errorAlert');
      const submitBtn = document.getElementById('submitBtn');

      errorAlert.style.display = 'none';

      if (!token) {
        errorAlert.textContent = 'Invalid or missing reset token. Please request a new reset link.';
        errorAlert.style.display = 'block';
        return;
      }

      if (newPassword.length < 6) {
        errorAlert.textContent = 'Password must be at least 6 characters long.';
        errorAlert.style.display = 'block';
        return;
      }

      if (newPassword !== confirmPassword) {
        errorAlert.textContent = 'New Password and Confirm Password do not match.';
        errorAlert.style.display = 'block';
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating Password...';

        const res = await fetch('/api/users/reset-password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword })
        });

        const data = await res.json();

        if (!res.ok) {
          errorAlert.textContent = data.message || 'Failed to reset password.';
          errorAlert.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit New Password';
          return;
        }

        document.getElementById('formSection').style.display = 'none';
        document.getElementById('successSection').style.display = 'block';
      } catch (err) {
        errorAlert.textContent = 'Network error. Please try again.';
        errorAlert.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit New Password';
      }
    }
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.status(200).send(html);
  } catch (error) {
    console.error("Render Reset Page Error:", error.message);
    res.status(500).send("<h3>Internal Server Error</h3>");
  }
};

// ======================================================
// RESET PASSWORD
// ======================================================
exports.resetPassword = async (
  req,
  res
) => {
  try {
    const {
      token,
      newPassword,
    } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // Find user with matching active token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link has already been used or has expired. Please request a new link.",
      });
    }

    // ================= UPDATE PASSWORD =================
    // Password hashed by pre('save') hook
    user.password = newPassword;

    // Store plain password in database as requested
    user.plainPassword = newPassword;

    // Invalidate token so the link cannot be used ever again!
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.isFirstLogin = false;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reset password",
    });
  }
};

// ======================================================
// REFRESH TOKEN
// ======================================================
exports.refreshUserToken = async (
  req,
  res
) => {
  try {
    const {
      refreshToken,
    } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,

        message:
          "Refresh token required",
      });
    }

    const user =
      await User.findOne({
        refreshToken,
      });

    if (!user) {
      return res.status(401).json({
        success: false,

        message:
          "Invalid refresh token",
      });
    }

    const token =
      generateToken(user._id);

    return res.json({
      success: true,

      token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// ======================================================
// LOGOUT
// ======================================================
exports.logoutUser = async (
  req,
  res
) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(
      userId
    );

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    user.refreshToken = null;

    user.deviceId = null;

    await user.save();

    return res.json({
      success: true,

      message:
        "Logout successful",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};