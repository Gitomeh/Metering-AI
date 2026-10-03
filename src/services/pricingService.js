const {
  INPUT_PRICE_PER_MILLION,
  CACHED_INPUT_PRICE_PER_MILLION,
  OUTPUT_PRICE_PER_MILLION,
  API_CALL_PRICE_CENTS,
} = require('../config/pricing');

class PricingService {
  /**
   * Calculate cost for AI tokens
   * @param {Object} tokenCounts - Object with token counts
   * @param {number} tokenCounts.inputTokens - Input tokens
   * @param {number} tokenCounts.cachedInputTokens - Cached input tokens
   * @param {number} tokenCounts.outputTokens - Output tokens
   * @param {number} tokenCounts.reasoningTokens - Reasoning tokens
   * @returns {number} Total cost in cents (integer)
   */
  calculateTokenCost(tokenCounts) {
    const {
      inputTokens = 0,
      cachedInputTokens = 0,
      outputTokens = 0,
      reasoningTokens = 0,
    } = tokenCounts;

    // Validate inputs
    if (inputTokens < 0 || cachedInputTokens < 0 || outputTokens < 0 || reasoningTokens < 0) {
      throw new Error('Token counts cannot be negative');
    }

    // Calculate cost for each token type
    // Formula: (tokens / 1,000,000) * price_per_million
    // Using integer arithmetic to avoid floating-point errors
    const inputCost = Math.floor((inputTokens * INPUT_PRICE_PER_MILLION) / 1_000_000);
    const cachedInputCost = Math.floor((cachedInputTokens * CACHED_INPUT_PRICE_PER_MILLION) / 1_000_000);
    const outputCost = Math.floor((outputTokens * OUTPUT_PRICE_PER_MILLION) / 1_000_000);
    
    // Reasoning tokens use the same pricing as output tokens
    const reasoningCost = Math.floor((reasoningTokens * OUTPUT_PRICE_PER_MILLION) / 1_000_000);

    const totalCost = inputCost + cachedInputCost + outputCost + reasoningCost;

    return totalCost;
  }

  /**
   * Calculate cost for API calls
   * @param {number} apiCalls - Number of API calls
   * @returns {number} Total cost in cents (integer)
   */
  calculateApiCallCost(apiCalls) {
    if (apiCalls < 0) {
      throw new Error('API call count cannot be negative');
    }

    return apiCalls * API_CALL_PRICE_CENTS;
  }

  /**
   * Calculate total cost for a generation request
   * @param {Object} request - Generation request
   * @param {number} request.apiCalls - Number of API calls
   * @param {Object} request.tokens - Token counts
   * @returns {number} Total cost in cents (integer)
   */
  calculateTotalCost(request) {
    const { apiCalls = 0, tokens = {} } = request;

    const apiCallCost = this.calculateApiCallCost(apiCalls);
    const tokenCost = this.calculateTokenCost(tokens);

    return apiCallCost + tokenCost;
  }

  /**
   * Get pricing constants (for testing/documentation)
   */
  getPricingConstants() {
    return {
      INPUT_PRICE_PER_MILLION,
      CACHED_INPUT_PRICE_PER_MILLION,
      OUTPUT_PRICE_PER_MILLION,
      API_CALL_PRICE_CENTS,
    };
  }
}

module.exports = new PricingService();
