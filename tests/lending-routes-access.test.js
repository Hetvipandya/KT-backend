jest.mock('../middleware/authenticate', () => (req, res, next) => {
  req.user = { _id: 'user-id' };
  next();
});
jest.mock('../middleware/companyAccess', () => jest.fn((req, res, next) => {
  req.authorizedLendingId = req.params.id;
  next();
}));
jest.mock('../middleware/validateRequest', () => jest.fn(() => (req, res, next) => next()));
jest.mock('../validators/lending.validators', () => ({
  createLendingSchema: {},
  createLendingRepaymentSchema: {},
  lendingQuerySchema: {},
  validateQuery: jest.fn(() => (req, res, next) => next()),
}));
jest.mock('../controllers/lending.controller', () => ({
  create: (req, res) => res.status(201).send('created'),
  list: (req, res) => res.send('listed'),
  get: (req, res) => res.json({ id: req.authorizedLendingId }),
  repay: (req, res) => res.json({ id: req.authorizedLendingId }),
}));

const express = require('express');
const request = require('supertest');
const router = require('../routes/lending.routes');
const checkCompanyAccess = require('../middleware/companyAccess');

const app = express();
app.use(express.json());
app.use('/api/lending', router);

describe('Lending route access context', () => {
  beforeEach(() => {
    checkCompanyAccess.mockClear();
  });

  test.each([
    ['GET', '/api/lending/lending-id'],
    ['POST', '/api/lending/lending-id/repayments'],
  ])('%s route passes the lending ID to company access', async (method, path) => {
    const response = await request(app)[method.toLowerCase()](path);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('lending-id');
    expect(checkCompanyAccess).toHaveBeenCalledTimes(1);
    expect(checkCompanyAccess.mock.calls[0][0].params.id).toBe('lending-id');
  });
});
