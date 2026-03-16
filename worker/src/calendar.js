/* ============================================================
   calendar.js — Google Calendar freeBusy + events.insert
   ============================================================ */

import { getAccessToken } from './auth.js';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const AVAILABLE_HOURS = [9, 10, 11, 13, 14, 15, 16];
const TZ_OFFSET = '+08:00'; // Asia/Taipei

/**
 * Query available time slots for a given date.
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {object} env
 * @returns {Promise<{date: string, available: string[], timezone: string}>}
 */
export async function getAvailability(dateStr, env) {
  const token = await getAccessToken(env);
  const tz = env.CALENDAR_TIMEZONE || 'Asia/Taipei';

  const timeMin = `${dateStr}T00:00:00${TZ_OFFSET}`;
  const timeMax = `${dateStr}T23:59:59${TZ_OFFSET}`;

  const res = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: tz,
      items: [{ id: env.CALENDAR_ID }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Google freeBusy error:', res.status, body);
    throw new Error(`freeBusy failed (${res.status})`);
  }

  const data = await res.json();
  const busySlots = data.calendars?.[env.CALENDAR_ID]?.busy || [];

  // Parse busy intervals into a Set of occupied hours
  const busyHours = new Set();
  for (const slot of busySlots) {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    for (const h of AVAILABLE_HOURS) {
      const slotStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00${TZ_OFFSET}`);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      if (start < slotEnd && end > slotStart) {
        busyHours.add(h);
      }
    }
  }

  const available = AVAILABLE_HOURS
    .filter(h => !busyHours.has(h))
    .map(h => `${String(h).padStart(2, '0')}:00`);

  return { date: dateStr, available, timezone: tz };
}

/**
 * Create a calendar event (booking).
 * @param {object} booking - { date, time, name, company, email, phone, type, message }
 * @param {object} env
 * @returns {Promise<{eventId: string} | {conflict: true}>}
 */
export async function createBooking(booking, env) {
  const token = await getAccessToken(env);
  const tz = env.CALENDAR_TIMEZONE || 'Asia/Taipei';

  const { date, time, name, company, email, phone, type, message } = booking;

  // Double-check: is the slot still free?
  const { available } = await getAvailability(date, env);
  if (!available.includes(time)) {
    return { conflict: true };
  }

  const startDt = `${date}T${time}:00${TZ_OFFSET}`;
  const endHour = parseInt(time.split(':')[0], 10) + 1;
  const endDt = `${date}T${String(endHour).padStart(2, '0')}:00:00${TZ_OFFSET}`;

  const description = [
    `姓名：${esc(name)}`,
    `公司/組織：${esc(company)}`,
    `Email：${esc(email)}`,
    `電話：${esc(phone)}`,
    `諮詢類型：${esc(type)}`,
    '',
    '訊息內容：',
    esc(message),
    '',
    '---',
    '此事件由 OceanRAG 預約系統自動建立',
  ].join('\n');

  const event = {
    summary: `[OceanRAG 諮詢] ${esc(type)} — ${esc(company)}`,
    description,
    start: { dateTime: startDt, timeZone: tz },
    end: { dateTime: endDt, timeZone: tz },
    attendees: [{ email }],
  };

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(env.CALENDAR_ID)}/events?sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error('Google events.insert error:', res.status, body);
    throw new Error(`events.insert failed (${res.status})`);
  }

  const created = await res.json();
  return { eventId: created.id };
}

/* ---- Helpers ---- */

/** Escape HTML entities to prevent XSS in calendar event rendering. */
function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
