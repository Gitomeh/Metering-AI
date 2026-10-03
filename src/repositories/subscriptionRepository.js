const prisma = require('../config/database');

class SubscriptionRepository {
  async findById(id) {
    return prisma.subscription.findUnique({
      where: { id },
      include: {
        tenant: true,
        plan: true,
      },
    });
  }

  async findByTenantId(tenantId) {
    return prisma.subscription.findMany({
      where: { tenantId },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findActiveByTenantId(tenantId) {
    return prisma.subscription.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });
  }

  async findByStripeSubscriptionId(stripeSubscriptionId) {
    return prisma.subscription.findFirst({
      where: { stripeSubscriptionId },
      include: {
        tenant: true,
        plan: true,
      },
    });
  }

  async create(data) {
    return prisma.subscription.create({
      data,
      include: {
        plan: true,
      },
    });
  }

  async update(id, data) {
    return prisma.subscription.update({
      where: { id },
      data,
      include: {
        plan: true,
      },
    });
  }

  async delete(id) {
    return prisma.subscription.delete({
      where: { id },
    });
  }

  async findAll() {
    return prisma.subscription.findMany({
      include: {
        tenant: true,
        plan: true,
      },
    });
  }
}

module.exports = new SubscriptionRepository();
