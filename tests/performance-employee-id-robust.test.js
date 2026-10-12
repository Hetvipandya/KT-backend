const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const EmployeePerformance = require('../models/EmployeePerformance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const performanceRoutes = require('../routes/performanceRoutes');

describe('Performance by Employee ID - Robust Endpoint Testing', () => {
  let app;
  let employeeDocId;
  let userDocId;
  let hrUser;
  let teamLeadUser;
  let regularEmpUser;

  beforeAll(() => {
    employeeDocId = new mongoose.Types.ObjectId();
    userDocId = new mongoose.Types.ObjectId();

    hrUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'HR Manager',
      email: 'hr@kevalon.com',
      role: 'hr',
    };

    teamLeadUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Team Lead',
      email: 'tl@kevalon.com',
      role: 'team lead',
    };

    // User document for regular employee
    regularEmpUser = {
      _id: userDocId,
      name: 'Hetvi Employee',
      email: 'hetvi@kevalon.com',
      role: 'employee',
      uniqueID: 'EMP-101',
    };
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('Employee can view their own performance using Employee document ID (self-access link)', async () => {
    const mockRecord = {
      _id: new mongoose.Types.ObjectId(),
      employeeID: employeeDocId,
      employeeName: 'Hetvi Employee',
      performancePercentage: 95,
      rating: 9,
      feedback: 'Outstanding work',
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([mockRecord]),
    };
    jest.spyOn(EmployeePerformance, 'find').mockReturnValue(mockQuery);

    // Mock Employee lookup that links userDocId to employeeDocId
    jest.spyOn(Employee, 'findOne').mockResolvedValue({
      _id: employeeDocId,
      userId: userDocId,
      employeeID: 'EMP-101',
      employeeCode: 'EMP-101',
      email: 'hetvi@kevalon.com',
    });

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = regularEmpUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app).get(`/api/performance/employee/${employeeDocId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].performancePercentage).toBe(95);
    expect(res.body.performance.feedback).toBe('Outstanding work');
  });

  test('Root endpoint supports ?employeeId= query param (/api/performance?employeeId=xxx)', async () => {
    const mockRecord = {
      _id: new mongoose.Types.ObjectId(),
      employeeID: employeeDocId,
      employeeName: 'Hetvi Employee',
      performancePercentage: 92,
      rating: 9,
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

    const res = await request(app).get(`/api/performance?employeeId=${employeeDocId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].performancePercentage).toBe(92);
  });

  test('Alias route /api/performance/by-employee/:employeeId works properly', async () => {
    const mockRecord = {
      _id: new mongoose.Types.ObjectId(),
      employeeID: employeeDocId,
      employeeName: 'Hetvi Employee',
      performancePercentage: 88,
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([mockRecord]),
    };
    jest.spyOn(EmployeePerformance, 'find').mockReturnValue(mockQuery);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = teamLeadUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app).get(`/api/performance/by-employee/${employeeDocId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].performancePercentage).toBe(88);
  });

  test('Alias route /api/performance/get-by-employee-id/:employeeId works properly', async () => {
    const mockRecord = {
      _id: new mongoose.Types.ObjectId(),
      employeeID: employeeDocId,
      employeeName: 'Hetvi Employee',
      performancePercentage: 89,
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

    const res = await request(app).get(`/api/performance/get-by-employee-id/${employeeDocId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].performancePercentage).toBe(89);
  });

  test('Querying with custom string code (e.g. EMP-101) does not crash and resolves via Employee model', async () => {
    const mockRecord = {
      _id: new mongoose.Types.ObjectId(),
      employeeID: employeeDocId,
      employeeName: 'Hetvi Employee',
      performancePercentage: 91,
    };

    jest.spyOn(Employee, 'findOne').mockResolvedValue({
      _id: employeeDocId,
      employeeID: 'EMP-101',
      userId: userDocId,
    });

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

    const res = await request(app).get('/api/performance/employee/EMP-101');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].performancePercentage).toBe(91);
  });

  test('Team Lead can fetch performance by ID route (/api/performance/:id)', async () => {
    const mockRecord = {
      _id: new mongoose.Types.ObjectId(),
      employeeID: employeeDocId,
      employeeName: 'Hetvi Employee',
      performancePercentage: 94,
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(mockRecord),
    };
    jest.spyOn(EmployeePerformance, 'findOne').mockReturnValue(mockQuery);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = teamLeadUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app).get(`/api/performance/${employeeDocId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.performancePercentage).toBe(94);
    expect(res.body.performance.performancePercentage).toBe(94);
  });
});
