const express =
  require("express");

const router =
  express.Router();

const { authLimiter } = require("../middleware/rateLimiter");
 
const {
  updateProfile,
  getMyProfile,
  uploadProfileImage,
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
  deleteUser,
} = require(
  "../controllers/userControllers"
);

const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const profileImageUpload = upload.profileImageUpload || upload.single("profileImage");

// ================= PROFILE & CLOUDINARY IMAGE =================
router.put(
  "/profile/update",
  protect,
  profileImageUpload,
  updateProfile 
);

router.post(
  "/profile/update",
  protect,
  profileImageUpload,
  updateProfile 
);

router.put(
  "/profile", 
  protect,
  profileImageUpload,
  updateProfile
);

router.get(
  "/profile", 
  protect,
  getMyProfile
);

router.post(
  "/profile/upload",
  protect,
  profileImageUpload,
  uploadProfileImage
);

router.post(
  "/upload-profile-image",
  protect,
  profileImageUpload,
  uploadProfileImage
);

// ================= REGISTER =================
router.post(
  "/register",
  profileImageUpload,
  registerUser
);  //done 

// ================= APPROVE EMPLOYEE =================
router.put( 
  "/approve",
  approveEmployee
);  //done

router.post(
  "/approve",
  approveEmployee
);

router.put(
  "/approve/:id",
  approveEmployee
);

router.post(
  "/approve/:id",
  approveEmployee
);

router.put(
  "/approve-employee",
  approveEmployee
);

router.post(
  "/approve-employee",
  approveEmployee
);

router.put( 
  "/reject", 
  rejectEmployee
);

router.post(
  "/reject",
  rejectEmployee
);

// ================= LOGIN =================
router.post(
  "/login",
  authLimiter,
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
  authLimiter,
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

router.post("/reset-password", (req, res, next) => {
  const hasLoginToken = (req.headers.authorization || "").startsWith("Bearer ");
  const isAuthenticatedPasswordChange =
    hasLoginToken && !req.body.email && !req.body.token;

  if (isAuthenticatedPasswordChange) {
    return protect(req, res, () => changePassword(req, res, next));
  }

  return resetPassword(req, res, next);
});

// ================= CHANGE PASSWORD =================

router.put(
  "/change-password",
  protect,
  changePassword
); //done

router.post(
  "/change-password",
  protect,
  changePassword
); // compatibility for all panels

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
  "/",
  getAllUsers
);

router.get(
  "/all",
  getAllUsers
); //done

router.get(
  "/pending",
  (req, res, next) => {
    req.query.isApproved = "false";
    return getAllUsers(req, res, next);
  }
);

// ================= DELETE USER =================
router.delete(
  "/delete/:id",
  deleteUser
);

router.delete(
  "/:id",
  deleteUser
);

router.delete(
  "/",
  deleteUser
);

module.exports =
  router;