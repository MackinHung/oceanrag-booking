/* ============================================================
   index.js — OceanRAG Booking Worker (Router)
   ============================================================ */

import { getAvailability, createBooking } from './calendar.js';
import {
  getAllowedOrigin,
  corsHeaders,
  handlePreflight,
  checkRateLimit,
} from './cors.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return handlePreflight(request, env);
    }

    // Origin check for non-GET requests
    const origin = getAllowedOrigin(request, env);

    try {
      // --- Routes ---
      if (method === 'GET' && pathname === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, origin);
      }

      if (method === 'GET' && pathname === '/api/availability') {
        return await handleAvailability(url, env, origin);
      }

      if (method === 'POST' && pathname === '/api/book') {
        return await handleBook(request, env, origin);
      }

      return jsonResponse({ error: 'Not found' }, origin, 404);
    } catch (err) {
      console.error('Unhandled error:', err);
      return jsonResponse(
        { error: 'Internal server error' },
        origin,
        500,
      );
    }
  },
};

/* ---- Route Handlers ---- */

async function handleAvailability(url, env, origin) {
  const dateStr = url.searchParams.get('date');

  // Validate date format
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return jsonResponse(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      origin,
      400,
    );
  }

  // Validate not in the past (Asia/Taipei = UTC+8)
  const now = new Date();
  const todayTaipei = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const todayStr = todayTaipei.toISOString().slice(0, 10);
  if (dateStr < todayStr) {
    return jsonResponse({ error: 'Cannot query past dates' }, origin, 400);
  }

  const result = await getAvailability(dateStr, env);
  return jsonResponse(result, origin);
}

async function handleBook(request, env, origin) {
  // Rate limit
  const withinLimit = await checkRateLimit(request, env);
  if (!withinLimit) {
    return jsonResponse(
      { error: 'Too many requests. Please try again later.' },
      origin,
      429,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, origin, 400);
  }

  // Validate required fields
  const { date, time, name, company, email, phone, type, message } = body;
  const missing = [];
  if (!date) missing.push('date');
  if (!time) missing.push('time');
  if (!name?.trim()) missing.push('name');
  if (!company?.trim()) missing.push('company');
  if (!email?.trim()) missing.push('email');
  if (!phone?.trim()) missing.push('phone');
  if (!type?.trim()) missing.push('type');
  if (!message?.trim()) missing.push('message');

  if (missing.length > 0) {
    return jsonResponse(
      { error: `Missing required fields: ${missing.join(', ')}` },
      origin,
      400,
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({ error: 'Invalid date format' }, origin, 400);
  }

  // Validate time format
  if (!/^\d{2}:00$/.test(time)) {
    return jsonResponse({ error: 'Invalid time format' }, origin, 400);
  }

  // Validate email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return jsonResponse({ error: 'Invalid email address' }, origin, 400);
  }

  // Validate phone
  if (!/^[0-9\-+()]{7,20}$/.test(phone.trim())) {
    return jsonResponse({ error: 'Invalid phone number' }, origin, 400);
  }

  // Create booking
  const result = await createBooking(
    { date, time, name: name.trim(), company: company.trim(),
      email: email.trim(), phone: phone.trim(), type: type.trim(),
      message: message.trim() },
    env,
  );

  if (result.conflict) {
    return jsonResponse(
      { error: 'This time slot is no longer available. Please choose another.' },
      origin,
      409,
    );
  }

  return jsonResponse({ success: true, eventId: result.eventId }, origin);
}

/* ---- Helpers ---- */

function jsonResponse(data, origin, status = 200) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(data), { status, headers });
}
