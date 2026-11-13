const express = require('express');
const request = require('supertest');

jest.mock('../controllers/salary.controller', () => ({
  createSalaryStructure: jest.fn((_req, res) => res.status(201).json({ success: true })),
  getAllSalaryStructures: jest.fn((_req, res) => res.status(200).json({ success: true })),
  getSalaryStructureById: jest.fn((_req, res) => res.status(200).json({ success: true })),
  updateSalaryStructure: jest.fn((_req, res) => res.status(200).json({ success: true })),
  patchSalaryStructure: jest.fn((_req, res) => res.status(200).json({ success: true })),
  deleteSalaryStructure: jest.fn((_req, res) => res.status(200).json({ success: true }))
}));

jest.mock('../controllers/salaryStructureController', () => ({
  createSalaryStructure: jest.fn((_req, res) => res.status(201).json({ success: true })),
  getAllSalaryStructures: jest.fn((_req, res) => res.status(200).json({ success: true })),
  getSalaryStructureById: jest.fn((_req, res) => res.status(200).json({ success: true })),
  updateSalaryStructure: jest.fn((_req, res) => res.status(200).json({ success: true })),
  deleteSalaryStructure: jest.fn((_req, res) => res.status(200).json({ success: true }))
}));

const salaryRoutes = require('../routes/salary.routes');
const salaryStructureRoutes = require('../routes/salaryStructureRoutes');
const controller = require('../controllers/salary.controller');
const salaryStructureController = require('../controllers/salaryStructureController');

const createApp = (user, route = salaryRoutes, basePath = '/api/salary') => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use(basePath, route);
  return app;
};

describe('Salary structure API access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requires an authenticated user', async () => {
    const response = await request(createApp(null)).get('/api/salary');

    expect(response.status).toBe(401);
    expect(controller.getAllSalaryStructures).not.toHaveBeenCalled();
  });

  test('prevents employees from reading other employees salary structures via either route', async () => {
    const user = { _id: 'employee-id', role: 'employee' };
    const aliasResponse = await request(createApp(user)).get('/api/salary');
    const primaryResponse = await request(
      createApp(user, salaryStructureRoutes, '/api/salary-structures')
    ).get('/api/salary-structures');

    expect(aliasResponse.status).toBe(403);
    expect(primaryResponse.status).toBe(403);
    expect(controller.getAllSalaryStructures).not.toHaveBeenCalled();
    expect(salaryStructureController.getAllSalaryStructures).not.toHaveBeenCalled();
  });

  test('prevents an employee from creating or changing salary structures', async () => {
    const app = createApp({ _id: 'employee-id', role: 'employee' });
    const createResponse = await request(app).post('/api/salary').send({});
    const updateResponse = await request(app).put('/api/salary/salary-id').send({});

    expect(createResponse.status).toBe(403);
    expect(updateResponse.status).toBe(403);
    expect(controller.createSalaryStructure).not.toHaveBeenCalled();
    expect(controller.updateSalaryStructure).not.toHaveBeenCalled();
  });
});
