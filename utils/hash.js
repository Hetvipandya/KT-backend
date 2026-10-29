const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Hash a password using bcrypt
 * @param {string} password 
 * @returns {Promise<string>}
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, 10);
};

/**
 * Compare a plain password with a bcrypt hash
 * @param {string} password 
 * @param {string} hash 
 * @returns {Promise<boolean>}
 */
const comparePassword = async (password, hash) => {
  const normalizedHash = typeof hash === "string" && hash.startsWith("$2y$")
    ? hash.replace("$2y$", "$2b$")
    : hash;
  return bcrypt.compare(String(password), normalizedHash);
};

/**
 * Hash a plain string (like OTP, Refresh Token, Reset Token) using SHA-256
 * @param {string} str 
 * @returns {string}
 */
const hashSha256 = (str) => {
  if (!str) return '';
  return crypto.createHash('sha256').update(str).digest('hex');
};

module.exports = {
  hashPassword,
  comparePassword,
  hashSha256
};
