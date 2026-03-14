# SmartMail AI

AI-powered email assistant that works inside Gmail and Outlook. Compose, reply, summarize, and improve emails with Claude AI.

## Features

- **Smart Compose** - Generate email drafts from topic descriptions with customizable tone
- **Context-Aware Reply** - AI reads the thread and generates relevant replies
- **Email Summarization** - One-click summaries with key points, action items, and deadlines
- **Tone Adjustment** - Make text more formal, friendly, concise, or translate it
- **Follow-Up Reminders** - Set reminders and auto-generate follow-up emails
- **Multi-Language** - Support for 25+ languages with auto-detection
- **Knowledge Base** - Train the AI with your documents via RAG (retrieval-augmented generation)
- **Style Learning** - Learns your writing style from sent emails
- **Web Dashboard** - Analytics, settings, knowledge base management, billing

## Architecture

```
smartmail-ai/
  shared/          Shared TypeScript types and utilities
  api/             Node.js/Express backend API
  extension/       Chrome Extension (Manifest V3)
  dashboard/       Next.js 14 web dashboard
  docs/            API documentation
```

**Stack:**
- Backend: Node.js, Express, TypeScript, Prisma ORM
- Database: PostgreSQL + pgvector, Redis for caching
- AI: Anthropic Claude API (claude-sonnet-4-6)
- Embeddings: Voyage AI (for RAG knowledge base)
- Auth: Google OAuth 2.0
- Payments: Stripe
- Frontend: Next.js 14, Tailwind CSS
- Extension: Chrome Manifest V3, TypeScript, Webpack

## Prerequisites

- Node.js 18+
- PostgreSQL 15+ (with pgvector extension)
- Redis 7+
- Google Cloud Console project (OAuth credentials)
- Anthropic API key
- Stripe account (for billing)
- Voyage AI API key (for embeddings)

## Setup

### 1. Clone and install

```bash
git clone <repository-url>
cd smartmail-ai
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- `ANTHROPIC_API_KEY` - from console.anthropic.com
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - from Google Cloud Console
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` - random secure strings
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` - from Stripe dashboard
- `VOYAGE_API_KEY` - from Voyage AI

### 3. Database setup

```bash
# Create database
createdb smartmail

# Enable pgvector extension
psql smartmail -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run Prisma migrations
cd api
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Start development

```bash
# Terminal 1: API server
npm run dev:api

# Terminal 2: Dashboard
npm run dev:dashboard

# Terminal 3: Extension (builds to extension/build/)
npm run dev:extension
```

### 5. Load the Chrome Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/build/` directory

### 6. Google OAuth Setup

1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials (Web application)
3. Add authorized redirect URI: `http://localhost:3001/api/v1/auth/google/callback`
4. Enable Gmail API in APIs & Services

### 7. Stripe Setup (optional for billing)

1. Create products and prices in Stripe dashboard
2. Set `STRIPE_PRO_PRICE_ID` to your Pro plan price ID
3. For webhooks, run: `stripe listen --forward-to localhost:3001/api/v1/billing/webhook`

## API Documentation

See [docs/api.md](docs/api.md) for the full API reference.

## Testing

```bash
# Run all tests
npm test

# Run API tests only
npm run test:api

# Watch mode
cd api && npm run test:watch
```

## Project Structure

### API (`/api`)
- `prisma/schema.prisma` - Database schema
- `src/index.ts` - Express server entry
- `src/config/` - Configuration, logger, Redis, Prisma
- `src/middleware/` - Auth, rate limiting, error handling
- `src/routes/` - API route handlers
- `src/services/` - Business logic (AI, knowledge, Google, Stripe)
- `src/cron/` - Scheduled tasks (follow-up reminders)
- `src/__tests__/` - Unit tests

### Extension (`/extension`)
- `public/manifest.json` - Chrome extension manifest
- `src/background/` - Service worker (context menus, alarms, auth)
- `src/content/` - Content script (Gmail/Outlook DOM injection)
- `src/popup/` - Extension popup UI
- `src/sidebar/` - Side panel UI
- `src/utils/` - API client, DOM utilities

### Dashboard (`/dashboard`)
- `src/app/` - Next.js App Router pages
- `src/components/` - Reusable React components
- `src/lib/` - API client, auth context

## Security

- All AI calls go through the backend (API keys never exposed client-side)
- JWT authentication with refresh token rotation
- Rate limiting on all endpoints (tiered by plan)
- HTTPS enforced in production
- GDPR-compliant data deletion endpoints
- Minimal Chrome extension permissions (only email domains)
- Input validation with Zod on all API routes
- Content Security Policy headers via Helmet

## Plans

| Feature | Free | Pro ($9.99/mo) | Enterprise |
|---------|------|----------------|------------|
| Emails/month | 25 | Unlimited | Custom |
| Knowledge docs | 3 | 50 | Unlimited |
| Tone options | Basic | All | All |
| Style learning | - | Yes | Yes |
| Multi-language | - | Yes | Yes |
| API access | - | - | Yes |
| Support | Community | Priority | Dedicated |

## License

MIT
