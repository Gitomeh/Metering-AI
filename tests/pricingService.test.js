const pricingService = require('../src/services/pricingService');

describe('PricingService', () => {
  describe('calculateTokenCost', () => {
    test('should calculate cost for input tokens', () => {
      const cost = pricingService.calculateTokenCost({
        inputTokens: 1_000_000,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
      });

      // 1M input tokens * $0.50/M = $0.50 = 50 cents
      expect(cost).toBe(50);
    });

    test('should calculate cost for cached input tokens', () => {
      const cost = pricingService.calculateTokenCost({
        inputTokens: 0,
        cachedInputTokens: 1_000_000,
        outputTokens: 0,
        reasoningTokens: 0,
      });

      // 1M cached input tokens * $0.10/M = $0.10 = 10 cents
      expect(cost).toBe(10);
    });

    test('should calculate cost for output tokens', () => {
      const cost = pricingService.calculateTokenCost({
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 1_000_000,
        reasoningTokens: 0,
      });

      // 1M output tokens * $1.50/M = $1.50 = 150 cents
      expect(cost).toBe(150);
    });

    test('should calculate cost for reasoning tokens (same as output)', () => {
      const cost = pricingService.calculateTokenCost({
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 1_000_000,
      });

      // 1M reasoning tokens * $1.50/M = $1.50 = 150 cents
      expect(cost).toBe(150);
    });

    test('should calculate total cost for mixed tokens', () => {
      const cost = pricingService.calculateTokenCost({
        inputTokens: 1_000_000,
        cachedInputTokens: 500_000,
        outputTokens: 800_000,
        reasoningTokens: 200_000,
      });

      // Input: 1M * $0.50 = $0.50 = 50 cents
      // Cached: 0.5M * $0.10 = $0.05 = 5 cents
      // Output: 0.8M * $1.50 = $1.20 = 120 cents
      // Reasoning: 0.2M * $1.50 = $0.30 = 30 cents
      // Total: 50 + 5 + 120 + 30 = 205 cents
      expect(cost).toBe(205);
    });

    test('should throw error for negative token counts', () => {
      expect(() => {
        pricingService.calculateTokenCost({
          inputTokens: -100,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
        });
      }).toThrow('Token counts cannot be negative');
    });

    test('should return 0 for zero tokens', () => {
      const cost = pricingService.calculateTokenCost({
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
      });

      expect(cost).toBe(0);
    });
  });

  describe('calculateApiCallCost', () => {
    test('should calculate cost for API calls', () => {
      const cost = pricingService.calculateApiCallCost(100);

      // 100 calls * $0.01/call = $1.00 = 100 cents
      expect(cost).toBe(100);
    });

    test('should throw error for negative API calls', () => {
      expect(() => {
        pricingService.calculateApiCallCost(-1);
      }).toThrow('API call count cannot be negative');
    });

    test('should return 0 for zero API calls', () => {
      const cost = pricingService.calculateApiCallCost(0);
      expect(cost).toBe(0);
    });
  });

  describe('calculateTotalCost', () => {
    test('should calculate total cost for generation request', () => {
      const cost = pricingService.calculateTotalCost({
        apiCalls: 10,
        tokens: {
          inputTokens: 1_000_000,
          cachedInputTokens: 0,
          outputTokens: 500_000,
          reasoningTokens: 0,
        },
      });

      // API calls: 10 * $0.01 = $0.10 = 10 cents
      // Input tokens: 1M * $0.50 = $0.50 = 50 cents
      // Output tokens: 0.5M * $1.50 = $0.75 = 75 cents
      // Total: 10 + 50 + 75 = 135 cents
      expect(cost).toBe(135);
    });
  });
});
