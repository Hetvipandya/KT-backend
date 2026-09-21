const nodemailer = require('nodemailer');
const env = require('../config/env');
const pino = require('pino');
const { sendCustomEmail } = require('../utils/mailer');
const {
  buildInviteEmailContent,
  buildTemporaryPasswordEmailContent
} = require('./email.templates');

const logger = pino({
  transport: (process.env.NODE_ENV || 'development') === 'development' ? { target: 'pino-pretty' } : undefined
});

let transporter = null;
const isEmailJsConfigured = Boolean(
  process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY
);

// Initialize Nodemailer transporter if SMTP config or EMAIL_USER is present
if (!isEmailJsConfigured && process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Send an email through EmailJS's REST API.
 */
const sendWithEmailJs = async ({ to, subject, text, html, templateParams = {} }) => {
  const primaryLink = templateParams.reset_link || templateParams.link || templateParams.url || templateParams.action_url || templateParams.button_url || templateParams.invite_link || templateParams.reset_url || templateParams.reset_password_url || templateParams.password_reset_url || templateParams.link_url || '';
  const primaryCompany = templateParams.company_name || templateParams.company || templateParams.app_name || templateParams.site_name || 'Kevalon Technology';

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      ...(process.env.EMAILJS_PRIVATE_KEY ? { accessToken: process.env.EMAILJS_PRIVATE_KEY } : {}),
      template_params: {
        to_email: to,
        email: to,
        to_name: to.split('@')[0],
        subject,
        message: text,
        html_content: html,
        link: primaryLink,
        reset_link: primaryLink,
        invite_link: primaryLink,
        url: primaryLink,
        reset_url: primaryLink,
        action_url: primaryLink,
        button_url: primaryLink,
        password_reset_link: primaryLink,
        reset_password_link: primaryLink,
        password_reset_url: primaryLink,
        reset_password_url: primaryLink,
        link_url: primaryLink,
        reset_link_url: primaryLink,
        target_url: primaryLink,
        company_name: primaryCompany,
        company: primaryCompany,
        app_name: primaryCompany,
        site_name: primaryCompany,
        service_name: primaryCompany,
        ...templateParams
      }
    })
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`EmailJS request failed (${response.status}): ${responseText}`);
  }

  logger.info(`Email sent successfully through EmailJS to ${to}`);
  return { messageId: responseText || 'emailjs-sent', provider: 'emailjs', success: true };
};

/**
 * Send email (EmailJS -> Brevo -> Nodemailer -> Mock simulation)
 */
const sendEmail = async ({ to, subject, text, html, templateParams = {} }) => {
  if (isEmailJsConfigured) {
    try {
      return await sendWithEmailJs({ to, subject, text, html, templateParams });
    } catch (error) {
      logger.error(`EmailJS failed to send email to ${to}: ${error.message}`);
      if (process.env.NODE_ENV === 'test') {
        return { messageId: 'emailjs-fallback-id', preview: true, error: error.message };
      }
    }
  }

  // Try Brevo if configured
  if (process.env.BREVO_API_KEY) {
    try {
      const result = await sendCustomEmail({ to, subject, htmlContent: html || text });
      if (result && result.success) return result;
    } catch (err) {
      logger.warn(`Brevo email failed: ${err.message}`);
    }
  }

  // Try Nodemailer
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"${process.env.BREVO_SENDER_NAME || 'Kevalon Technology'}" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html
      });
      logger.info(`📧 Email sent successfully to ${to}. Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`❌ SMTP transport failed to send email to ${to}: ${error.message}`);
    }
  }

  logger.info(`📧 [MOCK EMAIL] To: ${to} | Subject: ${subject}`);
  return { success: true, messageId: 'mock-id-12345', preview: true, simulated: true };
};

/**
 * Send email verification link
 */
const sendVerificationEmail = async (toEmail, plainToken) => {
  const verifyLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${plainToken}`;
  const { subject, text, html } = buildInviteEmailContent('Kevalon Technology', verifyLink);
  return sendEmail({ to: toEmail, subject, text, html });
};

/**
 * Send invite link
 */
const sendInviteEmail = async (toEmail, plainToken, inviterCompanyName, baseUrl) => {
  let base = baseUrl;
  if (!base || base.includes('undefined')) {
    base = process.env.PUBLIC_URL || process.env.BACKEND_URL || process.env.CLIENT_URL || 'http://localhost:5000';
  }
  base = String(base).trim().replace(/\/+$/, '');
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }

  const inviteLink = `${base}/api/auth/reset-password?token=${plainToken}`;
  const company = inviterCompanyName || 'Kevalon Technology';
  const { subject, text, html } = buildInviteEmailContent(company, inviteLink);

  return sendEmail({
    to: toEmail,
    subject,
    text,
    html,
    templateParams: {
      reset_link: inviteLink,
      link: inviteLink,
      company_name: company,
      website_link: base
    }
  });
};

/**
 * Send temporary password email
 */
const sendTemporaryPasswordEmail = async (toEmail, temporaryPassword, inviterCompanyName) => {
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const company = inviterCompanyName || 'Kevalon Technology';
  const { subject, text, html } = buildTemporaryPasswordEmailContent(
    company,
    toEmail,
    temporaryPassword,
    loginUrl
  );
  return sendEmail({ to: toEmail, subject, text, html });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendInviteEmail,
  sendTemporaryPasswordEmail,
};
