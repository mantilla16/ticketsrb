const { JWT } = require('google-auth-library');

// Un JWT client por organizador impersonado (igual que en mailer.js, pero con scope de Calendar)
const clients = new Map();
function getClient(email) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !email) return null;
  if (!clients.has(email)) {
    clients.set(email, new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
      subject: email, // impersona al organizador vía Domain-Wide Delegation
    }));
  }
  return clients.get(email);
}

/**
 * Crea un evento en el calendario de `organizerEmail` e invita a `attendees`.
 * start/end son objetos Date; se envían como hora "de pared" en `timeZone`
 * (misma convención que fecha_reunion: los dígitos literales, sin conversión).
 * Nunca lanza — si falla, solo lo registra en consola.
 */
async function createCalendarEvent({ organizerEmail, summary, description, start, end, attendees = [], timeZone = 'America/Bogota' }) {
  try {
    const client = getClient(organizerEmail);
    if (!client) return null;
    const { token } = await client.getAccessToken();
    const naive = (d) => d.toISOString().slice(0, 19);
    const body = {
      summary,
      description,
      start: { dateTime: naive(start), timeZone },
      end:   { dateTime: naive(end),   timeZone },
      attendees: [...new Set(attendees.filter(Boolean))].map(email => ({ email })),
    };
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Calendar API create failed:', res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('createCalendarEvent failed:', err.message);
    return null;
  }
}

module.exports = { createCalendarEvent };
