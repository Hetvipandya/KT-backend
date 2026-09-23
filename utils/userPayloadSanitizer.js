const PASSWORD_FIELDS = new Set([
  "password",
  "passwordHash",
  "plainPassword",
  "oldPassword",
  "currentPassword",
  "newPassword",
  "confirmPassword",
]);

function sanitizeUserUpdatePayload(payload = {}) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const cleaned = { ...payload };

  for (const field of PASSWORD_FIELDS) {
    delete cleaned[field];
  }

  return cleaned;
}

module.exports = sanitizeUserUpdatePayload;
module.exports.PASSWORD_FIELDS = PASSWORD_FIELDS;
