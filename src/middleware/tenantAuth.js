const tenantRepository = require('../repositories/tenantRepository');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

const tenantAuth = async (req, res, next) => {
  try {
    // For development/demo, use X-Tenant-ID header
    // In production, this would be replaced with real authentication (JWT, etc.)
    const tenantId = req.headers['x-tenant-id'];

    if (!tenantId) {
      throw new UnauthorizedError('Missing tenant identifier');
    }

    const tenant = await tenantRepository.findById(tenantId);

    if (!tenant) {
      throw new ForbiddenError('Invalid tenant identifier');
    }

    // Attach tenant to request for use in controllers
    req.tenant = tenant;
    req.tenantId = tenantId;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = tenantAuth;
