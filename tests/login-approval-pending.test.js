const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/User');
const userControllers = require('../controllers/userControllers');

describe('Login Approval & Active Status Tests', () => {
  let app;

  beforeEach(() => {
    jest.restoreAllMocks();
    app = express();
    app.use(express.json());
    app.post('/api/users/login', userControllers.loginUser);
  });

  test('Returns "Admin Approval Pending" when isActive is false and isApproved is false', async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'pending@example.com',
      role: 'employee',
      isActive: false,
      isApproved: false,
    };

    jest.spyOn(User, 'findOne').mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(mockUser),
    }));

    const res = await request(app)
      .post('/api/users/login')
      .send({
        email: 'pending@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Admin Approval Pending');
  });

  test('Returns "Admin Approval Pending" when isApproved is false', async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'unapproved@example.com',
      role: 'employee',
      isActive: true,
      isApproved: false,
    };

    jest.spyOn(User, 'findOne').mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(mockUser),
    }));

    const res = await request(app)
      .post('/api/users/login')
      .send({
        email: 'unapproved@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Admin Approval Pending');
  });

  test('Returns "Your account is inactive" when isActive is false but isApproved is true', async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'inactive@example.com',
      role: 'employee',
      isActive: false,
      isApproved: true,
    };

    jest.spyOn(User, 'findOne').mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(mockUser),
    }));

    const res = await request(app)
      .post('/api/users/login')
      .send({
        email: 'inactive@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Your account is inactive');
  });
});
