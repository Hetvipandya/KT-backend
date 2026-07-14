const express =
  require("express");

const router =
  express.Router();

const {
  updateProfile,
  getMyProfile,
  registerUser,
  approveEmployee,
  loginUser,
  changePassword,
  getAllUsers,
  sendOTP,
  verifyOTP,
  forgotPassword,
  resetPassword,
  refreshUserToken,
  logoutUser,
} = require(
  "../controllers/userControllers"
);

const { protect } = require("../middleware/authMiddleware");

router.put(
  "/profile/update",
  protect,
  updateProfile
);

router.get(
  "/profile", 
  protect,
  getMyProfile
);

// ================= REGISTER =================
router.post(
  "/register",
  registerUser
);  //done 

// ================= APPROVE EMPLOYEE =================
router.put( 
  "/approve",
  approveEmployee
);  //done

// ================= LOGIN =================
router.post(
  "/login",
  loginUser
);  //done

// ================= LOGOUT =================
router.post(
  "/logout",
  logoutUser
); //done

// ================= FORGOT PASSWORD =================
router.post(
  "/forgot-password",
  forgotPassword
); //done

// ================= RESET PASSWORD =================
router.put(
  "/reset-password",
  resetPassword
); //done 

// ================= CHANGE PASSWORD =================
router.put( 
  "/change-password",
  changePassword
); //done

// ================= SEND OTP =================
router.post(
  "/send-otp",
  sendOTP
); //done

// ================= VERIFY OTP =================
router.post(
  "/verify-otp",
  verifyOTP
); //done

// ================= REFRESH TOKEN =================
router.post(
  "/refresh-token",
  refreshUserToken
); //done

// ================= GET USERS =================
router.get(
  "/all",
  getAllUsers
); //done
 
module.exports =
  router;