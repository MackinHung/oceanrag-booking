/* ============================================================
   email.js — Email notification (reserved for future use)

   Current strategy: Google Calendar attendees automatically
   receive email invitations — zero extra cost.

   This module is a placeholder for future Cloudflare Email
   Workers integration if custom notification emails are needed.
   ============================================================ */

/**
 * Send a notification email about a new booking.
 * Currently a no-op since Google Calendar handles attendee emails.
 *
 * @param {object} booking - { name, company, email, phone, type, message, date, time }
 * @param {object} env
 */
export async function sendNotification(booking, env) {
  // Google Calendar sendUpdates=all handles attendee notifications.
  // Implement Cloudflare Email Workers here if custom emails are needed.
  console.log(`[email] Booking notification: ${booking.name} (${booking.company}) at ${booking.date} ${booking.time}`);
}
