const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Extract 10-digit PAN number from 15-character Indian GSTIN
 * GSTIN structure: 2 digits (State Code) + 10 chars (PAN) + 1 char (Entity) + 'Z' + 1 char (Checksum)
 * @param {string} gstin 
 * @returns {string|null} Extracted PAN or null if invalid
 */
const extractPanFromGstin = (gstin) => {
  if (!gstin || typeof gstin !== 'string') return null;
  const cleanGstin = gstin.trim().toUpperCase();
  if (cleanGstin.length >= 12) {
    const pan = cleanGstin.substring(2, 12);
    if (panRegex.test(pan)) {
      return pan;
    }
  }
  return null;
};

module.exports = {
  panRegex,
  gstinRegex,
  extractPanFromGstin
};
