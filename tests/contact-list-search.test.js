const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Contact = require('../models/Contact');
const { getAllContacts } = require('../controllers/contactController');

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
  await Contact.deleteMany({});
  await Contact.create([
    {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '111',
      service: 'Consulting',
      message: 'First inquiry'
    },
    {
      firstName: 'Adam',
      lastName: 'Smith',
      email: 'adam@example.com',
      phone: '222',
      service: 'Consulting',
      message: 'Second inquiry'
    },
    {
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      phone: '333',
      service: 'Design',
      message: 'Third inquiry'
    }
  ]);
});

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
});

describe('contact list search and pagination', () => {
  test('applies search and service filters in MongoDB before pagination', async () => {
    const req = {
      query: { search: 'ada@example.com', service: 'consulting', page: '1', limit: '1' }
    };
    const res = createResponse();

    await getAllContacts(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].email).toBe('ada@example.com');
    expect(payload.pagination).toMatchObject({ page: 1, limit: 1, total: 1, pages: 1 });
  });

  test('caps page size and returns only the requested page with the full count', async () => {
    const req = { query: { page: '2', limit: '2' } };
    const res = createResponse();

    await getAllContacts(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveLength(1);
    expect(payload.count).toBe(1);
    expect(payload.pagination).toMatchObject({ page: 2, limit: 2, total: 3, pages: 2 });
  });

  test('caps requested page size', async () => {
    const req = { query: { page: '1', limit: '1000' } };
    const res = createResponse();

    await getAllContacts(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.pagination.limit).toBe(100);
  });

  test('keeps the existing unpaginated response when no listing query is provided', async () => {
    const res = createResponse();

    await getAllContacts({ query: {} }, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveLength(3);
    expect(payload.count).toBe(3);
  });
});
