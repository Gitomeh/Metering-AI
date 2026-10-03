/**
 * Pricing Configuration
 *
 * All pricing constants are stored here in integer cents/micro-units.
 * Never use floating-point arithmetic for monetary calculations.
 *
 * Token Pricing (per million tokens):
 * - Input tokens: $0.50 per million = 50 cents per million
 * - Cached input tokens: $0.10 per million = 10 cents per million (cheaper)
 * - Output tokens: $1.50 per million = 150 cents per million
 * - Reasoning tokens: same as output tokens
 *
 * API Call Pricing:
 * - $0.001 per API call = 0.1 cents per call
 */

// Token pricing in CENTS per MILLION tokens
const INPUT_PRICE_PER_MILLION = 50; // $0.50 per million input tokens
const CACHED_INPUT_PRICE_PER_MILLION = 10; // $0.10 per million cached input tokens
const OUTPUT_PRICE_PER_MILLION = 150; // $1.50 per million output tokens

// API call pricing in CENTS per call
const API_CALL_PRICE_CENTS = 1; // $0.01 per API call (1 cent)

module.exports = {
  INPUT_PRICE_PER_MILLION,
  CACHED_INPUT_PRICE_PER_MILLION,
  OUTPUT_PRICE_PER_MILLION,
  API_CALL_PRICE_CENTS,
};
