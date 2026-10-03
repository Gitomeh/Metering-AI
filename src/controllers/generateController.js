const meteringService = require('../services/meteringService');
const { ValidationError } = require('../utils/errors');

class GenerateController {
  async generate(req, res, next) {
    try {
      const { apiCalls, inputTokens, cachedInputTokens, outputTokens, reasoningTokens } = req.body;
      const idempotencyKey = req.headers['idempotency-key'];
      const tenantId = req.tenantId;

      // Validate idempotency key
      if (!idempotencyKey) {
        throw new ValidationError('Missing Idempotency-Key header');
      }

      // Validate request body
      if (apiCalls === undefined || apiCalls === null) {
        throw new ValidationError('Missing apiCalls in request body');
      }

      if (typeof apiCalls !== 'number' || apiCalls < 0) {
        throw new ValidationError('apiCalls must be a non-negative number');
      }

      // Validate token counts if provided
      const tokens = {
        inputTokens: inputTokens || 0,
        cachedInputTokens: cachedInputTokens || 0,
        outputTokens: outputTokens || 0,
        reasoningTokens: reasoningTokens || 0,
      };

      if (typeof tokens.inputTokens !== 'number' || tokens.inputTokens < 0) {
        throw new ValidationError('inputTokens must be a non-negative number');
      }

      if (typeof tokens.cachedInputTokens !== 'number' || tokens.cachedInputTokens < 0) {
        throw new ValidationError('cachedInputTokens must be a non-negative number');
      }

      if (typeof tokens.outputTokens !== 'number' || tokens.outputTokens < 0) {
        throw new ValidationError('outputTokens must be a non-negative number');
      }

      if (typeof tokens.reasoningTokens !== 'number' || tokens.reasoningTokens < 0) {
        throw new ValidationError('reasoningTokens must be a non-negative number');
      }

      // Record the generation
      const result = await meteringService.recordGeneration({
        tenantId,
        idempotencyKey,
        apiCalls,
        tokens,
      });

      // Return response
      const statusCode = result.idempotent ? 200 : 201;
      
      res.status(statusCode).json({
        success: true,
        idempotent: result.idempotent,
        usageEventId: result.event.id,
        costCents: result.costCents,
        usage: {
          apiCalls,
          tokens,
        },
        timestamp: result.event.timestamp,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new GenerateController();
