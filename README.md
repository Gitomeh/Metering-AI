# FlyRank Internship Backend Track Capstone
# Usage Metering & Billing Engine

A production-quality backend service that meters customer usage, enforces monthly quotas, calculates usage costs correctly, and integrates with Stripe Test Mode.

## Project Overview

This system implements a complete usage metering and billing engine for a SaaS application with the following core features:

- **Multi-tenant architecture** with isolated usage tracking
- **Idempotent metering** to prevent duplicate usage charges
- **Quota enforcement** with real-time limit checking
- **Cost calculation** for API calls and AI tokens (input, cached input, output, reasoning)
- **Stripe integration** for subscription management and checkout
- **Webhook processing** with signature verification and idempotency
- **Background reconciliation job** to sync Stripe and database state

## Problem Statement

Building a billing system requires correctness under retries, failures, concurrency, and quota boundaries. This capstone demonstrates a production-ready implementation that:

1. Never double-counts usage requests (idempotency)
2. Prevents quota violations even under concurrent load
3. Calculates costs accurately using integer arithmetic
4. Synchronizes local state with Stripe via verified webhooks
5. Enforces tenant isolation for all data access

## Features

- ✅ Two subscription plans (Free and Pro)
- ✅ Multi-tenant data model with PostgreSQL
- ✅ Idempotent usage metering with database constraints
- ✅ Real-time quota enforcement
- ✅ Accurate cost calculation for AI tokens and API calls
- ✅ Stripe Checkout integration (Test Mode)
- ✅ Verified webhook processing with signature verification
- ✅ Background reconciliation job
- ✅ Comprehensive test suite
- ✅ Docker support for PostgreSQL

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: JavaScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Payments**: Stripe (Test Mode)
- **Testing**: Jest + Supertest
- **Containerization**: Docker / Docker Compose

## Architecture

