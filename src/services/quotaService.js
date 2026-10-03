const subscriptionRepository = require('../repositories/subscriptionRepository');
const usageEventRepository = require('../repositories/usageEventRepository');
const planRepository = require('../repositories/planRepository');
const prisma = require('../config/database');
const { QuotaExceededError, PaymentRequiredError } = require('../utils/errors');

class QuotaService {
  /**
   * Get the active subscription for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Subscription with plan
   */
  async getActiveSubscription(tenantId) {
    const subscription = await subscriptionRepository.findActiveByTenantId(tenantId);
    
    if (!subscription) {
      // If no active subscription, use Free plan as default
      const freePlan = await planRepository.findByName('Free');
      
      if (!freePlan) {
        throw new Error('Free plan not found in database');
      }
      
      return {
        plan: freePlan,
        currentPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        currentPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      };
    }
    
    return subscription;
  }

  /**
   * Get current usage for a tenant in the current billing period
   * @param {string} tenantId - Tenant ID
   * @param {Date} periodStart - Period start date
   * @param {Date} periodEnd - Period end date
   * @returns {Object} Current usage by type
   */
  async getCurrentUsage(tenantId, periodStart, periodEnd) {
    const usage = await usageEventRepository.getUsageByTenantAndPeriod(
      tenantId,
      periodStart,
      periodEnd
    );
    
    return {
      apiCalls: usage.API_CALL?.quantity || 0,
      aiTokens: usage.AI_TOKENS?.quantity || 0,
    };
  }

  /**
   * Check if tenant has sufficient quota for a request
   * @param {string} tenantId - Tenant ID
   * @param {Object} requestedUsage - Requested usage
   * @param {number} requestedUsage.apiCalls - Requested API calls
   * @param {number} requestedUsage.aiTokens - Requested AI tokens
   * @throws {QuotaExceededError} If quota exceeded
   * @throws {PaymentRequiredError} If payment required
   */
  async checkQuota(tenantId, requestedUsage) {
    const { apiCalls = 0, aiTokens = 0 } = requestedUsage;
    
    // Get active subscription
    const subscription = await this.getActiveSubscription(tenantId);
    const plan = subscription.plan;
    
    // Get current billing period
    const periodStart = subscription.currentPeriodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const periodEnd = subscription.currentPeriodEnd || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    
    // Get current usage
    const currentUsage = await this.getCurrentUsage(tenantId, periodStart, periodEnd);
    
    // Check API call quota
    if (apiCalls > 0) {
      const apiCallUsage = currentUsage.apiCalls;
      const apiCallLimit = plan.apiCallLimit;
      const apiCallRemaining = apiCallLimit - apiCallUsage;
      
      if (apiCallUsage + apiCalls > apiCallLimit) {
        throw new QuotaExceededError('Monthly API call quota exceeded', {
          usage: apiCallUsage,
          requested: apiCalls,
          limit: apiCallLimit,
          plan: plan.name,
          usageType: 'API_CALL',
        });
      }
    }
    
    // Check AI token quota
    if (aiTokens > 0) {
      const aiTokenUsage = currentUsage.aiTokens;
      const aiTokenLimit = plan.aiTokenLimit;
      const aiTokenRemaining = aiTokenLimit - aiTokenUsage;
      
      if (aiTokenUsage + aiTokens > aiTokenLimit) {
        throw new QuotaExceededError('Monthly AI token quota exceeded', {
          usage: aiTokenUsage,
          requested: aiTokens,
          limit: aiTokenLimit,
          plan: plan.name,
          usageType: 'AI_TOKENS',
        });
      }
    }
    
    // Return quota information
    return {
      allowed: true,
      currentUsage,
      limits: {
        apiCalls: plan.apiCallLimit,
        aiTokens: plan.aiTokenLimit,
      },
      period: {
        start: periodStart,
        end: periodEnd,
      },
    };
  }

  /**
   * Get quota status for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Quota status
   */
  async getQuotaStatus(tenantId) {
    const subscription = await this.getActiveSubscription(tenantId);
    const plan = subscription.plan;
    
    const periodStart = subscription.currentPeriodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const periodEnd = subscription.currentPeriodEnd || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    
    const currentUsage = await this.getCurrentUsage(tenantId, periodStart, periodEnd);
    
    return {
      plan: {
        name: plan.name,
        apiCallLimit: plan.apiCallLimit,
        aiTokenLimit: plan.aiTokenLimit,
      },
      period: {
        start: periodStart,
        end: periodEnd,
      },
      apiCalls: {
        used: currentUsage.apiCalls,
        limit: plan.apiCallLimit,
        remaining: plan.apiCallLimit - currentUsage.apiCalls,
      },
      aiTokens: {
        used: currentUsage.aiTokens,
        limit: plan.aiTokenLimit,
        remaining: plan.aiTokenLimit - currentUsage.aiTokens,
      },
    };
  }
}

module.exports = new QuotaService();
