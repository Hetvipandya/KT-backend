const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const EmployeePerformance = require('../models/EmployeePerformance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const performanceRoutes = require('../routes/performanceRoutes');

describe('Team Lead Employee Feedback & Restricted Performance Access', () => {
  let app;
  let employeeId;
  let teamLeadUser;
  let hrUser;
  let regularEmpUser;

  beforeAll(() => {
    employeeId = new mongoose.Types.ObjectId();
    
    teamLeadUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Team Lead User',
      email: 'tl@kevalon.com',
      role: 'team lead',
    };

    hrUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'HR User',
      email: 'hr@kevalon.com',
      role: 'hr',
    };

    regularEmpUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Regular Employee',
      email: 'emp@kevalon.com',
      role: 'employee',
    };
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('allows Team Lead to submit performance feedback for an employee', async () => {
    const TeamLead = require('../models/Team');
    const TeamLeadActivity = require('../models/TeamLeadActivity');
    jest.spyOn(TeamLead, 'findOne').mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(TeamLeadActivity, 'create').mockResolvedValue({});

    // Mock Employee lookup
    jest.spyOn(Employee, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: employeeId,
        name: 'John Doe',
        email: 'john@kevalon.com',
        firstName: 'John',
        lastName: 'Doe',
      }),
    });

    jest.spyOn(EmployeePerformance, 'findOne').mockResolvedValue(null);
    jest.spyOn(EmployeePerformance, 'create').mockImplementation(async (data) => ({
      _id: new mongoose.Types.ObjectId(),
      ...data,
      createdAt: new Date(),
    }));

    app = express();
    app.use(express.json());
    // Attach mock team lead user to request
    app.use((req, res, next) => {
      req.user = teamLeadUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app)
      .post('/api/performance/feedback')
      .send({
        employeeID: employeeId.toString(),
        performancePercentage: 85,
        rating: 9,
        feedback: 'Great teamwork and problem-solving skills this month.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.employeeName).toBe('John Doe');
    expect(res.body.data.feedback).toBe('Great teamwork and problem-solving skills this month.');
    expect(res.body.data.evaluatorRole).toBe('team lead');
  });

  it('allows HR and Admin to view performance feedback', async () => {
    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      then: function(resolve) {
        resolve([
          {
            _id: new mongoose.Types.ObjectId(),
            employeeName: 'John Doe',
            feedback: 'Great teamwork',
            performancePercentage: 85,
            evaluatorRole: 'team lead',
          },
        ]);
      },
    };

    jest.spyOn(EmployeePerformance, 'find').mockReturnValue(mockQuery);

    app = express();
    app.use(express.json());
    // Attach mock HR user
    app.use((req, res, next) => {
      req.user = hrUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app).get('/api/performance/all');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].feedback).toBe('Great teamwork');
  });

  it('blocks non-HR/non-Admin users from viewing performance feedback (HTTP 403)', async () => {
    app = express();
    app.use(express.json());
    // Attach mock regular employee user
    app.use((req, res, next) => {
      req.user = regularEmpUser;
      next();
    });
    app.use('/api/performance', performanceRoutes);

    const res = await request(app).get('/api/performance/all');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not authorized');
  });
});
