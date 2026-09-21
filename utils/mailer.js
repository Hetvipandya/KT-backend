const axios = require("axios");

/**
 * Send registration success email using Brevo Transactional Email API (v3)
 *
 * @param {Object} params
 * @param {string} params.name - User's full name
 * @param {string} params.email - Recipient email address
 * @param {string} params.password - Original plain generated password
 * @param {string} params.role - User role
 * @returns {Promise<{success: boolean, messageId?: string, error?: any}>}
 */
const sendRegistrationEmail = async ({ name, email, password, role }) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const templateId = process.env.BREVO_REGISTRATION_TEMPLATE_ID;

    // 1. Validate BREVO_API_KEY
    if (!apiKey) {
      const errorMsg = "BREVO_API_KEY is not configured in environment variables";
      console.error(`❌ [Brevo Mailer]: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // 2. Validate BREVO_REGISTRATION_TEMPLATE_ID
    if (!templateId || isNaN(Number(templateId))) {
      const errorMsg = "BREVO_REGISTRATION_TEMPLATE_ID is not configured or invalid";
      console.error(`❌ [Brevo Mailer]: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // 3. Validate recipient email
    if (!email || typeof email !== "string" || !email.trim()) {
      const errorMsg = "Recipient email address is required";
      console.error(`❌ [Brevo Mailer]: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const recipientEmail = email.trim();
    const recipientName = name ? name.trim() : recipientEmail;

    // 4. Construct Brevo payload
    const payload = {
      sender: {
        name: process.env.BREVO_SENDER_NAME || "Kevalon Technology",
        email: process.env.BREVO_SENDER_EMAIL || "hr@kevalontechnology.in",
      },
      to: [
        {
          email: recipientEmail,
          name: recipientName,
        },
      ],
      templateId: Number(templateId),
      params: {
        name: recipientName,
        email: recipientEmail,
        password: password || "",
        role: role || "",
        year: new Date().getFullYear(),
      },
    };

    // 5. Call Brevo Transactional Email API
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    const messageId = response.data && response.data.messageId;
    console.log(`Registration email sent successfully to: ${recipientEmail}`);

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    const errorDetails =
      (error.response && error.response.data) || error.message || "Unknown error";
    console.error("❌ [Brevo Mailer Error]:", errorDetails);

    return {
      success: false,
      error: errorDetails,
    };
  }
};

/**
 * Send password recovery email with temporary password using Brevo Transactional Email API (v3)
 *
 * @param {Object} params
 * @param {string} params.name - User's full name
 * @param {string} params.email - Recipient email address
 * @param {string} params.password - Generated plain temporary password
 * @returns {Promise<{success: boolean, messageId?: string, error?: any}>}
 */
const sendForgotPasswordEmail = async ({ name, email, password }) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const templateId = process.env.BREVO_FORGOT_PASSWORD_TEMPLATE_ID;

    // 1. Validate BREVO_API_KEY
    if (!apiKey) {
      const errorMsg = "BREVO_API_KEY is not configured in environment variables";
      console.error(`❌ [Brevo Mailer]: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // 2. Validate BREVO_FORGOT_PASSWORD_TEMPLATE_ID
    if (!templateId || isNaN(Number(templateId))) {
      const errorMsg = "BREVO_FORGOT_PASSWORD_TEMPLATE_ID is not configured or invalid";
      console.error(`❌ [Brevo Mailer]: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // 3. Validate recipient email
    if (!email || typeof email !== "string" || !email.trim()) {
      const errorMsg = "Recipient email address is required";
      console.error(`❌ [Brevo Mailer]: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const recipientEmail = email.trim();
    const recipientName = name ? name.trim() : "";

    // 4. Construct Brevo payload
    const payload = {
      sender: {
        name: process.env.BREVO_SENDER_NAME || "Kevalon Technology",
        email: process.env.BREVO_SENDER_EMAIL || "hr@kevalontechnology.in",
      },
      to: [
        {
          email: recipientEmail,
          name: recipientName,
        },
      ],
      templateId: Number(templateId),
      params: {
        name: recipientName,
        email: recipientEmail,
        password: password || "",
        year: new Date().getFullYear(),
      },
    };

    // 5. Call Brevo Transactional Email API
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    const messageId = response.data && response.data.messageId;
    console.log(`Password recovery email sent successfully to: ${recipientEmail}`);

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    const errorDetails =
      (error.response && error.response.data) || error.message || "Unknown error";
    console.error("❌ [Brevo Mailer Error]:", errorDetails);

    return {
      success: false,
      error: errorDetails,
    };
  }
};

/**
 * Send custom transactional email using Brevo API (v3)
 *
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} [params.name] - Recipient name
 * @param {string} params.subject - Email subject
 * @param {string} params.htmlContent - HTML body content
 * @returns {Promise<{success: boolean, messageId?: string, error?: any}>}
 */
const sendCustomEmail = async ({ to, name, subject, htmlContent }) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      const errorMsg = "BREVO_API_KEY is not configured in environment variables";
      console.error(`❌ [Brevo Mailer]: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    if (!to || typeof to !== "string" || !to.trim()) {
      const errorMsg = "Recipient email address is required";
      console.error(`❌ [Brevo Mailer]: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const payload = {
      sender: {
        name: process.env.BREVO_SENDER_NAME || "Kevalon Technology",
        email: process.env.BREVO_SENDER_EMAIL || "hr@kevalontechnology.in",
      },
      to: [
        {
          email: to.trim(),
          name: name ? name.trim() : to.trim(),
        },
      ],
      subject: subject || "Notification",
      htmlContent: htmlContent,
    };

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    const messageId = response.data && response.data.messageId;
    console.log(`Custom email sent successfully via Brevo to: ${to}`);

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    const errorDetails =
      (error.response && error.response.data) || error.message || "Unknown error";
    console.error("❌ [Brevo Custom Mailer Error]:", errorDetails);

    return {
      success: false,
      error: errorDetails,
    };
  }
};

module.exports = {
  sendRegistrationEmail,
  sendForgotPasswordEmail,
  sendCustomEmail,
};


