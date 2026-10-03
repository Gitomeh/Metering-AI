const stripeService = require('../services/stripeService');

class BillingController {
  async createCheckoutSession(req, res, next) {
    try {
      const tenantId = req.tenantId;

      const session = await stripeService.createCheckoutSession(tenantId);

      res.json({
        success: true,
        sessionId: session.sessionId,
        url: session.url,
      });
    } catch (error) {
      next(error);
    }
  }

  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['stripe-signature'];
      const payload = req.rawBody; // Raw body for signature verification

      if (!signature) {
        return res.status(400).json({
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Missing Stripe signature',
          },
        });
      }

      const result = await stripeService.processWebhook(signature, payload);

      res.json({
        received: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BillingController();
