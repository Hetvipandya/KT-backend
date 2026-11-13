jest.mock('../models/Company', () => ({
  findById: jest.fn(),
}));
jest.mock('../services/journalEntry.service', () => ({
  createJournalEntry: jest.fn(),
  getJournalEntry: jest.fn(),
  reverseJournalEntry: jest.fn(),
}));

const Company = require('../models/Company');
const journalService = require('../services/journalEntry.service');
const controller = require('../controllers/journalEntry.controller');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const USER_ID = '6ac8a921e6b91ab589aa3002';

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('Journal entry source controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Company.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ createdBy: USER_ID }),
    });
  });

  test('marks directly created journal entries as manual regardless of request data', async () => {
    journalService.createJournalEntry.mockResolvedValue({ _id: 'entry-id' });
    const req = {
      body: { companyId: COMPANY_ID, entrySource: 'AUTOMATIC' },
      branchId: 'branch-id',
      user: { _id: USER_ID },
    };
    const res = createResponse();

    await controller.createJournalEntry(req, res, jest.fn());

    expect(journalService.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ entrySource: 'MANUAL', branchId: 'branch-id' }),
      USER_ID
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('does not allow the manual endpoint to reverse an automatic entry', async () => {
    journalService.getJournalEntry.mockResolvedValue({
      _id: 'automatic-entry',
      companyId: COMPANY_ID,
      entrySource: 'AUTOMATIC',
    });
    const req = { params: { id: 'automatic-entry' }, user: { _id: USER_ID, role: 'admin', companyAccess: [] } };
    const res = createResponse();

    await controller.reverseJournalEntry(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(journalService.reverseJournalEntry).not.toHaveBeenCalled();
  });
});
