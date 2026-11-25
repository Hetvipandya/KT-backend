jest.mock('../models/User', () => ({
  findOne: jest.fn(),
}));

jest.mock('../models/Employee', () => ({
  findOne: jest.fn(),
}));

const User = require('../models/User');
const Employee = require('../models/Employee');
const {
  assertRegistrationContactUnique,
  DUPLICATE_CONTACT_MESSAGE,
} = require('../services/registrationContact.service');

describe('registration contact uniqueness', () => {
  beforeEach(() => {
    User.findOne.mockResolvedValue(null);
    Employee.findOne.mockResolvedValue(null);
  });

  test('rejects an email already used by a user, case-insensitively', async () => {
    User.findOne.mockResolvedValue({
      _id: 'existing-user',
      email: 'person@example.com',
      phoneNumber: '+15551234567',
    });

    await expect(
      assertRegistrationContactUnique({
        email: ' PERSON@EXAMPLE.COM ',
        phone: '+15551234567',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'DUPLICATE_CONTACT',
      message: DUPLICATE_CONTACT_MESSAGE,
    });
  });

  test('rejects a mobile number already used by an employee with different formatting', async () => {
    Employee.findOne.mockResolvedValue({
      _id: 'existing-employee',
      email: 'other@example.com',
      phoneNumber: '+1 (555) 123-4567',
    });

    await expect(
      assertRegistrationContactUnique({
        email: 'new@example.com',
        phone: '+15551234567',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'DUPLICATE_CONTACT',
    });
  });

  test('allows the existing user only when an employee is explicitly linked to that user', async () => {
    User.findOne.mockResolvedValue({
      _id: 'linked-user',
      email: 'person@example.com',
      phoneNumber: '+15551234567',
    });

    await expect(
      assertRegistrationContactUnique({
        email: 'person@example.com',
        phone: '+1 555 123 4567',
        allowLinkedUserId: 'linked-user',
      }),
    ).resolves.toBeUndefined();
  });

  test('rejects the same contact when it belongs to a different user', async () => {
    User.findOne.mockResolvedValue({
      _id: 'existing-user',
      email: 'person@example.com',
      phoneNumber: '+15551234567',
    });

    await expect(
      assertRegistrationContactUnique({
        email: 'person@example.com',
        phone: '+15551234567',
        allowLinkedUserId: 'another-user',
      }),
    ).rejects.toMatchObject({ errorCode: 'DUPLICATE_CONTACT' });
  });
});
