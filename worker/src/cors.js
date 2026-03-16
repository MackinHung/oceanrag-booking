/* ============================================================
   cors.js — CORS preflight + rate limiting (KV-based)
   ============================================================ */

const RATE_LIMIT = 10;       // max requests
const RATE_WINDOW = 60;      // per 60 seconds

/**
 * Check if the request origin is allowed.
 * @param {Request} request
 * @param {object} env
 * @returns {string|null} origin if allowed, null otherwise
 */
export function getAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());

  // Always allow localhost for development
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return origin;

  if (allowed.includes(origin)) return origin;

  return null;
}

/**
 * Build CORS headers for a given origin.
 */
export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle OPTIONS preflight.
 */
export function handlePreflight(request, env) {
  const origin = getAllowedOrigin(request, env);
  if (!origin) {
    return new Response('Forbidden', { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

/**
 * Rate limit check using KV. Returns true if within limit.
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<boolean>}
 */
export async function checkRateLimit(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `rl:${ip}`;

  const current = parseInt(await env.BOOKING_KV.get(key) || '0', 10);

  if (current >= RATE_LIMIT) return false;

  await env.BOOKING_KV.put(key, String(current + 1), {
    expirationTtl: RATE_WINDOW,
  });

  return true;
}
