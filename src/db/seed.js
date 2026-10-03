const prisma = require('../config/database');

async function seed() {
  try {
    console.log('Starting database seed...');

    // Create plans
    const freePlan = await prisma.plan.upsert({
      where: { name: 'Free' },
      update: {},
      create: {
        name: 'Free',
        apiCallLimit: 1000,
        aiTokenLimit: 100000,
        monthlyPriceCents: 0,
      },
    });

    console.log('Created/updated Free plan:', freePlan.name);

    const proPlan = await prisma.plan.upsert({
      where: { name: 'Pro' },
      update: {},
      create: {
        name: 'Pro',
        apiCallLimit: 10000,
        aiTokenLimit: 1000000,
        monthlyPriceCents: 2900, // $29.00 per month
      },
    });

    console.log('Created/updated Pro plan:', proPlan.name);

    // Create tenants
    const tenant1 = await prisma.tenant.upsert({
      where: { email: 'tenant1@example.com' },
      update: {},
      create: {
        name: 'Test Tenant 1',
        email: 'tenant1@example.com',
      },
    });

    console.log('Created/updated Tenant 1:', tenant1.email);

    const tenant2 = await prisma.tenant.upsert({
      where: { email: 'tenant2@example.com' },
      update: {},
      create: {
        name: 'Test Tenant 2',
        email: 'tenant2@example.com',
      },
    });

    console.log('Created/updated Tenant 2:', tenant2.email);

    // Create subscriptions
    await prisma.subscription.upsert({
      where: {
        tenantId_stripeSubscriptionId: {
          tenantId: tenant1.id,
          stripeSubscriptionId: 'sub_free_demo_1',
        },
      },
      update: {},
      create: {
        tenantId: tenant1.id,
        planId: freePlan.id,
        stripeCustomerId: 'cus_free_demo_1',
        stripeSubscriptionId: 'sub_free_demo_1',
        status: 'ACTIVE',
        currentPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        currentPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
    });

    console.log('Created Free subscription for Tenant 1');

    await prisma.subscription.upsert({
      where: {
        tenantId_stripeSubscriptionId: {
          tenantId: tenant2.id,
          stripeSubscriptionId: 'sub_pro_demo_1',
        },
      },
      update: {},
      create: {
        tenantId: tenant2.id,
        planId: proPlan.id,
        stripeCustomerId: 'cus_pro_demo_1',
        stripeSubscriptionId: 'sub_pro_demo_1',
        status: 'ACTIVE',
        currentPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        currentPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
    });

    console.log('Created Pro subscription for Tenant 2');

    // Create some usage events for testing quota boundaries
    // Tenant 1: 250 API calls used (750 remaining)
    for (let i = 0; i < 250; i++) {
      await prisma.usageEvent.create({
        data: {
          tenantId: tenant1.id,
          usageType: 'API_CALL',
          quantity: 1,
          idempotencyKey: `tenant1-api-${i}`,
          costCents: 1,
        },
      });
    }

    console.log('Created 250 API call usage events for Tenant 1');

    // Tenant 1: 25,000 AI tokens used (75,000 remaining)
    await prisma.usageEvent.create({
      data: {
        tenantId: tenant1.id,
        usageType: 'AI_TOKENS',
        quantity: 25000,
        idempotencyKey: 'tenant1-tokens-1',
        metadata: {
          tokens: {
            inputTokens: 10000,
            cachedInputTokens: 5000,
            outputTokens: 8000,
            reasoningTokens: 2000,
          },
        },
        costCents: 4, // Calculated based on pricing
      },
    });

    console.log('Created AI token usage event for Tenant 1');

    // Tenant 2: 500 API calls used (9,500 remaining)
    for (let i = 0; i < 500; i++) {
      await prisma.usageEvent.create({
        data: {
          tenantId: tenant2.id,
          usageType: 'API_CALL',
          quantity: 1,
          idempotencyKey: `tenant2-api-${i}`,
          costCents: 1,
        },
      });
    }

    console.log('Created 500 API call usage events for Tenant 2');

    // Tenant 2: 100,000 AI tokens used (900,000 remaining)
    await prisma.usageEvent.create({
      data: {
        tenantId: tenant2.id,
        usageType: 'AI_TOKENS',
        quantity: 100000,
        idempotencyKey: 'tenant2-tokens-1',
        metadata: {
          tokens: {
            inputTokens: 40000,
            cachedInputTokens: 20000,
            outputTokens: 32000,
            reasoningTokens: 8000,
          },
        },
        costCents: 16, // Calculated based on pricing
      },
    });

    console.log('Created AI token usage event for Tenant 2');

    console.log('Seed completed successfully!');
    console.log('\nTest credentials:');
    console.log('Tenant 1 (Free):', tenant1.id, '- email:', tenant1.email);
    console.log('Tenant 2 (Pro):', tenant2.id, '- email:', tenant2.email);
  } catch (error) {
    console.error('Error during seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
