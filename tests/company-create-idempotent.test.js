const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Company = require('../models/Company');
const Employee = require('../models/Employee');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
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

  it('allows HR tokens to retrieve default/unassigned companies without explicit companyId on user', async () => {
    const hr = await User.create({
      name: 'Global HR',
      email: 'global-hr@example.com',
      phoneNumber: '9000000205',
      password: 'Password123!',
      role: 'hr'
    });
    const defaultCompany = await Company.create({
      name: 'Global Default Company',
      gstin: '27ABCDE1234F1Z7',
      pan: 'ABCDE1234H'
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
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data.map(({ _id }) => _id.toString())).toContain(defaultCompany._id.toString());
  });

  it('allows HR tokens to retrieve companies created by admin when HR has null companyId and auto-links companyId', async () => {
    const admin = await User.create({
      name: 'System Admin',
      email: 'sys-admin@example.com',
      phoneNumber: '9000000206',
      password: 'Password123!',
      role: 'admin'
    });
    const hr = await User.create({
      name: 'Independent HR',
      email: 'indep-hr@example.com',
      phoneNumber: '9000000207',
      password: 'Password123!',
      role: 'hr',
      companyId: null
    });
    const company = await Company.create({
      name: 'Admin Created Enterprise',
      gstin: '24BQSPH0154B1Z8',
      pan: 'BQSPH0154A',
      createdBy: admin._id
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
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data.map(({ _id }) => _id.toString())).toContain(company._id.toString());

    // Verify user was auto-linked to the company
    const updatedUser = await User.findById(hr._id);
    expect(updatedUser.companyId).toBeDefined();
    expect(updatedUser.companyId.toString()).toBe(company._id.toString());
  });
});

describe('PUT /api/company/:id profile updates', () => {
  it('updates company fields, clears optional tax details, and keeps legacy aliases in sync', async () => {
    const admin = await User.create({
      name: 'Profile Admin',
      email: 'profile-admin@example.com',
      password: 'Password123!',
      role: 'admin'
    });
    const company = await Company.create({
      name: 'Old Company Name',
      companyName: 'Old Company Name',
      gstin: '27ABCDE1234F1Z5',
      gstNumber: '27ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      panNumber: 'ABCDE1234F',
      createdBy: admin._id
    });

    const app = express();
    app.use(express.json());
    app.use('/api/company', companyRoutes);

    const token = generateAccessToken({
      userId: admin._id.toString(),
      role: admin.role
    });
    const response = await request(app)
      .put(`/api/company/${company._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Company Name',
        gstin: '',
        pan: '',
        logoUrl: '',
        workingHours: {
          startTime: '09:00 AM',
          endTime: '06:00 PM'
        },
        weeklyOff: ['Sunday']
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const updatedCompany = await Company.findById(company._id);
    expect(updatedCompany.name).toBe('Updated Company Name');
    expect(updatedCompany.companyName).toBe('Updated Company Name');
    expect(updatedCompany.gstin).toBe('');
    expect(updatedCompany.gstNumber).toBe('');
    expect(updatedCompany.pan).toBe('');
    expect(updatedCompany.panNumber).toBe('');
    expect(updatedCompany.logoUrl).toBe('');
    expect(updatedCompany.companyLogo).toBe('');
    expect(updatedCompany.workingHours.startTime).toBe('09:00 AM');
    expect(updatedCompany.workingHours.endTime).toBe('06:00 PM');
    expect(updatedCompany.weeklyOff).toEqual(['Sunday']);

    const auditLog = await AuditLog.findOne({ entityId: company._id.toString() });
    expect(auditLog.oldValues.name).toBe('Old Company Name');
    expect(auditLog.newValues.name).toBe('Updated Company Name');
  });

  it('uploads a company logo and synchronizes its legacy logo field', async () => {
    const admin = await User.create({
      name: 'Logo Admin',
      email: 'logo-admin@example.com',
      password: 'Password123!',
      role: 'admin'
    });
    const company = await Company.create({
      name: 'Logo Company',
      logoUrl: 'https://example.com/old-logo.png',
      companyLogo: 'https://example.com/old-logo.png',
      createdBy: admin._id
    });
    const cloudinaryService = require('../services/cloudinary.service');
    const uploadLogo = jest.spyOn(cloudinaryService, 'uploadCompanyLogo')
      .mockResolvedValue({ secure_url: 'https://example.com/new-logo.png' });

    const app = express();
    app.use('/api/company', companyRoutes);
    const token = generateAccessToken({
      userId: admin._id.toString(),
      role: admin.role
    });

    try {
      const response = await request(app)
        .post(`/api/company/${company._id}/logo`)
        .set('Authorization', `Bearer ${token}`)
        .attach('logo', Buffer.from('fake image'), {
          filename: 'company-logo.png',
          contentType: 'image/png'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.logoUrl).toBe('https://example.com/new-logo.png');
      expect(response.body.data.companyLogo).toBe('https://example.com/new-logo.png');

      const updatedCompany = await Company.findById(company._id);
      expect(updatedCompany.logoUrl).toBe('https://example.com/new-logo.png');
      expect(updatedCompany.companyLogo).toBe('https://example.com/new-logo.png');
    } finally {
      uploadLogo.mockRestore();
    }
  });
});

