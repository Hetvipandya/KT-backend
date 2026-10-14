const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Company = require('../models/Company');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Department = require('../models/Department');
const companyRoutes = require('../routes/company.routes');
const { createCompany } = require('../controllers/company.controller');
const { generateAccessToken } = require('../utils/jwt');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    Company.deleteMany({}),
    User.deleteMany({})
  ]);
});

describe('company creation idempotency', () => {
  it('returns the existing company for the same user instead of rejecting a retry', async () => {
    const user = await User.create({
      name: 'Test User',
      email: 'testuser@example.com',
      password: 'Password123!',
      role: 'admin'
    });

    const existingCompany = await Company.create({
      name: 'Kevalon Labs',
      gstin: '27ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      createdBy: user._id
    });

    const req = {
      user: { _id: user._id, role: 'admin' },
      body: {
        name: 'Kevalon Labs',
        gstin: '27ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: 'Ahmedabad',
        city: 'Ahmedabad',
        state: 'Gujarat',
        country: 'India',
        email: 'testuser@example.com',
        phone: '9876543210'
      }
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await createCompany(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          _id: existingCompany._id,
          createdBy: user._id
        })
      })
    );
  });
});

describe('GET /api/company authorization', () => {
  it('allows admin and HR tokens to retrieve their available companies', async () => {
    const admin = await User.create({
      name: 'Company Admin',
      email: 'company-admin@example.com',
      phoneNumber: '9000000201',
      password: 'Password123!',
      role: 'admin'
    });
    const hr = await User.create({
      name: 'Company HR',
      email: 'company-hr@example.com',
      phoneNumber: '9000000202',
      password: 'Password123!',
      role: 'hr'
    });
    const employee = await User.create({
      name: 'Company Employee',
      email: 'company-employee@example.com',
      phoneNumber: '9000000203',
      password: 'Password123!',
      role: 'employee'
    });
    const company = await Company.create({
      name: 'Accessible Company',
      gstin: '27ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      createdBy: admin._id
    });
    await Employee.create({
      companyId: company._id,
      userID: hr._id,
      email: hr.email,
      name: hr.name
    });

    const app = express();
    app.use('/api/company', companyRoutes);

    for (const user of [admin, hr]) {
      const token = generateAccessToken({
        userId: user._id.toString(),
        role: user.role
      });
      const response = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.map(({ _id }) => _id)).toContain(company._id.toString());
    }

    const employeeToken = generateAccessToken({
      userId: employee._id.toString(),
      role: employee.role
    });
    const deniedResponse = await request(app)
      .get('/api/company')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(deniedResponse.status).toBe(403);
  });

  it('allows department HR users to retrieve companies tied to their department', async () => {
    const hr = await User.create({
      name: 'Department HR',
      email: 'department-hr@example.com',
      phoneNumber: '9000000204',
      password: 'Password123!',
      role: 'hr'
    });
    const company = await Company.create({
      name: 'Department Company',
      gstin: '27ABCDE1234F1Z6',
      pan: 'ABCDE1234G',
      createdBy: hr._id
    });
    await Department.create({
      companyId: company._id,
      departmentName: 'Human Resources',
      name: 'Human Resources',
      departmentHead: hr._id,
      status: true,
      isActive: true
    });

    const app = express();
    app.use('/api/company', companyRoutes);

    const token = generateAccessToken({
      userId: hr._id.toString(),
      role: hr.role
    });
    const response = await request(app)
      .get('/api/company')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.map(({ _id }) => _id.toString())).toContain(company._id.toString());
  });
});
