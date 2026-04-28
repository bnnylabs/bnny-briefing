/**
 * Centralized Anthropic SDK client.
 *
 * Replaces five copies of `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`
 * scattered across API routes. The five copies all suffered the same bug:
 * if the env var was missing, the SDK silently constructed a client with
 * `apiKey: undefined`, and the failure surfaced only on the first request
 * with a generic "Authentication failed" message in the Vercel logs.
 *
 * Importing this module at boot validates the env var. If it's missing,
 * the route returns a 500 immediately instead of pretending to be
 * available and then failing weirdly on first AI call.
 */

import Anthropic from '@anthropic-ai/sdk'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error(
    'ANTHROPIC_API_KEY environment variable is required. AI endpoints will not function without it.',
  )
}

/**
 * Shared Anthropic client. All routes that talk to Claude should import
 * this rather than constructing their own — keeps timeouts, retries,
 * and base URL config in one place if we ever need to tune it.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
