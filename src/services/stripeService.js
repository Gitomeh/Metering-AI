const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const subscriptionRepository = require('../repositories/subscriptionRepository');
const tenantRepository = require('../repositories/tenantRepository');
const planRepository = require('../repositories/planRepository');
const stripeEventRepository = require('../repositories/stripeEventRepository');
const prisma = require('../config/database');
const config = require('../config');

class StripeService {
  /**
   * Create or retrieve a Stripe customer for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Stripe customer
   */
  async getOrCreateCustomer(tenantId) {
    const tenant = await tenantRepository.findById(tenantId);
    
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Check if tenant already has a Stripe customer ID
    const subscription = await subscriptionRepository.findByTenantId(tenantId);
    const existingCustomerId = subscription[0]?.stripeCustomerId;

    if (existingCustomerId) {
      return await stripe.customers.retrieve(existingCustomerId);
    }

    // Create a new customer
    const customer = await stripe.customers.create({
      email: tenant.email,
      name: tenant.name,
      metadata: {
        tenantId,
      },
    });

    return customer;
  }

  /**
   * Create a Stripe Checkout session for upgrading to Pro plan
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Checkout session URL
   */
  async createCheckoutSession(tenantId) {
    const tenant = await tenantRepository.findById(tenantId);
    
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Get or create Stripe customer
    const customer = await this.getOrCreateCustomer(tenantId);

    // Get Pro plan
    const proPlan = await planRepository.findByName('Pro');
    
    if (!proPlan) {
      throw new Error('Pro plan not found');
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: config.stripe.priceId,
          quantity: 1,
        },
      ],
      success_url: config.stripe.successUrl,
      cancel_url: config.stripe.cancelUrl,
      metadata: {
        tenantId,
        planId: proPlan.id,
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Process a Stripe webhook event
   * @param {string} signature - Stripe signature
   * @param {string} payload - Raw request body
   * @returns {Object} Processing result
   */
  async processWebhook(signature, payload) {
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    // Check if event was already processed
    const existingEvent = await stripeEventRepository.findByStripeEventId(event.id);
    
    if (existingEvent) {
      return {
        processed: false,
        reason: 'Event already processed',
        eventId: event.id,
      };
    }

    // Process the event based on type
    let result;
    switch (event.type) {
      case 'checkout.session.completed':
        result = await this.handleCheckoutSessionCompleted(event);
        break;
      case 'customer.subscription.updated':
        result = await this.handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        result = await this.handleSubscriptionDeleted(event);
        break;
      default:
        result = { message: 'Unhandled event type' };
    }

    // Record the event as processed
    await stripeEventRepository.create({
      stripeEventId: event.id,
      eventType: event.type,
      processedAt: new Date(),
    });

    return {
      processed: true,
      eventId: event.id,
      eventType: event.type,
      result,
    };
  }

  /**
   * Handle checkout.session.completed event
   * @param {Object} event - Stripe event
   * @returns {Object} Processing result
   */
  async handleCheckoutSessionCompleted(event) {
    const session = event.data.object;
    const { tenantId, planId } = session.metadata;

    if (!tenantId || !planId) {
      throw new Error('Missing metadata in checkout session');
    }

    // Create or update subscription
    const subscription = await prisma.$transaction(async (tx) => {
      // Check if subscription already exists
      const existing = await tx.subscription.findFirst({
        where: {
          tenantId,
          stripeSubscriptionId: session.subscription,
        },
      });

      if (existing) {
        // Update existing subscription
        return tx.subscription.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: new Date(session.subscription_created * 1000),
            currentPeriodEnd: new Date(session.subscription_expires_at * 1000),
          },
        });
      }

      // Create new subscription
      return tx.subscription.create({
        data: {
          tenantId,
          planId,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          status: 'ACTIVE',
          currentPeriodStart: new Date(session.subscription_created * 1000),
          currentPeriodEnd: new Date(session.subscription_expires_at * 1000),
        },
      });
    });

    return { subscriptionId: subscription.id };
  }

  /**
   * Handle customer.subscription.updated event
   * @param {Object} event - Stripe event
   * @returns {Object} Processing result
   */
  async handleSubscriptionUpdated(event) {
    const stripeSubscription = event.data.object;
    
    // Find local subscription
    const subscription = await subscriptionRepository.findByStripeSubscriptionId(
      stripeSubscription.id
    );

    if (!subscription) {
      throw new Error('Subscription not found in local database');
    }

    // Update subscription status
    const updated = await subscriptionRepository.update(subscription.id, {
      status: stripeSubscription.status.toUpperCase(),
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    });

    return { subscriptionId: updated.id };
  }

  /**
   * Handle customer.subscription.deleted event
   * @param {Object} event - Stripe event
   * @returns {Object} Processing result
   */
  async handleSubscriptionDeleted(event) {
    const stripeSubscription = event.data.object;
    
    // Find local subscription
    const subscription = await subscriptionRepository.findByStripeSubscriptionId(
      stripeSubscription.id
    );

    if (!subscription) {
      throw new Error('Subscription not found in local database');
    }

    // Update subscription status to CANCELED
    const updated = await subscriptionRepository.update(subscription.id, {
      status: 'CANCELED',
      currentPeriodEnd: new Date(stripeSubscription.canceled_at * 1000),
    });

    return { subscriptionId: updated.id };
  }

  /**
   * Cancel a subscription at period end
   * @param {string} subscriptionId - Local subscription ID
   * @returns {Object} Canceled subscription
   */
  async cancelSubscription(subscriptionId) {
    const subscription = await subscriptionRepository.findById(subscriptionId);
    
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error('Subscription not found or no Stripe subscription ID');
    }

    // Cancel in Stripe
    const canceled = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );

    // Update local status
    const updated = await subscriptionRepository.update(subscriptionId, {
      status: 'CANCELED',
    });

    return updated;
  }
}

module.exports = new StripeService();
