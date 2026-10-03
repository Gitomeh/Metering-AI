const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const subscriptionRepository = require('../repositories/subscriptionRepository');
const planRepository = require('../repositories/planRepository');
const prisma = require('../config/database');

class ReconciliationJob {
  /**
   * Run the reconciliation job
   * Compares Stripe subscriptions with local database records
   * @returns {Object} Job result
   */
  async run() {
    const startTime = new Date();
    const discrepancies = [];
    const synced = [];

    try {
      // Fetch all active subscriptions from Stripe
      const stripeSubscriptions = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
      });

      // Fetch all local subscriptions
      const localSubscriptions = await subscriptionRepository.findAll();

      // Create a map of local subscriptions by Stripe subscription ID
      const localSubMap = new Map();
      for (const sub of localSubscriptions) {
        if (sub.stripeSubscriptionId) {
          localSubMap.set(sub.stripeSubscriptionId, sub);
        }
      }

      // Compare Stripe subscriptions with local records
      for (const stripeSub of stripeSubscriptions.data) {
        const localSub = localSubMap.get(stripeSub.id);

        if (!localSub) {
          // Stripe subscription exists but not in local database
          discrepancies.push({
            type: 'MISSING_LOCAL',
            stripeSubscriptionId: stripeSub.id,
            message: 'Subscription exists in Stripe but not in local database',
          });
          continue;
        }

        // Check status
        if (localSub.status !== 'ACTIVE') {
          discrepancies.push({
            type: 'STATUS_MISMATCH',
            stripeSubscriptionId: stripeSub.id,
            localStatus: localSub.status,
            stripeStatus: stripeSub.status,
            message: 'Status mismatch between Stripe and local database',
          });

          // Auto-fix: update local status
          await subscriptionRepository.update(localSub.id, {
            status: 'ACTIVE',
            currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          });
          synced.push(localSub.id);
        }

        // Check period dates
        const localPeriodStart = new Date(localSub.currentPeriodStart).getTime();
        const localPeriodEnd = new Date(localSub.currentPeriodEnd).getTime();
        const stripePeriodStart = stripeSub.current_period_start * 1000;
        const stripePeriodEnd = stripeSub.current_period_end * 1000;

        if (Math.abs(localPeriodStart - stripePeriodStart) > 1000 ||
            Math.abs(localPeriodEnd - stripePeriodEnd) > 1000) {
          discrepancies.push({
            type: 'PERIOD_MISMATCH',
            stripeSubscriptionId: stripeSub.id,
            message: 'Period dates mismatch between Stripe and local database',
          });

          // Auto-fix: update local period dates
          await subscriptionRepository.update(localSub.id, {
            currentPeriodStart: new Date(stripePeriodStart),
            currentPeriodEnd: new Date(stripePeriodEnd),
          });
          synced.push(localSub.id);
        }
      }

      // Check for local subscriptions that don't exist in Stripe
      for (const localSub of localSubscriptions) {
        if (localSub.stripeSubscriptionId && !localSubMap.has(localSub.stripeSubscriptionId)) {
          // This should not happen due to the map logic, but let's check
          const existsInStripe = stripeSubscriptions.data.some(
            s => s.id === localSub.stripeSubscriptionId
          );

          if (!existsInStripe && localSub.status === 'ACTIVE') {
            discrepancies.push({
              type: 'MISSING_STRIPE',
              stripeSubscriptionId: localSub.stripeSubscriptionId,
              message: 'Local subscription marked as ACTIVE but not found in Stripe',
            });
          }
        }
      }

      const endTime = new Date();
      const duration = endTime - startTime;

      return {
        success: true,
        duration,
        discrepanciesFound: discrepancies.length,
        discrepancies,
        synced,
        timestamp: endTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run the job safely with error handling
   */
  async runSafe() {
    try {
      const result = await this.run();
      console.log('Reconciliation job completed:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('Reconciliation job failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }
}

// Allow running this job directly
if (require.main === module) {
  const job = new ReconciliationJob();
  job.runSafe()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = new ReconciliationJob();
