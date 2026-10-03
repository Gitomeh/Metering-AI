const quotaService = require('../services/quotaService');
const usageEventRepository = require('../repositories/usageEventRepository');

class UsageController {
  async getUsage(req, res, next) {
    try {
      const tenantId = req.tenantId;

      // Get quota status
      const quotaStatus = await quotaService.getQuotaStatus(tenantId);

      // Get total cost for the period
      const periodStart = quotaStatus.period.start;
      const periodEnd = quotaStatus.period.end;
      
      const usage = await usageEventRepository.getUsageByTenantAndPeriod(
        tenantId,
        periodStart,
        periodEnd
      );

      const totalCostCents = (usage.API_CALL?.costCents || 0) + (usage.AI_TOKENS?.costCents || 0);

      res.json({
        tenant: tenantId,
        plan: {
          name: quotaStatus.plan.name,
          apiCallLimit: quotaStatus.plan.apiCallLimit,
          aiTokenLimit: quotaStatus.plan.aiTokenLimit,
        },
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        },
        apiCalls: {
          used: quotaStatus.apiCalls.used,
          limit: quotaStatus.apiCalls.limit,
          remaining: quotaStatus.apiCalls.remaining,
        },
        aiTokens: {
          used: quotaStatus.aiTokens.used,
          limit: quotaStatus.aiTokens.limit,
          remaining: quotaStatus.aiTokens.remaining,
        },
        cost: {
          currency: 'USD',
          amountCents: totalCostCents,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UsageController();
