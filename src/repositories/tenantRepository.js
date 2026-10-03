const prisma = require('../config/database');

class TenantRepository {
  async findById(id) {
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: {
            plan: true,
          },
        },
      },
    });
  }

  async findByEmail(email) {
    return prisma.tenant.findUnique({
      where: { email },
      include: {
        subscriptions: {
          include: {
            plan: true,
          },
        },
      },
    });
  }

  async create(data) {
    return prisma.tenant.create({
      data,
    });
  }

  async update(id, data) {
    return prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.tenant.delete({
      where: { id },
    });
  }

  async findAll() {
    return prisma.tenant.findMany({
      include: {
        subscriptions: {
          include: {
            plan: true,
          },
        },
      },
    });
  }
}

module.exports = new TenantRepository();
