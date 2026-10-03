const quotaService = require('../src/services/quotaService');
const planRepository = require('../src/repositories/planRepository');
const { QuotaExceededError } = require('../src/utils/errors');

// Mock repositories
jest.mock('../src/repositories/subscriptionRepository');
jest.mock('../src/repositories/usageEventRepository');
jest.mock('../src/repositories/planRepository');

describe('QuotaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkQuota', () => {
    test('should allow request within quota', async () => {
      // Mock free plan
      planRepository.findByName.mockResolvedValue({
        name: 'Free',
        apiCallLimit: 1000,
        aiTokenLimit: 100000,
      });

      // Mock usage
      const usageEventRepository = require('../src/repositories/usageEventRepository');
      usageEventRepository.getUsageByTenantAndPeriod.mockResolvedValue({
        API_CALL: { quantity: 500, costCents: 500 },
        AI_TOKENS: { quantity: 50000, costCents: 100 },
      });

      const result = await quotaService.checkQuota('tenant-1', {
        apiCalls: 1,
        aiTokens: 1000,
      });

      expect(result.allowed).toBe(true);
    });

    test('should reject request exceeding API call quota', async () => {
      planRepository.findByName.mockResolvedValue({
        name: 'Free',
        apiCallLimit: 1000,
        aiTokenLimit: 100000,
      });

      const usageEventRepository = require('../src/repositories/usageEventRepository');
      usageEventRepository.getUsageByTenantAndPeriod.mockResolvedValue({
        API_CALL: { quantity: 1000, costCents: 1000 },
        AI_TOKENS: { quantity: 0, costCents: 0 },
      });

      await expect(
        quotaService.checkQuota('tenant-1', {
          apiCalls: 1,
          aiTokens: 0,
        })
      ).rejects.toThrow(QuotaExceededError);
    });

    test('should reject request exceeding AI token quota', async () => {
      planRepository.findByName.mockResolvedValue({
        name: 'Free',
        apiCallLimit: 1000,
        aiTokenLimit: 100000,
      });

      const usageEventRepository = require('../src/repositories/usageEventRepository');
      usageEventRepository.getUsageByTenantAndPeriod.mockResolvedValue({
        API_CALL: { quantity: 0, costCents: 0 },
        AI_TOKENS: { quantity: 100000, costCents: 200 },
      });

      await expect(
        quotaService.checkQuota('tenant-1', {
          apiCalls: 0,
          aiTokens: 1,
        })
      ).rejects.toThrow(QuotaExceededError);
    });

    test('should allow request at exact quota boundary', async () => {
      planRepository.findByName.mockResolvedValue({
        name: 'Free',
        apiCallLimit: 1000,
        aiTokenLimit: 100000,
      });

      const usageEventRepository = require('../src/repositories/usageEventRepository');
      usageEventRepository.getUsageByTenantAndPeriod.mockResolvedValue({
        API_CALL: { quantity: 999, costCents: 999 },
        AI_TOKENS: { quantity: 0, costCents: 0 },
      });

      const result = await quotaService.checkQuota('tenant-1', {
        apiCalls: 1,
        aiTokens: 0,
      });

      expect(result.allowed).toBe(true);
    });
  });
});
