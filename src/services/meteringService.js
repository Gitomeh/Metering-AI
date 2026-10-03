const usageEventRepository = require('../repositories/usageEventRepository');
const pricingService = require('./pricingService');
const quotaService = require('./quotaService');
const prisma = require('../config/database');
const { ValidationError } = require('../utils/errors');

class MeteringService {
  /**
   * Record a usage event with idempotency protection
   * @param {Object} data - Usage event data
   * @param {string} data.tenantId - Tenant ID
   * @param {string} data.usageType - Usage type (API_CALL or AI_TOKENS)
   * @param {number} data.quantity - Quantity of usage
   * @param {string} data.idempotencyKey - Idempotency key
   * @param {Object} data.metadata - Optional metadata
   * @returns {Object} Recorded usage event or existing event if idempotent
   */
  async recordUsage(data) {
    const { tenantId, usageType, quantity, idempotencyKey, metadata } = data;

    // Validate inputs
    if (!tenantId || !usageType || quantity === undefined || !idempotencyKey) {
      throw new ValidationError('Missing required fields');
    }

    if (quantity < 0) {
      throw new ValidationError('Quantity cannot be negative');
    }

    if (!['API_CALL', 'AI_TOKENS'].includes(usageType)) {
      throw new ValidationError('Invalid usage type');
    }

    // Check if this idempotency key was already used
    const existingEvent = await usageEventRepository.findByIdempotencyKey(
      tenantId,
      idempotencyKey
    );

    if (existingEvent) {
      // Return the existing event (idempotent response)
      return {
        idempotent: true,
        event: existingEvent,
      };
    }

    // Calculate cost
    let costCents = 0;
    if (usageType === 'API_CALL') {
      costCents = pricingService.calculateApiCallCost(quantity);
    } else if (usageType === 'AI_TOKENS') {
      // For AI_TOKENS, the metadata should contain token breakdown
      const tokenCounts = metadata?.tokens || {};
      costCents = pricingService.calculateTokenCost(tokenCounts);
    }

    // Record the usage event in a transaction
    const event = await prisma.$transaction(async (tx) => {
      // Double-check idempotency key within transaction
      const existing = await tx.usageEvent.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey,
          },
        },
      });

      if (existing) {
        return existing;
      }

      // Create the usage event
      return tx.usageEvent.create({
        data: {
          tenantId,
          usageType,
          quantity,
          idempotencyKey,
          metadata,
          costCents,
        },
      });
    });

    return {
      idempotent: false,
      event,
    };
  }

  /**
   * Record a generation request (combined API call and AI tokens)
   * @param {Object} data - Generation request data
   * @param {string} data.tenantId - Tenant ID
   * @param {string} data.idempotencyKey - Idempotency key
   * @param {number} data.apiCalls - Number of API calls
   * @param {Object} data.tokens - Token counts
   * @returns {Object} Result with usage events
   */
  async recordGeneration(data) {
    const { tenantId, idempotencyKey, apiCalls = 0, tokens = {} } = data;

    // Validate inputs
    if (!tenantId || !idempotencyKey) {
      throw new ValidationError('Missing required fields');
    }

    if (apiCalls < 0) {
      throw new ValidationError('API calls cannot be negative');
    }

    const { inputTokens = 0, cachedInputTokens = 0, outputTokens = 0, reasoningTokens = 0 } = tokens;

    if (inputTokens < 0 || cachedInputTokens < 0 || outputTokens < 0 || reasoningTokens < 0) {
      throw new ValidationError('Token counts cannot be negative');
    }

    // Calculate total AI tokens
    const totalAiTokens = inputTokens + cachedInputTokens + outputTokens + reasoningTokens;

    // Check quota before recording
    await quotaService.checkQuota(tenantId, {
      apiCalls,
      aiTokens: totalAiTokens,
    });

    // Check if this idempotency key was already used
    const existingEvent = await usageEventRepository.findByIdempotencyKey(
      tenantId,
      idempotencyKey
    );

    if (existingEvent) {
      // Return the existing event (idempotent response)
      return {
        idempotent: true,
        event: existingEvent,
      };
    }

    // Calculate total cost
    const totalCost = pricingService.calculateTotalCost({
      apiCalls,
      tokens,
    });

    // Record the usage event in a transaction
    const event = await prisma.$transaction(async (tx) => {
      // Double-check idempotency key within transaction
      const existing = await tx.usageEvent.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey,
          },
        },
      });

      if (existing) {
        return existing;
      }

      // Create a single usage event for the generation
      // We record both API calls and AI tokens in one event
      return tx.usageEvent.create({
        data: {
          tenantId,
          usageType: 'AI_TOKENS', // Primary type for generation
          quantity: totalAiTokens,
          idempotencyKey,
          metadata: {
            apiCalls,
            tokens,
            costBreakdown: {
              apiCallCost: pricingService.calculateApiCallCost(apiCalls),
              tokenCost: pricingService.calculateTokenCost(tokens),
            },
          },
          costCents: totalCost,
        },
      });
    });

    // Also record API call as separate event if > 0
    if (apiCalls > 0) {
      await prisma.$transaction(async (tx) => {
        const apiCallIdempotencyKey = `${idempotencyKey}-api-call`;
        
        const existing = await tx.usageEvent.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId,
              idempotencyKey: apiCallIdempotencyKey,
            },
          },
        });

        if (!existing) {
          await tx.usageEvent.create({
            data: {
              tenantId,
              usageType: 'API_CALL',
              quantity: apiCalls,
              idempotencyKey: apiCallIdempotencyKey,
              metadata: {
                generationIdempotencyKey: idempotencyKey,
              },
              costCents: pricingService.calculateApiCallCost(apiCalls),
            },
          });
        }
      });
    }

    return {
      idempotent: false,
      event,
      costCents: totalCost,
    };
  }

  /**
   * Get usage events for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @returns {Array} Usage events
   */
  async getUsageEvents(tenantId, options = {}) {
    return usageEventRepository.findByTenantId(tenantId, options);
  }
}

module.exports = new MeteringService();