The system follows a clean layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                     HTTP Layer                           │
│                  (Express.js Routes)                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Controller Layer                        │
│         (Request/Response Handling)                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   Service Layer                          │
│         (Business Logic: Metering, Quota, etc.)           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                Repository Layer                          │
│           (Data Access Abstraction)                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   PostgreSQL                             │
│              (via Prisma ORM)                            │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
metering-ai/
├── src/
│   ├── config/           # Configuration files
│   │   ├── index.js      # Main config
│   │   ├── database.js   # Prisma client
│   │   └── pricing.js    # Pricing constants
│   ├── controllers/      # HTTP request handlers
│   ├── services/         # Business logic
│   ├── repositories/     # Data access layer
│   ├── middleware/       # Express middleware
│   ├── routes/           # API routes
│   ├── jobs/             # Background jobs
│   ├── utils/            # Utility functions
│   ├── db/               # Database utilities
│   ├── app.js            # Express app setup
│   └── server.js         # Server entry point
├── prisma/
│   └── schema.prisma     # Database schema
├── tests/                # Test files
├── docker-compose.yml    # PostgreSQL container
├── .env.example          # Environment template
└── package.json
```

## Database Model

### Entities

#### Tenant
Represents a customer account.

- `id` (string, primary key)
- `name` (string)
- `email` (string, unique)
- `createdAt` (datetime)
- `updatedAt` (datetime)

#### Plan
Represents subscription plans.

- `id` (string, primary key)
- `name` (string, unique): "Free" or "Pro"
- `apiCallLimit` (integer): Monthly API call limit
- `aiTokenLimit` (integer): Monthly AI token limit
- `monthlyPriceCents` (integer): Monthly price in cents
- `createdAt` (datetime)
- `updatedAt` (datetime)

#### Subscription
Links tenants to plans with Stripe integration.

- `id` (string, primary key)
- `tenantId` (string, foreign key)
- `planId` (string, foreign key)
- `stripeCustomerId` (string, nullable)
- `stripeSubscriptionId` (string, nullable)
- `status` (enum): ACTIVE, CANCELED, PAST_DUE, etc.
- `currentPeriodStart` (datetime, nullable)
- `currentPeriodEnd` (datetime, nullable)
- `createdAt` (datetime)
- `updatedAt` (datetime)

**Unique constraint**: `UNIQUE(tenantId, stripeSubscriptionId)`

#### UsageEvent
Records individual usage events with idempotency protection.

- `id` (string, primary key)
- `tenantId` (string, foreign key)
- `usageType` (enum): API_CALL or AI_TOKENS
- `quantity` (integer): Amount of usage
- `idempotencyKey` (string): Prevents duplicate charges
- `timestamp` (datetime)
- `metadata` (json): Additional data (token breakdown, etc.)
- `costCents` (integer, nullable): Calculated cost

**Unique constraint**: `UNIQUE(tenantId, idempotencyKey)`

**Indexes**:
- `tenantId`
- `tenantId + timestamp`
- `tenantId + usageType + timestamp`
- `idempotencyKey`

#### StripeEvent
Tracks processed webhook events for idempotency.

- `id` (string, primary key)
- `stripeEventId` (string, unique): Stripe event ID
- `eventType` (string): Type of Stripe event
- `processedAt` (datetime)
- `createdAt` (datetime)

**Unique constraint**: `UNIQUE(stripeEventId)`

## API Endpoints

### Health Check
```
GET /health
```

Returns service health status.

**Response**:
```json
{
  "status": "ok",
  "service": "usage-metering-billing",
  "database": "connected",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Get Plans
```
GET /api/v1/plans
```

Returns available subscription plans.

**Response**:
```json
{
  "plans": [
    {
      "id": "plan-id",
      "name": "Free",
      "apiCallLimit": 1000,
      "aiTokenLimit": 100000,
      "monthlyPriceCents": 0,
      "monthlyPriceUSD": "0.00"
    },
    {
      "id": "plan-id",
      "name": "Pro",
      "apiCallLimit": 10000,
      "aiTokenLimit": 1000000,
      "monthlyPriceCents": 2900,
      "monthlyPriceUSD": "29.00"
    }
  ]
}
```

### Generate (Billable Endpoint)
```
POST /api/v1/generate
Headers:
  X-Tenant-ID: <tenant-id>
  Idempotency-Key: <unique-key>

Body:
{
  "apiCalls": 1,
  "inputTokens": 1000,
  "cachedInputTokens": 500,
  "outputTokens": 800,
  "reasoningTokens": 200
}
```

Simulates an AI generation request, meters usage, enforces quota, and calculates cost.

**Success Response (201)**:
```json
{
  "success": true,
  "idempotent": false,
  "usageEventId": "event-id",
  "costCents": 3,
  "usage": {
    "apiCalls": 1,
    "tokens": {
      "inputTokens": 1000,
      "cachedInputTokens": 500,
      "outputTokens": 800,
      "reasoningTokens": 200
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Idempotent Response (200)**:
```json
{
  "success": true,
  "idempotent": true,
  "usageEventId": "event-id",
  "costCents": 3,
  "usage": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Quota Exceeded (429)**:
```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Monthly API call quota exceeded",
    "details": {
      "usage": 1000,
      "requested": 1,
      "limit": 1000,
      "plan": "Free",
      "usageType": "API_CALL"
    }
  }
}
```

### Get Usage
```
GET /api/v1/usage
Headers:
  X-Tenant-ID: <tenant-id>
```

Returns current usage for the billing period.

**Response**:
```json
{
  "tenant": "tenant-id",
  "plan": {
    "name": "Free",
    "apiCallLimit": 1000,
    "aiTokenLimit": 100000
  },
  "period": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-02-01T00:00:00.000Z"
  },
  "apiCalls": {
    "used": 250,
    "limit": 1000,
    "remaining": 750
  },
  "aiTokens": {
    "used": 25000,
    "limit": 100000,
    "remaining": 75000
  },
  "cost": {
    "currency": "USD",
    "amountCents": 125
  }
}
```

### Create Checkout Session
```
POST /api/v1/billing/checkout
Headers:
  X-Tenant-ID: <tenant-id>
```

Creates a Stripe Checkout session for upgrading to Pro.

**Response**:
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Stripe Webhook
```
POST /api/v1/webhooks/stripe
Headers:
  stripe-signature: <signature>
Body: (raw JSON)
```

Processes Stripe webhook events with signature verification.

**Response**:
```json
{
  "received": true,
  "processed": true,
  "eventId": "evt_...",
  "eventType": "checkout.session.completed",
  "result": { ... }
}
```

## Idempotency Strategy

Idempotency is critical for billing correctness. The system implements multiple layers of protection:

### 1. Database Constraints
- `UNIQUE(tenantId, idempotencyKey)` on UsageEvent table
- `UNIQUE(stripeEventId)` on StripeEvent table

### 2. Application-Level Checks
- Check for existing idempotency key before processing
- Return cached result if key exists

### 3. Transaction Protection
- Double-check idempotency key within database transaction
- Use PostgreSQL row-level locking

### 4. Concurrency Safety
- Transactions ensure only one request succeeds with a given key
- Concurrent requests with same key: one creates, others see existing

### Example Flow

```
Request 1: Idempotency-Key: abc123
→ Check DB: Not found
→ Create usage event
→ Return 201

Request 2: Idempotency-Key: abc123
→ Check DB: Found
→ Return existing result
→ Status: 200 (idempotent)
```

## Quota Strategy

Quota enforcement happens before any billable action:

### 1. Current Usage Calculation
- Sum usage events for current billing period
- Group by usage type (API_CALL, AI_TOKENS)

### 2. Limit Comparison
```
if (currentUsage + requestedUsage > planLimit) {
  reject with 429 or 402
}
```

### 3. HTTP Status Codes
- `429 Too Many Requests`: Quota exceeded
- `402 Payment Required`: Business rule requiring upgrade

### 4. Concurrency Safety
- Check and record usage in a single transaction
- PostgreSQL constraints prevent race conditions
- Two concurrent requests cannot both pass the boundary check

### Boundary Behavior

```
Free Plan: 1,000 API calls/month

Usage: 999, Request: 1 → Allowed (999 + 1 = 1000)
Usage: 1000, Request: 1 → Rejected (1000 + 1 > 1000)
```

## Cost Calculation

### Pricing Constants (in cents)

All pricing uses integer arithmetic to avoid floating-point errors:

```javascript
INPUT_PRICE_PER_MILLION = 50           // $0.50 per million
CACHED_INPUT_PRICE_PER_MILLION = 10    // $0.10 per million
OUTPUT_PRICE_PER_MILLION = 150         // $1.50 per million
API_CALL_PRICE_CENTS = 1               // $0.01 per call
```

### Token Pricing Formula

```
cost = (tokens / 1,000,000) * price_per_million
```

Using integer arithmetic:
```javascript
cost = Math.floor((tokens * PRICE_PER_MILLION) / 1_000_000)
```

### Example Calculation

Input: 1M tokens, Output: 0.5M tokens
```
Input cost:  (1,000,000 * 50) / 1,000,000 = 50 cents
Output cost: (500,000 * 150) / 1,000,000 = 75 cents
Total: 125 cents = $1.25
```

### Reasoning Tokens
Reasoning tokens use the same pricing as output tokens (more expensive than input).

### Cached Input Tokens
Cached input tokens are cheaper (50% discount) to encourage caching.

## Stripe Integration

### Test Mode Only
- Never uses live Stripe mode
- All keys are test keys from `.env`
- Webhook secret is for test mode

### Checkout Flow

1. User requests upgrade via `/api/v1/billing/checkout`
2. Backend creates/retrieves Stripe customer
3. Backend creates Checkout Session with Pro plan
4. Backend returns checkout URL
5. User completes payment in Stripe
6. Stripe sends `checkout.session.completed` webhook
7. Backend processes webhook and updates local subscription

### Webhook Security

1. **Signature Verification**
   - Uses raw request body
   - Verifies with Stripe webhook secret
   - Rejects invalid signatures with 400

2. **Idempotency**
   - Tracks processed event IDs in database
   - Rejects duplicate events
   - Uses transaction for atomic processing

3. **Event Types Handled**
   - `checkout.session.completed`: Creates subscription
   - `customer.subscription.updated`: Updates status
   - `customer.subscription.deleted`: Cancels subscription

### State Synchronization

- Payment truth lives in Stripe
- Local database mirrors Stripe state via webhooks
- GET /api/v1/usage reflects new limits after webhook
- Reconciliation job detects and fixes discrepancies

## Tenant Isolation

### Authentication (Demo)
For this capstone, we use a simple `X-Tenant-ID` header:

```javascript
Headers:
  X-Tenant-ID: <tenant-id>
```

### Authorization Enforcement

- Middleware validates tenant exists
- Controllers use `req.tenantId` from middleware
- Never trust tenant IDs from request body or query params
- All queries filter by authenticated tenant ID

### Example Violation Prevention

```
GET /api/v1/usage?tenantId=another-tenant
→ Ignored: Uses X-Tenant-ID from header, not query param
```

## Background Job

### Reconciliation Job

A background job that syncs Stripe and local database state:

**Purpose**:
- Detect discrepancies between Stripe and local DB
- Auto-fix minor issues (status, period dates)
- Log major issues for manual review

**Schedule**: Run hourly or daily (documented in README)

**Execution**:
```bash
node src/jobs/reconciliationJob.js
```

**Discrepancy Types**:
- `MISSING_LOCAL`: Subscription in Stripe but not local
- `STATUS_MISMATCH`: Status differs between systems
- `PERIOD_MISMATCH`: Period dates differ
- `MISSING_STRIPE`: Local subscription not in Stripe

**Safety**:
- Read-only for major discrepancies
- Auto-fix only for safe updates
- Logs all actions for audit trail

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker (optional, for local PostgreSQL)
- Stripe account (for test mode)

### Environment Setup

1. Clone the repository
2. Copy environment template:
   ```bash
   cp .env.example .env
   ```

3. Configure environment variables in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/metering_billing?schema=public"
   PORT=3000
   NODE_ENV=development
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   STRIPE_PRICE_ID="price_..."
   STRIPE_SUCCESS_URL="http://localhost:3000/billing/success"
   STRIPE_CANCEL_URL="http://localhost:3000/billing/cancel"
   ```

### Database Setup

#### Option 1: Docker (Recommended)

```bash
# Start PostgreSQL
docker compose up -d

# Wait for database to be ready
docker compose logs -f postgres
```

#### Option 2: Local PostgreSQL

Ensure PostgreSQL is running and update `DATABASE_URL` in `.env`.

### Database Migration

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run migrate

# (Optional) Reset database (deletes all data)
npm run migrate:reset
```

### Seed Data

```bash
npm run seed
```

This creates:
- Free and Pro plans
- Two test tenants
- Test subscriptions
- Sample usage events

## Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server runs on `http://localhost:3000`

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

Test suite includes:
- Pricing calculation tests
- Quota enforcement tests
- API endpoint tests
- Idempotency tests
- Validation tests

## Stripe CLI Instructions

For local webhook testing:

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Linux
   curl -s https://packages.stripe.com/api/signing_keys/Linux/STRIPE_GPG_SIGNING_KEY/pub | gpg --dearmor | sudo tee /usr/share/keyrings/stripe-archive-keyring.gpg
   echo "deb [signed-by=/usr/share/keyrings/stripe-archive-keyring.gpg] https://packages.stripe.com/apt stable main" | sudo tee /etc/apt/sources.list.d/stripe.list
   sudo apt update
   sudo apt install stripe
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
   ```

4. Trigger test events:
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger customer.subscription.updated
   stripe trigger customer.subscription.deleted
   ```

## Example API Requests

### Health Check
```bash
curl http://localhost:3000/health
```

### Get Plans
```bash
curl http://localhost:3000/api/v1/plans
```

### Generate (New Request)
```bash
curl -X POST http://localhost:3000/api/v1/generate \
  -H "X-Tenant-ID: <tenant-id>" \
  -H "Idempotency-Key: test-request-001" \
  -H "Content-Type: application/json" \
  -d '{
    "apiCalls": 1,
    "inputTokens": 1000,
    "cachedInputTokens": 500,
    "outputTokens": 800,
    "reasoningTokens": 200
  }'
```

### Generate (Idempotent Retry)
```bash
# Same request with same Idempotency-Key
curl -X POST http://localhost:3000/api/v1/generate \
  -H "X-Tenant-ID: <tenant-id>" \
  -H "Idempotency-Key: test-request-001" \
  -H "Content-Type: application/json" \
  -d '{
    "apiCalls": 1,
    "inputTokens": 1000,
    "cachedInputTokens": 500,
    "outputTokens": 800,
    "reasoningTokens": 200
  }'
```

### Get Usage
```bash
curl http://localhost:3000/api/v1/usage \
  -H "X-Tenant-ID: <tenant-id>"
```

### Create Checkout Session
```bash
curl -X POST http://localhost:3000/api/v1/billing/checkout \
  -H "X-Tenant-ID: <tenant-id>"
```

## Limitations

- No real payments (Test Mode only)
- No live Stripe mode
- No invoicing
- No proration
- No overage billing
- No complex frontend
- No actual AI model integration
- Simple authentication (X-Tenant-ID header)

These are documented as future work, not core requirements.

## Security Notes

### Environment Variables
- All secrets in `.env` (never committed)
- `.env` in `.gitignore`
- `.env.example` with safe placeholders

### Input Validation
- All external inputs validated
- Negative quantities rejected
- Invalid usage types rejected
- Missing headers rejected
- Malformed JSON rejected

### Error Handling
- No stack traces in production responses
- Structured error format
- Appropriate HTTP status codes
- Sensitive data never logged

### Database Security
- Parameterized queries via Prisma ORM
- No SQL injection risk
- Row-level security via tenant isolation

### Stripe Security
- Signature verification for all webhooks
- Raw body used for verification
- Invalid signatures rejected
- Test mode only

## Design Decisions

### Why Prisma ORM?
- Type-safe database access
- Automatic migrations
- Built-in connection pooling
- Excellent TypeScript/JavaScript support

### Why Integer Arithmetic for Money?
- Floating-point errors are unacceptable in billing
- Integer cents/micro-units are precise
- Avoids rounding discrepancies
- Industry best practice

### Why Database Constraints for Idempotency?
- Application-level checks can fail
- Database constraints are always enforced
- Handles race conditions at DB level
- Defense in depth

### Why Separate Repositories?
- Clean separation of concerns
- Easy to test
- Can swap implementations
- Follows repository pattern

### Why Stripe Webhooks?
- Event-driven architecture
- Source of truth in Stripe
- Asynchronous processing
- Reliable state sync

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker compose ps

# View logs
docker compose logs postgres

# Restart container
docker compose restart postgres
```

### Migration Issues
```bash
# Reset database (WARNING: deletes data)
npm run migrate:reset

# Regenerate Prisma Client
npm run prisma:generate
```

### Stripe Webhook Issues
```bash
# Verify webhook secret
echo $STRIPE_WEBHOOK_SECRET

# Test signature verification
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

## License

ISC

## Author

FlyRank Internship Backend Track Capstone
