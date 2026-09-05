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
const nodemailer = require("nodemailer");
const axios = require("axios");

const { syncEmployeeToUser } = require("../utils/userEmployeeSync");

// ================= EMAIL CONFIG =================
const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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
    // VALIDATION
    // ==================================================
    if (
      !name ||
      !email ||
      !phoneNumber ||
      !dob ||
      !address ||
      !department ||
      !gender ||
      !designation ||
      !bloodGroup ||
      !role
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // ==================================================
    // NORMALIZE ROLE
    // ==================================================
    const normalizedRole = role
      .trim()
      .toLowerCase();

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
    // SEND REGISTRATION EMAIL TO ADMIN
    // ==================================================
    try {
      await transporter.sendMail({
        from:
          process.env.EMAIL_USER,

        to:
          process.env.ADMIN_EMAIL,

        subject:
          "New Employee Registration",

        html: `
          <h2>
            New Employee Registration
          </h2>

          <p>
            <b>Name:</b>
            ${name}
          </p>

          <p>
            <b>Email:</b>
            ${normalizedEmail}
          </p>

          <p>
            <b>Phone:</b>
            ${phoneNumber}
          </p>

          <p>
            <b>Department:</b>
            ${department}
          </p>

          <p>
            <b>Role:</b>
            ${normalizedRole}
          </p>

          <p>
            <b>Unique ID:</b>
            ${uniqueID}
          </p>

          ${
            employee
              ? `
                <p>
                  <b>Employee ID:</b>
                  ${employee.employeeID}
                </p>
              `
              : ""
          }

          <hr />

          <p>
            Please approve this employee
            from the admin panel.
          </p>
        `,
      });

      console.log(
        "✅ Admin registration email sent successfully"
      );
    } catch (emailError) {
      // Email error should NOT delete user/employee
      console.log(
        "❌ Admin Email Error:",
        emailError.message
      );
    }

    // ==================================================
    // RESPONSE
    // ==================================================
    return res.status(201).json({
      success: true,

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

        currentAddress:
          user.address || "",

        permanentAddress:
          user.address || "",

        designation:
          user.role === "team lead"
            ? "Team Lead"
            : "Employee",

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
      user.email === trimmedLogin ||
      user.name === trimmedLogin ||
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

    await transporter.sendMail({
      from: process.env.EMAIL_USER,

      to: email,

      subject:
        "OTP Verification",

      html: `
        <h2>
          OTP Verification
        </h2>

        <p>
          Your OTP is:
        </p>

        <h1>
          ${otp}
        </h1>

        <p>
          OTP valid for 5 minutes.
        </p>
      `,
    });

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
// FORGOT PASSWORD
// ======================================================
exports.forgotPassword = async (
  req,
  res
) => {
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

    await transporter.sendMail({
      from: process.env.EMAIL_USER,

      to: email,

      subject:
        "Forgot Password OTP",

      html: `
        <h2>
          Reset Password OTP
        </h2>

        <h1>
          ${otp}
        </h1>
      `,
    });

    return res.json({
      success: true,

      message:
        "OTP sent to email",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
    });
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
      email,
      newPassword,
    } = req.body;

    if (
      !email ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Email and new password are required",
      });
    }

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    // ================= UPDATE PASSWORD =================
    user.password = newPassword;

    // Store latest password only because
    // approval email requires it before first login.
    user.plainPassword = newPassword;

    user.isFirstLogin = false;

    await user.save();

    return res.status(200).json({
      success: true,

      message:
        "Password reset successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
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