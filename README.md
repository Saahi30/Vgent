# Vgent

Multi-tenant Voice AI Agent SaaS Platform

Vgent is a platform where businesses create AI voice agents that make outbound phone calls, carry on intelligent conversations, and serve any business purpose. It features pluggable telephony, LLM, STT, and TTS providers, a superadmin panel, and per-tenant dashboards.

---

## Features

- **Outbound AI Calls** -- Automated voice calls powered by an STT -> LLM -> TTS pipeline with voice activity detection and interrupt handling
- **Multi-Tenant Architecture** -- Tenant isolation with Supabase RLS, three roles (superadmin, owner, member), and per-tenant dashboards
- **Pluggable Providers** -- Swap LLM, STT, TTS, and telephony providers per agent without code changes
- **Campaign Dialer** -- CSV contact import, scheduled campaigns, retry logic, concurrent call limits, and live progress tracking
- **Knowledge Base / RAG** -- Upload documents (PDF, DOCX, TXT, CSV, URL), chunk and embed with pgvector, and inject context into calls
- **Live Monitoring** -- Real-time call monitoring dashboard via WebSocket with mission-control grid view
- **WebRTC Agent Testing** -- Test agents in-browser with live transcript (powered by LiveKit)
- **Admin Panel** -- Platform-wide tenant management, call oversight, and system health monitoring

---

## Tech Stack

| Layer | Technology |
|------------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Zustand, TanStack Query |
| Backend | FastAPI (Python 3.11+), async, SQLAlchemy 2.0, Alembic |
| Database | Supabase (PostgreSQL 15 + pgvector + RLS) |
| Task Queue | Celery + Redis |
| Cache | Redis |
| Real-time | WebSocket, LiveKit (WebRTC) |
| Auth | Supabase Auth (JWT) |
| Monorepo | Turborepo + pnpm workspaces |

---

## Provider Support

### LLM

| Provider | Free Tier | Priority |
|--------------|-------------------------|----------|
| Groq | Generous free tier | P0 |
| Google Gemini | 15 RPM, 1M tokens/day | P0 |
| Mistral | Free tier | P1 |
| Together AI | $5 signup credits | P1 |
| Cohere | Free trial | P2 |
| OpenAI | Paid only | P2 |
| Anthropic | Paid only | P2 |

### STT (Speech-to-Text)

| Provider | Free Tier | Priority |
|----------------|-------------------------|----------|
| Deepgram | $200 free credits | P0 |
| Google Cloud STT | 60 min/month free | P1 |
| AssemblyAI | $50 free credits | P1 |
| Azure STT | 5 hrs/month free | P2 |
| OpenAI Whisper | Paid only | P2 |

### TTS (Text-to-Speech)

| Provider | Free Tier | Priority |
|----------------|-------------------------|----------|
| Edge TTS | Free, no API key needed | P0 |
| gTTS | Free, no API key needed | P0 |
| Sarvam AI | Free tier (Indian langs) | P0 |
| Google Cloud TTS | 4M chars/month free | P1 |
| ElevenLabs | 10K chars/month free | P1 |
| Deepgram Aura | Uses Deepgram credits | P1 |
| Cartesia | Limited free | P2 |
| Azure TTS | 5M chars/month free | P2 |
| OpenAI TTS | Paid only | P2 |

### Telephony

| Provider | Free Tier | Priority |
|----------|------------------------|----------|
| WebRTC | Free (browser-based) | P0 |
| Twilio | $15 trial credit | P0 |
| Vobiz | TBD | P1 |
| Plivo | Trial credits | P1 |

---

## Project Structure

```
vgent/
├── apps/
│   ├── api/                    # FastAPI backend
│   │   ├── app/                # Application modules
│   │   ├── main.py             # FastAPI entry point
│   │   ├── celery_app.py       # Celery configuration
│   │   ├── agent_worker.py     # Voice agent worker
│   │   ├── tests/              # Backend tests (pytest)
│   │   └── requirements.txt    # Python dependencies
│   └── web/                    # Next.js 14 frontend
│       └── src/
│           ├── app/            # App Router pages
│           ├── components/     # UI components
│           ├── hooks/          # React hooks
│           ├── lib/            # API client, utilities
│           └── store/          # Zustand stores
├── packages/
│   ├── database/               # SQL migrations and seed data
│   │   ├── migrations/         # Numbered migration files
│   │   └── seed.sql            # Initial seed data
│   ├── shared-types/           # Shared TypeScript types
│   └── ui/                     # Shared UI components
├── scripts/
│   └── setup.sh                # Local development setup script
├── turbo.json                  # Turborepo configuration
├── pnpm-workspace.yaml         # pnpm workspace config
└── .env.example                # Environment variable template
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- Python 3.11+
- PostgreSQL 15 (via Supabase)
- Redis

On macOS:

```bash
brew install node pnpm python@3.11 redis
```

### Setup

1. **Clone the repository:**

```bash
git clone https://github.com/your-org/vgent.git
cd vgent
```

2. **Run the setup script:**

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This will check prerequisites, create `.env.local` from `.env.example`, generate secret keys, install Node and Python dependencies, and start Redis.

3. **Configure environment variables:**

Open `.env.local` and fill in your credentials. At minimum you need:

- Supabase URL and keys
- At least one LLM provider key (Groq recommended)
- At least one STT provider key (Deepgram recommended)

See the [Environment Variables](#environment-variables) section for the full list.

4. **Run database migrations:**

In the Supabase SQL Editor, execute in order:

```
packages/database/migrations/001_initial.sql
packages/database/migrations/002_rls.sql
packages/database/migrations/003_functions.sql
packages/database/seed.sql
```

5. **Start the dev servers:**

```bash
# Terminal 1 -- API server
cd apps/api && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 2 -- Frontend
cd apps/web && pnpm dev

