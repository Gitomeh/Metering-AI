const prisma = require('../config/database');

class StripeEventRepository {
  async findById(id) {
    return prisma.stripeEvent.findUnique({
      where: { id },
    });
  }

  async findByStripeEventId(stripeEventId) {
    return prisma.stripeEvent.findUnique({
      where: { stripeEventId },
    });
  }

  async create(data) {
    return prisma.stripeEvent.create({
      data,
    });
  }

  async markAsProcessed(stripeEventId) {
    return prisma.stripeEvent.create({
      data: {
        stripeEventId,
        eventType: 'unknown',
        processedAt: new Date(),
      },
    });
  }

  async delete(id) {
    return prisma.stripeEvent.delete({
      where: { id },
    });
  }

  async findAll() {
    return prisma.stripeEvent.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

module.exports = new StripeEventRepository();
