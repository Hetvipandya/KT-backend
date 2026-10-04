const express = require('express');
const request = require('supertest');

describe('Rate Limiting Middleware for Auth Endpoints', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it('allows requests within limit and returns 429 when rate limit is exceeded', async () => {
    process.env.RATE_LIMIT_MAX = '3';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.NODE_ENV = 'test';

    const { authLimiter } = require('../middleware/rateLimiter');
    
    app = express();
    app.use(express.json());
    app.post('/api/auth/login', authLimiter, (req, res) => {
      res.status(200).json({ success: true, message: 'Login page' });
    });

    // Requests 1, 2, 3 should succeed (HTTP 200)
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(200);
    }

    // Request 4 should be rate limited (HTTP 429)
    const blockedRes = await request(app).post('/api/auth/login').send({});
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.message).toContain('Too many authentication attempts');
  });

  it('rate limits forgot-password endpoint independently or per IP', async () => {
    process.env.RATE_LIMIT_MAX = '2';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.NODE_ENV = 'test';

    const { authLimiter } = require('../middleware/rateLimiter');
    
    app = express();
    app.use(express.json());
    app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
      res.status(200).json({ success: true, message: 'OTP sent' });
    });

    const res1 = await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });
    const res2 = await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const res3 = await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });
    expect(res3.status).toBe(429);
  });
});
