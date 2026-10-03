const prisma = require('../config/database');

class PlanRepository {
  async findById(id) {
    return prisma.plan.findUnique({
      where: { id },
    });
  }

  async findByName(name) {
    return prisma.plan.findUnique({
      where: { name },
    });
  }

  async create(data) {
    return prisma.plan.create({
      data,
    });
  }

  async update(id, data) {
    return prisma.plan.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.plan.delete({
      where: { id },
    });
  }

  async findAll() {
    return prisma.plan.findMany();
  }
}

module.exports = new PlanRepository();
