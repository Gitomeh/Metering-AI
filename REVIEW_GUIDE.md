# Review Guide for Metering-AI

This guide helps reviewers evaluate the FlyRank Internship Backend Track Capstone - Usage Metering & Billing Engine.

## Quick Start for Reviewers

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (or Docker)
- Stripe account (Test Mode)
- Git

### Setup (5 minutes)
```bash
# Clone repository
git clone https://github.com/Gitomeh/Metering-AI.git
cd Metering-AI

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Stripe test keys and database URL

# Start database (Docker)
docker compose up -d

# Run migrations
npm run migrate

# Seed test data
npm run seed

# Start server
npm run dev
```

### Quick Verification
```bash
# Health check
curl http://localhost:3000/health

# View plans
curl http://localhost:3000/api/v1/plans

# Run tests
npm test
```

---

## What to Review

### 1. Architecture & Code Quality

#### Layered Architecture
- **HTTP Layer** (`src/routes/`, `src/controllers/`)
  - Clean separation of concerns
  - Minimal business logic in controllers
  - Consistent error handling

- **Service Layer** (`src/services/`)
  - Business logic isolated here
  - Pricing, quota, metering, Stripe services
  - Small, focused functions

- **Repository Layer** (`src/repositories/`)
  - Data access abstraction
  - Prisma ORM usage
  - Reusable query patterns

#### Key Files to Review
- `src/app.js` - Application setup and middleware
- `src/server.js` - Server entry point and graceful shutdown
- `src/config/pricing.js` - Pricing constants (integer arithmetic)
- `prisma/schema.prisma` - Database schema with constraints

#### Code Quality Indicators
- ✅ Async/await throughout
- ✅ Consistent error handling
- ✅ Input validation
- ✅ Minimal comments (code is self-documenting)
- ✅ Configuration management
- ✅ No hardcoded secrets

---

### 2. Idempotency Implementation

#### Critical for Billing Correctness

**Database-Level Protection:**
```prisma
// prisma/schema.prisma
model UsageEvent {
  @@unique([tenantId, idempotencyKey])
}

model StripeEvent {
  @@unique([stripeEventId])
}
```

**Application-Level Protection:**
- Check idempotency key before processing
- Double-check within transaction
- Return cached result if exists

**Review in:**
- `src/services/meteringService.js` - `recordGeneration()`
- `src/services/stripeService.js` - `processWebhook()`

**Test Case:**
```bash
# Request 1
curl -X POST http://localhost:3000/api/v1/generate \
  -H "X-Tenant-ID: <tenant-id>" \
  -H "Idempotency-Key: test-001" \
  -d '{"apiCalls": 1, "inputTokens": 1000}'
# Expected: 201 Created

# Request 2 (same key)
curl -X POST http://localhost:3000/api/v1/generate \
  -H "X-Tenant-ID: <tenant-id>" \
  -H "Idempotency-Key: test-001" \
  -d '{"apiCalls": 1, "inputTokens": 1000}'
# Expected: 200 OK, same usageEventId
```

---

### 3. Quota Enforcement

#### Boundary Behavior

**Critical Test Case:**
```bash
# Setup: Tenant with 999 API calls used (Free plan limit: 1000)
# Request 1 more → Should be ALLOWED
curl -X POST http://localhost:3000/api/v1/generate \
  -H "X-Tenant-ID: <tenant-id>" \
  -H "Idempotency-Key: test-boundary" \
  -d '{"apiCalls": 1}'
# Expected: 201 Created

# Now at 1000, request 1 more → Should be REJECTED
curl -X POST http://localhost:3000/api/v1/generate \
  -H "X-Tenant-ID: <tenant-id>" \
  -H "Idempotency-Key: test-exceed" \
  -d '{"apiCalls": 1}'
# Expected: 429 Too Many Requests
```

**Review in:**
- `src/services/quotaService.js` - `checkQuota()`
- Note: Uses `<` not `<=` for boundary check

---

### 4. Cost Calculation

#### Integer Arithmetic (No Floating-Point)

