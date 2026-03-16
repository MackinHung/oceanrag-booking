# OceanRAG Booking — Google Cloud Console Setup

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: **oceanrag-booking**
3. Enable **Google Calendar API**:
   - APIs & Services → Library → search "Google Calendar API" → Enable

## 2. Service Account

1. APIs & Services → Credentials → Create Credentials → Service Account
2. Name: `oceanrag-booking`
3. Skip optional steps → Done
4. Click the created service account → Keys → Add Key → Create new key → JSON
5. Download the JSON key file — you need `client_email` and `private_key`

## 3. Share Calendar

1. Open [Google Calendar](https://calendar.google.com/)
2. Left sidebar → hover your calendar → ⋮ → Settings
3. "Share with specific people or groups" → Add
4. Enter the Service Account email (from the JSON: `client_email`)
5. Permission: **Make changes to events**
6. Copy the **Calendar ID** (in "Integrate calendar" section, usually your Gmail address)

## 4. Deploy Worker

```bash
cd worker

# Install dependencies
npm install

# Create KV namespace
npx wrangler kv namespace create BOOKING_KV
# Copy the id from output into wrangler.toml

# Set secrets
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
# Paste: the client_email from JSON

npx wrangler secret put GOOGLE_PRIVATE_KEY
# Paste: the private_key from JSON (including -----BEGIN/END-----)

npx wrangler secret put CALENDAR_ID
# Paste: your calendar ID

# Deploy
npx wrangler deploy
```

## 5. Verify

```bash
# Health check
curl https://oceanrag-booking.<your-subdomain>.workers.dev/api/health

# Check availability
curl "https://oceanrag-booking.<your-subdomain>.workers.dev/api/availability?date=2026-03-20"
```

## 6. Update Frontend

In `contact.js`, update the `BOOKING_API_URL` constant to match your Worker URL:

```js
const BOOKING_API_URL = 'https://oceanrag-booking.<your-subdomain>.workers.dev';
```

## Cost

| Item | Free Tier | Expected Usage |
|------|-----------|----------------|
| Google Calendar API | 1M req/day | <100/day |
| Cloudflare Worker | 100K req/day | <100/day |
| Cloudflare KV | 100K reads + 1K writes/day | <50/day |
| Email | Calendar attendee auto | $0 |
| **Total** | **$0/month** | |
