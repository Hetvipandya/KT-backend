const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const EmployeePerformance = require('../models/EmployeePerformance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const performanceRoutes = require('../routes/performanceRoutes');

describe('Get Performance by Employee ID API Routes', () => {
  let app;
  let employeeId;
  let hrUser;
  let regularEmpUser;
  let otherEmpUser;

  beforeAll(() => {
    employeeId = new mongoose.Types.ObjectId();

    hrUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'HR User',
      email: 'hr@kevalon.com',
      role: 'hr',
    };

    regularEmpUser = {
      _id: employeeId,
      name: 'Regular Employee',
      email: 'emp@kevalon.com',
      role: 'employee',
      employeeID: employeeId,
    };

    otherEmpUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Other Employee',
      email: 'other@kevalon.com',
      role: 'employee',
    };
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('HR can get performance by employeeId param (/api/performance/employee/:employeeId)', async () => {
    const mockRecord = {
      _id: new mongoose.Types.ObjectId(),
      employeeID: employeeId,
      employeeName: 'Regular Employee',
      performancePercentage: 90,
      rating: 9,
      feedback: 'Excellent work',
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([mockRecord]),
    };
    jest.spyOn(EmployeePerformance, 'find').mockReturnValue(mockQuery);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = hrUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app).get(`/api/performance/employee/${employeeId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].performancePercentage).toBe(90);
    expect(res.body.performance.feedback).toBe('Excellent work');
  });

  test('HR can get performance by user ID param (/api/performance/user/:userId)', async () => {
    const mockRecord = {
      _id: new mongoose.Types.ObjectId(),
      employeeID: employeeId,
      employeeName: 'Regular Employee',
      performancePercentage: 88,
      rating: 8,
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([mockRecord]),
    };
    jest.spyOn(EmployeePerformance, 'find').mockReturnValue(mockQuery);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = hrUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app).get(`/api/performance/user/${employeeId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.performance.performancePercentage).toBe(88);
  });

  test('HR can get performance via query parameter (/api/performance/employee?employeeId=xxx)', async () => {
    const mockRecord = {
      _id: new mongoose.Types.ObjectId(),
      employeeID: employeeId,
      employeeName: 'Regular Employee',
      performancePercentage: 92,
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([mockRecord]),
    };
    jest.spyOn(EmployeePerformance, 'find').mockReturnValue(mockQuery);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = hrUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app).get(`/api/performance/employee?employeeId=${employeeId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].performancePercentage).toBe(92);
  });

  test('Employee can get their own performance (/api/performance/my-performance)', async () => {
    const mockRecord = {
      _id: new mongoose.Types.ObjectId(),
      employeeID: employeeId,
      employeeName: 'Regular Employee',
      performancePercentage: 85,
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([mockRecord]),
    };
    jest.spyOn(EmployeePerformance, 'find').mockReturnValue(mockQuery);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = regularEmpUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app).get('/api/performance/my-performance');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.performance.performancePercentage).toBe(85);
  });

  test('Employee cannot view another employee performance (returns HTTP 403)', async () => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = otherEmpUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app).get(`/api/performance/employee/${employeeId}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Access restricted');
  });
});
