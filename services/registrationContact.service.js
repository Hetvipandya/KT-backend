const User = require('../models/User');
const Employee = require('../models/Employee');

const DUPLICATE_CONTACT_MESSAGE =
  'Email address or mobile number is already registered';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const makePhonePattern = (phone) => {
  const digits = normalizePhone(phone);
  return digits
    ? new RegExp(`^\\D*${digits.split('').join('\\D*')}\\D*$`)
    : null;
};

const getContactQuery = ({ email, phone }) => {
  const conditions = [];
  const normalizedEmail = normalizeEmail(email);
  const phonePattern = makePhonePattern(phone);

  if (normalizedEmail) {
    conditions.push({
      email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i'),
    });
  }
  if (phonePattern) {
    conditions.push(
      { phoneNumber: phonePattern },
      { phone: phonePattern },
      { mobile: phonePattern },
    );
  }

  return conditions.length ? { $or: conditions } : null;
};

const getDocumentPhone = (document) =>
  document.phoneNumber || document.phone || document.mobile || '';

const contactsMatch = (document, { email, phone }) =>
  (!normalizeEmail(email) ||
    normalizeEmail(document.email) === normalizeEmail(email)) &&
  (!normalizePhone(phone) ||
    normalizePhone(getDocumentPhone(document)) === normalizePhone(phone));

const assertRegistrationContactUnique = async ({
  email,
  phone,
  allowLinkedUserId,
  allowMatchingUser = false,
}) => {
  const query = getContactQuery({ email, phone });
  if (!query) return;

  const [existingUser, existingEmployee] = await Promise.all([
    User.findOne(query),
    Employee.findOne(query),
  ]);

  const linkedUserIsSame =
    existingUser &&
    allowLinkedUserId &&
    String(existingUser._id) === String(allowLinkedUserId) &&
    contactsMatch(existingUser, { email, phone });
  const matchingUserCanBeLinked =
    existingUser &&
    allowMatchingUser &&
    contactsMatch(existingUser, { email, phone });

  if (
    (existingUser && !linkedUserIsSame && !matchingUserCanBeLinked) ||
    existingEmployee
  ) {
    const error = new Error(DUPLICATE_CONTACT_MESSAGE);
    error.statusCode = 409;
    error.errorCode = 'DUPLICATE_CONTACT';
    throw error;
  }
};

module.exports = {
  assertRegistrationContactUnique,
  DUPLICATE_CONTACT_MESSAGE,
  normalizeEmail,
  normalizePhone,
};
