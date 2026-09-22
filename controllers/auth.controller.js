const User = require("../models/User");
const { hashPassword, comparePassword, hashSha256 } = require("../utils/hash");
const {
  createSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
} = require("../services/token.service");
const {
  sendEmail,
  sendVerificationEmail,
} = require("../services/email.service");
const { sendOtp, verifyOtp } = require("../services/otp.service");
const { buildUserOnboardingResponse } = require("../utils/onboarding");
const auditLogService = require("../services/auditLog.service");
const env = require("../config/env");
const crypto = require("crypto");
const pino = require("pino");

const logger = pino({
  transport:
    env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});

// Helper to record audit event in controller
const logAuthEvent = (user, actionType, description, req) => {
  if (user && user.companyId) {
    auditLogService
      .recordAuditEvent({
        companyId: user.companyId,
        userId: user._id,
        module: "AUTH",
        actionType,
        description,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      })
      .catch((err) => {
        logger.error(
          { err },
          `Failed to record audit log for ${actionType}: ${err.message}`,
        );
      });
  }
};

// Helper to mask email address: example@domain.com -> e***@domain.com
const maskEmail = (email) => {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const maskedName = name[0] + "***";
  return `${maskedName}@${domain}`;
};

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, phoneNumber } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email address is already registered",
      });
    }

    // Hash password with 12 rounds
    const passwordHash = await hashPassword(password);

    // Generate email verification token (plain stored for email; hash stored in DB)
    const plainVerificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenHash = hashSha256(plainVerificationToken);
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with verification token
    const newUser = await User.create({
      name,
      email,
      passwordHash,
      phoneNumber: phoneNumber ?? phone,
      emailVerificationTokenHash: verificationTokenHash,
      emailVerificationExpires,
    });

    // Send verification email (non-blocking — do not fail register if email fails)
    sendVerificationEmail(newUser.email, plainVerificationToken).catch(
      (err) => {
        logger.error(
          { userId: newUser._id },
          `Failed to send verification email: ${err.message}`,
        );
      },
    );

    logger.info({ userId: newUser._id }, `User registered successfully`);

    return res.status(201).json({
      success: true,
      message:
        "Registered successfully. Please check your email to verify your account.",
      data: {
        userId: newUser._id,
        email: newUser.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select(
      "+passwordHash +refreshTokens",
    );
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check lock status
    if (user.isLocked) {
      const waitMinutes = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / (60 * 1000),
      );
      return res.status(423).json({
        success: false,
        message: `Account is locked due to multiple failed login attempts. Please try again in ${waitMinutes} minutes.`,
      });
    }

    const storedPasswordHash = user.passwordHash;

    // Guard against invited users who haven't completed password setup yet.
    if (!storedPasswordHash) {
      return res.status(401).json({
        success: false,
        message:
          "Your account was created via an invite. Please set your password using the invite link sent to your email before logging in.",
      });
    }

    // Compare passwords
    const isPasswordValid = await comparePassword(password, storedPasswordHash);

    if (!isPasswordValid) {
      // Increment login attempts
      user.loginAttempts += 1;

      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // lock for 15 minutes
        logger.warn(
          { userId: user._id },
          `User account locked due to too many failed attempts`,
        );
      }

      await user.save();

      logAuthEvent(
        user,
        "LOGIN_FAILED",
        `Failed login attempt for ${user.email}`,
        req,
      );

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Reset login attempts in memory (will be persisted inside createSession call)
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      await user.save();
      // Trigger OTP generation and email dispatch
      const userWithOtp = await User.findById(user._id).select("+otp");
      const otpResult = await sendOtp(userWithOtp, "login");

      logger.info(
        { userId: user._id },
        `2FA required for login. OTP dispatched.`,
      );

      return res.status(200).json({
        success: true,
        twoFactorRequired: true,
        otpSentTo: maskEmail(user.email),
      });
    }

    // Reconcile any orphaned branch or financial year references
    const {
      reconcileUserOrphanedReferences,
    } = require("../services/reconcile.service");
    const reconciledUser = await reconcileUserOrphanedReferences(user);

    // Establish session (persists refresh token + loginAttempts reset in 1 DB save)
    const tokens = await createSession(
      reconciledUser,
      req.ip,
      req.headers["user-agent"],
    );

    logger.info({ userId: reconciledUser._id }, `User logged in successfully`);

    logAuthEvent(
      reconciledUser,
      "LOGIN_SUCCESS",
      `User ${reconciledUser.email} logged in successfully`,
      req,
    );

    if (reconciledUser.mustChangePassword) {
      return res.status(200).json({
        success: true,
        mustChangePassword: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          ...(await buildUserOnboardingResponse(reconciledUser)),
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        ...(await buildUserOnboardingResponse(reconciledUser)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh-token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    const tokens = await rotateSession(
      refreshToken,
      req.ip,
      req.headers["user-agent"],
    );

    return res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    // req.user is loaded in authenticate middleware
    await revokeSession(req.user, refreshToken);

    logger.info({ userId: req.user._id }, `User logged out successfully`);

    return res.status(200).json({
      success: true,
      message: "Logged out",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
const me = async (req, res, next) => {
  try {
    // req.user is attached by authenticate middleware
    const {
      reconcileUserOrphanedReferences,
    } = require("../services/reconcile.service");
    const user = await reconcileUserOrphanedReferences(req.user);

    return res.status(200).json({
      success: true,
      data: await buildUserOnboardingResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Search user
    const user = await User.findOne({ email }).select(
      "+passwordResetTokenHash +passwordResetExpires",
    );

    if (user) {
      // Generate clean token
      const plainToken = crypto.randomBytes(32).toString("hex");

      // Store hashed token + 15 min expiry
      user.passwordResetTokenHash = hashSha256(plainToken);
      user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);

      await user.save();

      // Email plain token (points to GET /api/auth/reset-password web UI page)
      const host = req.get("host");
      const protocol = host.includes("localhost") ? req.protocol : "https";
      const resetLink = `${protocol}://${host}/api/auth/reset-password?token=${plainToken}`;
      const subject = "Password Reset Request";
      const text = `To reset your Kevalon ERP password, please click the following link (valid for 15 minutes):\n\n${resetLink}`;
      const html = `<p>You requested a password reset for Kevalon ERP.</p><p>Please click the link below to set a new password (valid for 15 minutes):</p><p><a href="${resetLink}">${resetLink}</a></p>`;

      await sendEmail({
        to: user.email,
        subject,
        text,
        html,
        templateParams: {
          reset_link: resetLink,
          link: resetLink,
          company_name: "Kevalon ERP",
          website_link: env.CLIENT_URL,
        },
      });
      logger.info(
        { userId: user._id },
        `Password reset token generated and sent`,
      );
    } else {
      logger.info(`Password reset requested for non-existent email: ${email}`);
    }

    // Always return generic message to prevent account enumeration
    return res.status(200).json({
      success: true,
      message: "If that email exists, a reset link has been sent",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const tokenHash = hashSha256(token);

    // Fetch user matching hash and verify expiry — include +passwordHash so we can update it
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select(
      "+passwordResetTokenHash +passwordResetExpires +refreshTokens +passwordHash",
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Password reset token is invalid or has expired.",
      });
    }

    // Set new password
    user.passwordHash = await hashPassword(newPassword);

    // Clear reset tokens
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;

    // Force re-login on all devices
    user.refreshTokens = [];

    await user.save();

    logger.info(
      { userId: user._id },
      `Password reset successfully. Sessions revoked.`,
    );

    logAuthEvent(
      user,
      "PASSWORD_RESET",
      `Password reset successfully via API`,
      req,
    );

    return res.status(200).json({
      success: true,
      message:
        "Password has been reset successfully. Please login with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user._id).select("+passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    if (currentPassword) {
      const isCurrentValid = await comparePassword(
        currentPassword,
        user.passwordHash,
      );
      if (!isCurrentValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is invalid",
        });
      }
    }

    user.passwordHash = await hashPassword(newPassword);
    user.mustChangePassword = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/send-otp
 */
const sendOtpController = async (req, res, next) => {
  try {
    const { email, purpose } = req.body;

    const user = await User.findOne({ email }).select("+otp");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otpResult = await sendOtp(user, purpose);

    return res.status(200).json({
      success: true,
      message: otpResult.message,
      expiresInSeconds: otpResult.expiresInSeconds,
    });
  } catch (error) {
    // If rate limit error occurs, return it nicely
    if (error.message.includes("Please wait")) {
      return res.status(429).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * POST /api/auth/verify-otp
 */
const verifyOtpController = async (req, res, next) => {
  try {
    const { email, otp, purpose } = req.body;

    const user = await User.findOne({ email }).select("+otp +refreshTokens");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let isValid = false;
    try {
      isValid = await verifyOtp(user, otp, purpose);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP code",
      });
    }

    if (purpose === "login") {
      // Complete login, issue tokens
      const tokens = await createSession(
        user,
        req.ip,
        req.headers["user-agent"],
      );
      const latestUser = await User.findById(user._id);

      logger.info({ userId: user._id }, `2FA login successful`);

      logAuthEvent(
        user,
        "LOGIN_SUCCESS",
        `User ${user.email} logged in successfully via 2FA`,
        req,
      );

      return res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          ...(await buildUserOnboardingResponse(latestUser)),
        },
      });
    } else if (purpose === "2fa_setup") {
      // Enable 2FA on profile
      user.twoFactorEnabled = true;
      await user.save();

      logger.info({ userId: user._id }, `2FA setup completed and enabled`);

      return res.status(200).json({
        success: true,
        message: "2FA has been successfully enabled.",
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/verify-email
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    const tokenHash = hashSha256(token);

    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    }).select("+emailVerificationTokenHash +emailVerificationExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Verification link is invalid or has expired. Please request a new one.",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    logger.info({ userId: user._id }, "Email verified successfully");

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/resend-verification-email
 */
const resendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email }).select(
      "+emailVerificationTokenHash +emailVerificationExpires",
    );

    if (user && !user.isEmailVerified) {
      // Enforce 60-second per-email cooldown using the existing expiry field:
      // a token just created has ~24h remaining; one created >60s ago has slightly less.
      if (user.emailVerificationExpires) {
        const maxExpiry = 24 * 60 * 60 * 1000;
        const remaining = user.emailVerificationExpires.getTime() - Date.now();
        const elapsed = maxExpiry - remaining;
        if (elapsed > 0 && elapsed < 60 * 1000) {
          const waitSeconds = Math.ceil((60 * 1000 - elapsed) / 1000);
          // Still return 200 — never reveal that the email exists or is cooling down
          logger.info(
            { email },
            `Verification email resend rate-limited (${waitSeconds}s remaining)`,
          );
          return res.status(200).json({
            success: true,
            message:
              "If that email exists and is unverified, a new verification link has been sent.",
          });
        }
      }

      const plainVerificationToken = crypto.randomBytes(32).toString("hex");
      user.emailVerificationTokenHash = hashSha256(plainVerificationToken);
      user.emailVerificationExpires = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      );
      await user.save();

      sendVerificationEmail(user.email, plainVerificationToken).catch((err) => {
        logger.error(
          { userId: user._id },
          `Failed to resend verification email: ${err.message}`,
        );
      });

      logger.info({ userId: user._id }, "Verification email resent");
    }

    // Always return the same generic response (anti-enumeration)
    return res.status(200).json({
      success: true,
      message:
        "If that email exists and is unverified, a new verification link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/sessions
 */
const listSessions = async (req, res, next) => {
  try {
    // Load refreshTokens (select:false by default)
    const user = await User.findById(req.user._id).select("+refreshTokens");

    const now = Date.now();
    const activeSessions = (user.refreshTokens || []).filter(
      (t) => !t.revoked && new Date(t.expiresAt).getTime() > now,
    );

    // The current access token carries the userId but NOT the current refresh token hash.
    // We cannot identify "isCurrent" via the access token alone — clients should pass
    // the current refreshToken in a header/cookie for this flag. We mark all as false
    // by default; clients can match by sessionId if needed.
    const sessions = activeSessions.map((t) => ({
      sessionId: t._id,
      userAgent: t.userAgent,
      ip: t.ip,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt || null,
      expiresAt: t.expiresAt,
      isCurrent: false, // extended by clients matching their stored refresh token's sessionId
    }));

    return res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/auth/sessions/:id
 */
const revokeSessionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(req.user._id).select("+refreshTokens");

    const session = (user.refreshTokens || []).find(
      (t) => t._id.toString() === id,
    );

    // Return 404 if not found (also covers sessions that belong to other users — never leak)
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Mark as revoked — next /refresh-token call with this token will fail with 401
    session.revoked = true;
    await user.save();

    logger.info(
      { userId: user._id, sessionId: id },
      "Session revoked via device management",
    );

    return res.status(200).json({
      success: true,
      message: "Session revoked",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/reset-password
 * Renders the beautiful web-based password reset form
 */
const showResetPasswordForm = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send(
        renderStatusPage({
          success: false,
          title: "Invalid Link",
          message: "Password reset token is missing from the URL.",
        }),
      );
    }

    const tokenHash = hashSha256(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetTokenHash +passwordResetExpires");

    if (!user) {
      return res.status(400).send(
        renderStatusPage({
          success: false,
          title: "Link Expired",
          message:
            "This password reset link is invalid or has expired. Please request a new one.",
        }),
      );
    }

    // Render the beautiful form
    return res.status(200).send(renderResetFormHtml(token));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password-web
 * Handles web form submissions for password resets
 */
const handleResetPasswordWeb = async (req, res, next) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    const wantsJson =
      req.headers.accept && req.headers.accept.includes("application/json");

    const respondError = (status, title, message) => {
      if (wantsJson) {
        return res.status(status).json({ success: false, title, message });
      }
      return res
        .status(status)
        .send(renderStatusPage({ success: false, title, message }));
    };

    if (!token || !newPassword) {
      return respondError(400, "Error", "Invalid request parameters.");
    }

    if (newPassword !== confirmPassword) {
      return respondError(400, "Validation Error", "Passwords do not match.");
    }

    if (newPassword.length < 8) {
      return respondError(
        400,
        "Validation Error",
        "Password must be at least 8 characters long.",
      );
    }

    const tokenHash = hashSha256(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select(
      "+passwordResetTokenHash +passwordResetExpires +refreshTokens +passwordHash",
    );

    if (!user) {
      return respondError(
        400,
        "Link Expired",
        "The password reset link has expired or is invalid. Please request a new one.",
      );
    }

    // Hash and save new password
    user.passwordHash = await hashPassword(newPassword);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = [];
    await user.save();

    logger.info({ userId: user._id }, `Password reset successfully via web UI`);

    logAuthEvent(
      user,
      "PASSWORD_RESET",
      `Password reset successfully via web UI`,
      req,
    );

    if (wantsJson) {
      return res.status(200).json({
        success: true,
        title: "Success!",
        message:
          "Your password has been reset successfully. You can now log in to the KT-CRM app with your new password.",
      });
    }

    return res.status(200).send(
      renderStatusPage({
        success: true,
        title: "Success!",
        message:
          "Your password has been reset successfully. You can now log in to the KT-CRM app with your new password.",
      }),
    );
  } catch (error) {
    next(error);
  }
};

// ── HTML VIEWS ──────────────────────────────────────────────────────────────

const renderResetFormHtml = (token) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Kevalon ERP</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --error-color: #ef4444;
      --success-color: #10b981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', sans-serif;
    }

    body {
      background: var(--bg-gradient);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--text-main);
      padding: 20px;
    }

    .container {
      width: 100%;
      max-width: 440px;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 40px 30px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      animation: fadeIn 0.5s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .logo-container {
      text-align: center;
      margin-bottom: 30px;
    }

    .logo-text {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(to right, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: 0.5px;
    }

    .title {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 8px;
      text-align: center;
    }

    .subtitle {
      font-size: 14px;
      color: var(--text-muted);
      text-align: center;
      margin-bottom: 30px;
      line-height: 1.5;
    }

    .form-group {
      margin-bottom: 24px;
      position: relative;
    }

    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      color: var(--text-muted);
    }

    .input-wrapper {
      position: relative;
    }

    .form-input {
      width: 100%;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 14px 16px;
      color: var(--text-main);
      font-size: 15px;
      transition: all 0.3s ease;
      outline: none;
    }

    .form-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
      background: rgba(15, 23, 42, 0.8);
    }

    .btn-submit {
      width: 100%;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 14px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .btn-submit {
      width: 100%;
      height: 48px;
      min-height: 48px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 0 20px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-sizing: border-box;
    }

    .btn-submit:hover:not(:disabled) {
      background: var(--primary-hover);
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
    }

    .btn-submit:disabled,
    .btn-submit[aria-disabled="true"] {
      opacity: 0.7 !important;
      cursor: not-allowed !important;
      pointer-events: none !important;
      background: var(--primary) !important;
    }

    .spinner {
      display: none;
      width: 18px !important;
      height: 18px !important;
      min-width: 18px !important;
      min-height: 18px !important;
      border: 3px solid rgba(255, 255, 255, 0.35) !important;
      border-top-color: #ffffff !important;
      border-radius: 50% !important;
      animation: spin 0.6s linear infinite !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
      margin-right: 6px;
    }

    .spinner.show,
    .btn-submit.loading .spinner {
      display: inline-block !important;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-msg {
      color: var(--error-color);
      font-size: 13px;
      margin-top: 6px;
      display: none;
      animation: shake 0.3s ease-in-out;
    }

    .server-error-banner {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--error-color);
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      margin-bottom: 16px;
      display: none;
      text-align: center;
      line-height: 1.4;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }

    .requirement-list {
      margin-top: 8px;
      font-size: 12px;
      color: var(--text-muted);
      list-style-type: none;
      padding-left: 4px;
    }

    .requirement-item {
      display: flex;
      align-items: center;
      margin-bottom: 4px;
      transition: color 0.3s ease;
    }

    .requirement-item::before {
      content: '○ ';
      margin-right: 6px;
      font-weight: bold;
    }

    .requirement-item.valid {
      color: var(--success-color);
    }

    .requirement-item.valid::before {
      content: '✓ ';
    }

    .icon-container {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
      background: rgba(16, 185, 129, 0.15);
      color: var(--success-color);
      border: 2px solid rgba(16, 185, 129, 0.3);
    }

    .success-card {
      display: none;
      text-align: center;
    }

    .btn-app {
      display: inline-block;
      background: var(--primary);
      color: white;
      text-decoration: none;
      border-radius: 12px;
      padding: 12px 24px;
      font-size: 15px;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-container">
      <span class="logo-text">KT-CRM</span>
    </div>

    <div id="formCard">
      <h1 class="title">Reset Your Password</h1>
      <p class="subtitle">Enter your new secure password below to regain access to your account.</p>

      <div class="server-error-banner" id="serverError" role="alert"></div>

      <form id="resetForm" action="/api/auth/reset-password-web" method="POST" onsubmit="return handleResetSubmit(event)">
        <input type="hidden" name="token" value="${token}">
        
        <div class="form-group">
          <label class="form-label" for="newPassword">New Password</label>
          <div class="input-wrapper">
            <input class="form-input" type="password" id="newPassword" name="newPassword" required minlength="8" placeholder="Min 8 characters" oninput="checkRequirements()" onkeyup="checkRequirements()" onchange="checkRequirements()" onpaste="checkRequirements()">
          </div>
          <ul class="requirement-list">
            <li class="requirement-item" id="reqLength">At least 8 characters long</li>
          </ul>
          <div class="error-msg" id="lenError">Password must be at least 8 characters long.</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="confirmPassword">Confirm Password</label>
          <div class="input-wrapper">
            <input class="form-input" type="password" id="confirmPassword" name="confirmPassword" required minlength="8" placeholder="Re-enter password" oninput="clearConfirmError()" onkeyup="clearConfirmError()" onchange="clearConfirmError()">
          </div>
          <div class="error-msg" id="matchError">Passwords do not match.</div>
        </div>

        <button type="submit" class="btn-submit" id="submitBtn" aria-busy="false" aria-disabled="false">
          <span class="spinner" id="btnSpinner" role="status" aria-label="Updating password"></span>
          <span id="btnText">Update Password</span>
        </button>
      </form>
    </div>

    <div class="success-card" id="successCard">
      <div class="icon-container">✓</div>
      <h1 class="title">Password Reset Successfully!</h1>
      <p class="subtitle" style="margin-bottom: 20px;">Your password has been updated. You can now return to the app and log in with your new password.</p>
      <a href="ktcrm://" class="btn-app">Open KT-CRM App</a>
    </div>
  </div>

  <script>
    function checkRequirements() {
      const password = document.getElementById('newPassword').value;
      const reqLength = document.getElementById('reqLength');
      const lenError = document.getElementById('lenError');
      
      if (password && password.length >= 8) {
        if (reqLength) reqLength.classList.add('valid');
        if (lenError) lenError.style.display = 'none';
      } else {
        if (reqLength) reqLength.classList.remove('valid');
      }
    }

    function clearConfirmError() {
      const matchError = document.getElementById('matchError');
      if (matchError) matchError.style.display = 'none';
    }

    window.addEventListener('DOMContentLoaded', checkRequirements);
    setTimeout(checkRequirements, 300);

    var isSubmitting = false;
    async function handleResetSubmit(e) {
      if (e) e.preventDefault();
      if (isSubmitting) return false;

      const password = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const matchError = document.getElementById('matchError');
      const lenError = document.getElementById('lenError');
      const serverError = document.getElementById('serverError');

      if (matchError) matchError.style.display = 'none';
      if (lenError) lenError.style.display = 'none';
      if (serverError) serverError.style.display = 'none';

      if (!password || password.length < 8) {
        if (lenError) lenError.style.display = 'block';
        return false;
      }

      if (password !== confirmPassword) {
        if (matchError) matchError.style.display = 'block';
        return false;
      }

      isSubmitting = true;
      const submitBtn = document.getElementById('submitBtn');
      const btnSpinner = document.getElementById('btnSpinner');
      const btnText = document.getElementById('btnText');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
        submitBtn.style.pointerEvents = 'none';
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.setAttribute('aria-disabled', 'true');
      }
      if (btnSpinner) {
        btnSpinner.style.setProperty('display', 'inline-block', 'important');
      }
      if (btnText) {
        btnText.textContent = 'Updating Password...';
      }

      try {
        const form = document.getElementById('resetForm');
        const tokenInput = form.querySelector('input[name="token"]');
        const tokenVal = tokenInput ? tokenInput.value : '';

        const bodyParams = new URLSearchParams();
        bodyParams.append('token', tokenVal);
        bodyParams.append('newPassword', password);
        bodyParams.append('confirmPassword', confirmPassword);

        const response = await fetch(form.action, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/html'
          },
          body: bodyParams.toString()
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json().catch(() => ({}));
          if (response.ok && data.success !== false) {
            document.getElementById('formCard').style.display = 'none';
            document.getElementById('successCard').style.display = 'block';
          } else {
            throw new Error(data.message || 'Something went wrong. Please try again.');
          }
        } else if (response.ok) {
          const html = await response.text();
          document.open();
          document.write(html);
          document.close();
        } else {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || 'The password reset link has expired or is invalid.');
        }
      } catch (err) {
        if (serverError) {
          serverError.textContent = err.message || 'Something went wrong. Please try again.';
          serverError.style.display = 'block';
        }
        if (btnSpinner) {
          btnSpinner.style.setProperty('display', 'none', 'important');
        }
        if (btnText) {
          btnText.textContent = 'Update Password';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.pointerEvents = 'auto';
          submitBtn.removeAttribute('aria-busy');
          submitBtn.removeAttribute('aria-disabled');
        }
        isSubmitting = false;
      }
      return false;
    }
  </script>
</body>
</html>
`;

const renderStatusPage = ({ success, title, message }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Kevalon ERP</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --success-color: #10b981;
      --error-color: #ef4444;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', sans-serif;
    }

    body {
      background: var(--bg-gradient);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--text-main);
      padding: 20px;
    }

    .container {
      width: 100%;
      max-width: 440px;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 40px 30px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      text-align: center;
      animation: fadeIn 0.5s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .icon-container {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }

    .icon-success {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success-color);
      border: 2px solid rgba(16, 185, 129, 0.3);
    }

    .icon-error {
      background: rgba(239, 68, 68, 0.15);
      color: var(--error-color);
      border: 2px solid rgba(239, 68, 68, 0.3);
    }

    .title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .message {
      font-size: 15px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 30px;
    }

    .btn {
      display: inline-block;
      background: #6366f1;
      color: white;
      text-decoration: none;
      border-radius: 12px;
      padding: 12px 24px;
      font-size: 15px;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .btn:hover {
      background: #4f46e5;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon-container ${success ? "icon-success" : "icon-error"}">
      ${success ? "✓" : "✗"}
    </div>
    <h1 class="title">${title}</h1>
    <p class="message">${message}</p>
    <a href="ktcrm://" class="btn">Open KT-CRM App</a>
  </div>
</body>
</html>
`;

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
  sendOtp: sendOtpController,
  verifyOtp: verifyOtpController,
  verifyEmail,
  resendVerificationEmail,
  listSessions,
  revokeSessionById,
  showResetPasswordForm,
  handleResetPasswordWeb,
};
