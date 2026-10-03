const User = require('../models/User');
const { hashPassword } = require('../utils/hash');
const { changePassword } = require('../controllers/auth.controller');

describe('auth changePassword compatibility across panels', () => {
  it('rejects a wrong oldPassword even when currentPassword is not supplied', async () => {
    const passwordHash = await hashPassword('CorrectPass123');
    const user = {
      _id: 'user-123',
      passwordHash,
      password: passwordHash,
      mustChangePassword: false,
      isFirstLogin: false,
      save: jest.fn().mockResolvedValue(true),
    };

    jest.spyOn(User, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const req = {
      user: { _id: 'user-123' },
      body: {
        oldPassword: 'WrongPass999',
        newPassword: 'NewPass456',
        confirmPassword: 'NewPass456',
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await changePassword(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Current password is invalid',
      }),
    );

    User.findById.mockRestore();
  });
});
