const planRepository = require('../repositories/planRepository');

class PlansController {
  async getPlans(req, res, next) {
    try {
      const plans = await planRepository.findAll();

      res.json({
        plans: plans.map(plan => ({
          id: plan.id,
          name: plan.name,
          apiCallLimit: plan.apiCallLimit,
          aiTokenLimit: plan.aiTokenLimit,
          monthlyPriceCents: plan.monthlyPriceCents,
          monthlyPriceUSD: (plan.monthlyPriceCents / 100).toFixed(2),
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PlansController();