# Terminal 3 -- Celery worker (for campaigns, indexing)
cd apps/api && source .venv/bin/activate && celery -A celery_app worker --loglevel=info
```

Or use the root scripts:

```bash
pnpm dev:api     # FastAPI on port 8000
pnpm dev:web     # Next.js on port 3000
pnpm dev:worker  # Celery worker
pnpm dev:beat    # Celery beat (scheduled tasks)
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection URL (default: `redis://localhost:6379`) | Yes |
| `API_SECRET_KEY` | JWT signing secret (auto-generated by setup script) | Yes |
| `FERNET_ENCRYPTION_KEY` | Provider credential encryption key (auto-generated) | Yes |
| `GROQ_API_KEY` | Groq LLM API key | Recommended |
| `GOOGLE_API_KEY` | Google Gemini / Cloud STT / Cloud TTS key | Optional |
| `DEEPGRAM_API_KEY` | Deepgram STT API key | Recommended |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | For phone calls |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | For phone calls |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (E.164 format) | For phone calls |
| `CELERY_BROKER_URL` | Celery broker URL (default: `redis://localhost:6379/0`) | Yes |
| `NEXT_PUBLIC_APP_URL` | Frontend URL (default: `http://localhost:3000`) | Yes |
| `API_URL` | Backend URL (default: `http://localhost:8000`) | Yes |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (default: `ws://localhost:8000`) | Yes |

Edge TTS and gTTS require no API keys and work out of the box.

See `.env.example` for the complete list with signup links for each provider.

---

## Development

### Running Dev Servers

```bash
# All services via Turborepo
pnpm dev

# Individual services
pnpm dev:api      # FastAPI with hot reload on port 8000
pnpm dev:web      # Next.js on port 3000
pnpm dev:worker   # Celery worker
pnpm dev:beat     # Celery beat scheduler
```

### Building

```bash
pnpm build
```

### Linting

```bash
pnpm lint
```

### Running Tests

```bash
# Backend tests
cd apps/api && source .venv/bin/activate && pytest

# Frontend (from apps/web)
cd apps/web && pnpm lint
```

---

## Architecture

### Call Flow

Vgent uses a real-time STT -> LLM -> TTS pipeline for voice conversations:

```
                   ┌─────────────┐
  Phone/WebRTC --> │  STT Engine  │ --> Transcribed text
                   └─────────────┘
                         │
                         v
                   ┌─────────────┐
  Agent prompt + --│  LLM Engine  │ --> Response text
  RAG context      └─────────────┘
                         │
                         v
                   ┌─────────────┐
                   │  TTS Engine  │ --> Audio stream --> Phone/WebRTC
                   └─────────────┘
```

1. **Telephony layer** (Twilio Media Streams / WebRTC via LiveKit) captures audio from the call.
2. **Voice Activity Detection** (webrtcvad) detects when the caller is speaking and handles interrupts.
3. **STT** (Deepgram streaming, Google, AssemblyAI) transcribes speech to text in real time.
4. **LLM** (Groq, Gemini, Mistral, etc.) generates a contextual response using the agent prompt, conversation history, and optionally RAG-retrieved knowledge base chunks.
5. **TTS** (Edge TTS, gTTS, Sarvam, ElevenLabs, etc.) converts the response to audio and streams it back.
6. **Call events** are published via Redis pub/sub to the WebSocket server for live monitoring.

### Campaign Dialer

The Celery-based campaign dialer manages bulk outbound calls with configurable concurrency limits, calling hours, retry policies, and real-time progress updates via WebSocket.

### Knowledge Base (RAG)

Documents are chunked (512 tokens, 50 token overlap), embedded, and stored in PostgreSQL via pgvector. During calls, the top 5 most relevant chunks are retrieved and injected into the LLM context.

---

## License

MIT
