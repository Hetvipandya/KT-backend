const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Branch = require('../models/Branch');
const Company = require('../models/Company');
const FinancialYear = require('../models/FinancialYear');
const User = require('../models/User');
const financialYearRoutes = require('../routes/financialYear.routes');
const { generateAccessToken } = require('../utils/jwt');

let mongoServer;
let app;
let user;
let branch;
let token;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = express();
  app.use(express.json());
  app.use('/api/financial-year', financialYearRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    Branch.deleteMany({}),
    Company.deleteMany({}),
    FinancialYear.deleteMany({}),
    User.deleteMany({})
  ]);
  user = await User.create({
    name: 'Finance Admin',
    email: `finance-admin-${Date.now()}@example.com`,
    password: 'Password123!',
    role: 'admin'
  });
  const company = await Company.create({ name: 'Finance Test Company', createdBy: user._id });
  branch = await Branch.create({ companyId: company._id, branchName: 'Main Office' });
  token = generateAccessToken({ userId: user._id.toString(), role: 'admin' });
});

const createFinancialYear = (overrides = {}) => FinancialYear.create({
  companyId: branch.companyId,
  branchId: branch._id,
  yearLabel: '2025-26',
  startDate: new Date('2025-04-01T00:00:00.000Z'),
  endDate: new Date('2026-03-31T00:00:00.000Z'),
  ...overrides
});

describe('Financial year update API', () => {
  it('updates an unlocked financial year', async () => {
    const financialYear = await createFinancialYear();

    const response = await request(app)
      .put(`/api/financial-year/${financialYear._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ yearLabel: 'FY 2025-26', status: 'inactive' });

    expect(response.status).toBe(200);
    expect(response.body.data.yearLabel).toBe('FY 2025-26');
    expect(response.body.data.status).toBe('inactive');
  });

  it('rejects a date range that overlaps another financial year on the branch', async () => {
    const financialYear = await createFinancialYear();
    await createFinancialYear({
      yearLabel: '2026-27',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T00:00:00.000Z')
    });

    const response = await request(app)
      .put(`/api/financial-year/${financialYear._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ endDate: '2026-06-30' });

    expect(response.status).toBe(409);
    expect(response.body.errorCode).toBe('FINANCIAL_YEAR_OVERLAP');
  });

  it('does not allow a locked financial year to be changed', async () => {
    const financialYear = await createFinancialYear({ isLocked: true });

    const response = await request(app)
      .put(`/api/financial-year/${financialYear._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ yearLabel: 'Changed label' });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('FINANCIAL_YEAR_LOCKED');
  });
});