**Pricing Constants:**
```javascript
// src/config/pricing.js
INPUT_PRICE_PER_MILLION = 50           // $0.50 per million
CACHED_INPUT_PRICE_PER_MILLION = 10    // $0.10 per million
OUTPUT_PRICE_PER_MILLION = 150         // $1.50 per million
API_CALL_PRICE_CENTS = 1               // $0.01 per call
```

**Formula:**
```javascript
cost = Math.floor((tokens * PRICE_PER_MILLION) / 1_000_000)
```

**Example:**
- 1M input tokens = 50 cents
- 0.5M cached input = 5 cents
- 0.8M output = 120 cents
- 0.2M reasoning = 30 cents
- Total: 205 cents = $2.05

**Review in:**
- `src/services/pricingService.js`
- `tests/pricingService.test.js` (11 tests, all passing)

---

### 5. Stripe Integration

#### Security & Idempotency

**Webhook Signature Verification:**
- Uses raw request body (not parsed JSON)
- Verifies with Stripe webhook secret
- Rejects invalid signatures with 400

**Event Tracking:**
- Records processed events in StripeEvent table
- Unique constraint prevents replay attacks

**Review in:**
- `src/services/stripeService.js`
- `src/controllers/billingController.js` - webhook handler

**Test with Stripe CLI:**
```bash
# Forward webhooks
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

---

### 6. Tenant Isolation

#### Authorization Enforcement

**Implementation:**
- Middleware validates `X-Tenant-ID` header
- Controllers use `req.tenantId` from middleware
- Query params for tenant ID are ignored
- All repository queries filter by tenant ID

**Review in:**
- `src/middleware/tenantAuth.js`
- `src/controllers/*.js` (all use req.tenantId)

**Test Case:**
```bash
# Tenant A tries to access Tenant B's usage
curl "http://localhost:3000/api/v1/usage?tenantId=tenant-b-id" \
  -H "X-Tenant-ID: tenant-a-id"
# Expected: Shows only Tenant A's usage (query param ignored)
```

---

### 7. Database Schema

#### Critical Constraints

**Idempotency:**
```prisma
@@unique([tenantId, idempotencyKey])  // UsageEvent
@@unique([stripeEventId])              // StripeEvent
```

**Subscription:**
```prisma
@@unique([tenantId, stripeSubscriptionId])
```

**Indexes for Performance:**
```prisma
@@index([tenantId])
@@index([tenantId, timestamp])
@@index([tenantId, usageType, timestamp])
```

**Review in:**
- `prisma/schema.prisma`

---

### 8. Background Job

#### Reconciliation Job

**Purpose:**
- Sync Stripe and local database state
- Detect discrepancies
- Auto-fix safe issues
- Log major issues for manual review

**Review in:**
- `src/jobs/reconciliationJob.js`

**Run manually:**
```bash
node src/jobs/reconciliationJob.js
```

---

### 9. Testing

#### Test Suite

**Unit Tests (18 tests, all passing):**
- Pricing calculation (11 tests)
- Quota enforcement (4 tests, mocked)
- API validation (3 tests, mocked)

**Run tests:**
```bash
npm test
npm test -- --coverage
```

**Review in:**
- `tests/pricingService.test.js`
- `tests/quotaService.test.js`
- `tests/api.test.js`

**Note:** Integration tests require running database and Stripe CLI (not executed at build time due to environment limitations).

---

### 10. Security Checklist

#### Implemented ✅
- Environment-based secrets (`.env` not in Git)
- Stripe signature verification
- Tenant authorization middleware
- Input validation (negative values, missing fields)
- Parameterized queries (Prisma ORM)
- No stack traces in production responses
- No secrets in logs
- `.env` in `.gitignore`

#### Not Implemented (Out of Scope)
- Real authentication (JWT, OAuth) - uses `X-Tenant-ID` header for demo
- CSRF protection
- CORS configuration
- Rate limiting
- Request size limits

---

## Common Reviewer Questions

### Q: Why use integer arithmetic for money?
**A:** Floating-point arithmetic has precision errors that are unacceptable in billing. Integer cents/micro-units are precise and industry standard.

### Q: Why database constraints for idempotency?
**A:** Application-level checks can fail due to crashes, race conditions, or bugs. Database constraints are always enforced and provide defense in depth.

### Q: Why separate repository layer?
**A:** Clean separation of concerns, easier testing, ability to swap implementations, follows repository pattern.

### Q: Why Stripe webhooks instead of polling?
**A:** Event-driven architecture, source of truth in Stripe, asynchronous processing, reliable state sync.

### Q: Why X-Tenant-ID header for auth?
**A:** Spec allowed simple development auth. Structure allows real auth (JWT, OAuth) to be added later. Documented in README.

### Q: What about Docker?
**A:** Docker Compose configuration provided for PostgreSQL. If Docker unavailable, local PostgreSQL can be used (update DATABASE_URL in .env).

---

## Evaluation Checklist

### Core Functionality
- [ ] Two subscription plans (Free, Pro) exist
- [ ] Multi-tenant data model with proper isolation
- [ ] Idempotent metering works (same key → same result)
- [ ] Quota enforcement at boundary (999 + 1 = 1000 allowed)
- [ ] Quota exceeded rejected (1000 + 1 rejected)
- [ ] Cost calculation accurate (integer arithmetic)
- [ ] Stripe Checkout creates session
- [ ] Webhook signature verification works
- [ ] Webhook replay protection works
- [ ] Free → Pro syncs correctly
- [ ] Tenant isolation enforced
- [ ] Background job runs successfully

### Code Quality
- [ ] Clean layered architecture
- [ ] Small, focused functions
- [ ] Consistent error handling
- [ ] Input validation
- [ ] No hardcoded secrets
- [ ] Async/await throughout
- [ ] Configuration management

### Database
- [ ] Proper migrations
- [ ] Required indexes
- [ ] Unique constraints for idempotency
- [ ] Foreign key relationships
- [ ] Transactions for critical operations

### Tests
- [ ] Test suite exists
- [ ] Tests pass
- [ ] Covers critical paths
- [ ] Unit tests for pricing
- [ ] Unit tests for quota
- [ ] API validation tests

### Documentation
- [ ] Professional README.md
- [ ] Architecture diagram
- [ ] API documentation
- [ ] Installation instructions
- [ ] BUILDLOG.md (AI assistance tracking)
- [ ] EVIDENCE.md (requirement evidence)
- [ ] .env.example

### Security
- [ ] Environment-based secrets
- [ ] Stripe signature verification
- [ ] Tenant authorization
- [ ] Input validation
- [ ] Parameterized queries
- [ ] No secrets in Git
- [ ] No stack traces in production

---

## Known Limitations

- Test Mode only (no live Stripe)
- No real authentication (uses X-Tenant-ID header)
- No invoicing
- No proration
- No overage billing
- No complex frontend
- No actual AI model integration

These are documented as future work, not core requirements.

---

## Performance Considerations

### Database Indexes
- All queries filter by tenantId (indexed)
- Time-range queries use composite indexes
- Idempotency key lookup indexed

### Connection Pooling
- Prisma handles connection pooling automatically
- Configured in `src/config/database.js`

### Scalability
- Stateless design (horizontal scaling possible)
- Background job can be externalized (Celery, Bull)
- Caching can be added for plan lookups

---

## Deployment Notes

### Environment Variables Required
```env
DATABASE_URL="postgresql://..."
PORT=3000
NODE_ENV=production
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."
STRIPE_SUCCESS_URL="https://..."
STRIPE_CANCEL_URL="https://..."
```

### Database Migration
```bash
npm run migrate
```

### Seed Data (Optional)
```bash
npm run seed
```

### Start Server
```bash
npm start
```

---

## Contact & Support

For questions about this capstone:
- Review the BUILDLOG.md for development history
- Review the EVIDENCE.md for requirement evidence
- Review the README.md for full documentation

---

## Additional Context

### AI Assistance
This project was developed with significant AI assistance from Devin (Cognition). See BUILDLOG.md for detailed tracking of AI vs. human contributions.

### Development Time
- Total Lines of Code: ~3,500
- Total Files: ~35
- Development Time: ~4 hours (AI-assisted)
- Manual Time: ~30 minutes (review, fixes, guidance)

### Compliance
Fully compliant with FlyRank Backend Track Capstone specification. See EVIDENCE.md for detailed requirement mapping.
