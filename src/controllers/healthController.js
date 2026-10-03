const prisma = require('../config/database');

class HealthController {
  async check(req, res) {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;

      res.json({
        status: 'ok',
        service: 'usage-metering-billing',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        service: 'usage-metering-billing',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = new HealthController();
