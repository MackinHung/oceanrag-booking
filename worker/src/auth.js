/* ============================================================
   auth.js — Google Service Account JWT + Token Cache
   Uses Web Crypto API (RS256) for Cloudflare Workers
   ============================================================ */

const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const KV_TOKEN_KEY = 'gtoken';
const TOKEN_TTL = 3300; // 55 minutes

/**
 * Get a valid Google access token (from KV cache or fresh JWT exchange).
 * @param {object} env - Worker env bindings
 * @returns {Promise<string>} access_token
 */
export async function getAccessToken(env) {
  // 1. Try KV cache
  const cached = await env.BOOKING_KV.get(KV_TOKEN_KEY);
  if (cached) return cached;

  // 2. Mint fresh JWT and exchange for access token
  const jwt = await buildSignedJwt(env);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const token = data.access_token;

  // 3. Cache in KV
  await env.BOOKING_KV.put(KV_TOKEN_KEY, token, { expirationTtl: TOKEN_TTL });

  return token;
}

/* ---- Internal helpers ---- */

async function buildSignedJwt(env) {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + TOKEN_TTL,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(env.GOOGLE_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64url(signature)}`;
}

async function importPrivateKey(pem) {
  // Strip PEM header/footer and whitespace
  const pemContents = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function base64url(input) {
  let str;
  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    // ArrayBuffer → base64
    const bytes = new Uint8Array(input);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
