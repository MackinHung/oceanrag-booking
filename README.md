# OceanRAG Booking

Google Calendar appointment booking system for OceanRAG. Built as a lightweight Cloudflare Worker that integrates with the OceanRAG contact page.

## Features

- Real-time slot availability via Google Calendar freeBusy API
- Automatic calendar event creation with attendee notifications
- CORS-protected API with IP-based rate limiting
- Zero-cost deployment on Cloudflare Workers Free Tier

## Architecture

```
[Contact Page] → [Cloudflare Worker] → [Google Calendar API]
     ↓                   ↓
  Show slots        freeBusy query
  Book slot         events.insert
```

## Quick Start

1. Set up Google Cloud Console (see [docs/SETUP.md](docs/SETUP.md))
2. Deploy the Worker:

```bash
cd worker
npm install
npx wrangler kv namespace create BOOKING_KV
# Update wrangler.toml with KV namespace ID
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_PRIVATE_KEY
npx wrangler secret put CALENDAR_ID
npx wrangler deploy
```

3. Update `BOOKING_API_URL` in the contact page

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/availability?date=YYYY-MM-DD` | Available time slots |
| POST | `/api/book` | Create booking |

## License

MIT
