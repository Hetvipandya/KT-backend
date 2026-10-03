jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/FinanceUser', () => ({
  findOne: jest.fn(),
}));

jest.mock('../utils/jwt', () => ({
  verifyAccessToken: jest.fn(),
}));

const User = require('../models/User');
const FinanceUser = require('../models/FinanceUser');
const { verifyAccessToken } = require('../utils/jwt');
const authenticate = require('../middleware/authenticate');

describe('authenticate finance user merge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves the real user id while merging finance user access data', async () => {
    const userId = '64f0a2c1c4b8d30000000001';
    const financeUserId = '64f0a2c1c4b8d30000000099';

    verifyAccessToken.mockReturnValue({ userId });
    User.findById.mockResolvedValue({
      _id: userId,
      email: 'owner@example.com',
      role: 'admin',
      companyCreated: true,
      companyId: null,
      companyAccess: [],
    });
    FinanceUser.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: financeUserId,
        userId,
        companyId: '64f0a2c1c4b8d30000000002',
        branchId: '64f0a2c1c4b8d30000000003',
        companyAccess: [
          {
            companyId: '64f0a2c1c4b8d30000000002',
            branchId: '64f0a2c1c4b8d30000000003',
            role: 'Admin',
            isActive: true,
          },
        ],
        role: 'Admin',
        companyCreated: false,
      }),
    });

    const req = {
      headers: { authorization: 'Bearer test-token' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(req.user._id.toString()).toBe(userId);
    expect(req.user.companyAccess).toHaveLength(1);
    expect(req.user.companyAccess[0].companyId.toString()).toBe('64f0a2c1c4b8d30000000002');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
