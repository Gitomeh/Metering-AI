const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

// Mock database
jest.mock('../src/config/database');

describe('API Endpoints', () => {
  describe('GET /health', () => {
    test('should return health status', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.database).toBe('connected');
    });
  });

  describe('GET /api/v1/plans', () => {
    test('should return available plans', async () => {
      const planRepository = require('../src/repositories/planRepository');
      planRepository.findAll.mockResolvedValue([
        {
          id: 'plan-1',
          name: 'Free',
          apiCallLimit: 1000,
          aiTokenLimit: 100000,
          monthlyPriceCents: 0,
        },
        {
          id: 'plan-2',
          name: 'Pro',
          apiCallLimit: 10000,
          aiTokenLimit: 1000000,
          monthlyPriceCents: 2900,
        },
      ]);

      const response = await request(app).get('/api/v1/plans');

      expect(response.status).toBe(200);
      expect(response.body.plans).toHaveLength(2);
      expect(response.body.plans[0].name).toBe('Free');
      expect(response.body.plans[1].name).toBe('Pro');
    });
  });

  describe('POST /api/v1/generate', () => {
    test('should require Idempotency-Key header', async () => {
      const response = await request(app)
        .post('/api/v1/generate')
        .set('X-Tenant-ID', 'tenant-1')
        .send({ apiCalls: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should require X-Tenant-ID header', async () => {
      const response = await request(app)
        .post('/api/v1/generate')
        .set('Idempotency-Key', 'test-key')
        .send({ apiCalls: 1 });

      expect(response.status).toBe(401);
    });

    test('should validate non-negative token counts', async () => {
      const tenantRepository = require('../src/repositories/tenantRepository');
      tenantRepository.findById.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Tenant',
        email: 'test@example.com',
      });

      const response = await request(app)
        .post('/api/v1/generate')
        .set('Idempotency-Key', 'test-key')
        .set('X-Tenant-ID', 'tenant-1')
        .send({
          apiCalls: 1,
          inputTokens: -100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
