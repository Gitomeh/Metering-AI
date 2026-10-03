const prisma = require('../config/database');

class UsageEventRepository {
  async findById(id) {
    return prisma.usageEvent.findUnique({
      where: { id },
      include: {
        tenant: true,
      },
    });
  }

  async findByIdempotencyKey(tenantId, idempotencyKey) {
    return prisma.usageEvent.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey,
        },
      },
    });
  }

  async create(data) {
    return prisma.usageEvent.create({
      data,
      include: {
        tenant: true,
      },
    });
  }

  async findByTenantId(tenantId, options = {}) {
    const { limit, offset, startDate, endDate, usageType } = options;

    const where = {
      tenantId,
      ...(startDate && { timestamp: { gte: startDate } }),
      ...(endDate && { timestamp: { lte: endDate } }),
      ...(usageType && { usageType }),
    };

    return prisma.usageEvent.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
    });
  }

  async getUsageByTenantAndPeriod(tenantId, startDate, endDate) {
    const usage = await prisma.usageEvent.groupBy({
      by: ['usageType'],
      where: {
        tenantId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        quantity: true,
        costCents: true,
      },
    });

    return usage.reduce((acc, item) => {
      acc[item.usageType] = {
        quantity: item._sum.quantity || 0,
        costCents: item._sum.costCents || 0,
      };
      return acc;
    }, {});
  }

  async delete(id) {
    return prisma.usageEvent.delete({
      where: { id },
    });
  }

  async countByTenantId(tenantId, options = {}) {
    const { startDate, endDate, usageType } = options;

    const where = {
      tenantId,
      ...(startDate && { timestamp: { gte: startDate } }),
      ...(endDate && { timestamp: { lte: endDate } }),
      ...(usageType && { usageType }),
    };

    return prisma.usageEvent.count({ where });
  }
}

module.exports = new UsageEventRepository();
