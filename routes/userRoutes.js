const express =
  require("express");

const router =
  express.Router();

const {
  updateProfile,
  getMyProfile, 
  registerUser,
  approveEmployee,
  rejectEmployee,
  loginUser,
  changePassword,
  getAllUsers,
  sendOTP,
  verifyOTP,
  forgotPassword,
  resetPassword,
  renderResetPasswordPage,
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

router.put(
  "/reject", 
  rejectEmployee
);

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
router.get(
  "/reset-password",
  renderResetPasswordPage
);

router.put(
  "/reset-password",
  resetPassword
); //done 

router.post(
  "/reset-password",
  resetPassword
);

// ================= CHANGE PASSWORD =================
router.put( 
  "/change-password",
  changePassword
); //done

router.post(
  "/change-password",
  changePassword
);

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