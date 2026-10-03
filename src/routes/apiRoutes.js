const express = require('express');
const router = express.Router();
const tenantAuth = require('../middleware/tenantAuth');
const generateController = require('../controllers/generateController');
const usageController = require('../controllers/usageController');
const plansController = require('../controllers/plansController');
const billingController = require('../controllers/billingController');

// POST /api/v1/generate - Simulate AI generation
router.post('/generate', tenantAuth, generateController.generate);

// GET /api/v1/usage - Get tenant usage
router.get('/usage', tenantAuth, usageController.getUsage);

// GET /api/v1/plans - Get available plans
router.get('/plans', plansController.getPlans);

// POST /api/v1/billing/checkout - Create Stripe checkout session
router.post('/billing/checkout', tenantAuth, billingController.createCheckoutSession);

// POST /api/v1/webhooks/stripe - Handle Stripe webhooks
router.post('/webhooks/stripe', billingController.handleWebhook);

module.exports = router;
