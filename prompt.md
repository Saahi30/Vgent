# MASTER BUILD PROMPT — Voice AI Agent SaaS Platform
# Give this entire file to Claude Code as your starting prompt.

---

## MISSION

You are building a **production-grade, multi-tenant SaaS voice AI platform** from scratch — similar to Bolna.ai or Bland.ai. This platform lets business owners create AI voice agents that call real phone numbers, carry on intelligent conversations, and serve any business purpose the owner defines. The platform supports pluggable telephony, LLM, STT, and TTS providers so clients can mix and match. There is a superadmin panel for the platform owner (you) to monitor all tenants, and a client-facing dashboard for each tenant to manage their own agents, campaigns, and usage.

**Do not cut corners. Do not leave TODOs. Do not scaffold and stop. Build every feature fully end-to-end.**

---

## MONOREPO STRUCTURE

Scaffold the project as a monorepo at the root with this exact layout:

```
/
├── apps/
│   ├── web/                  # Next.js 14 frontend (App Router)
│   └── api/                  # FastAPI Python backend
├── packages/
│   ├── database/             # Supabase schema, migrations, seed
│   ├── shared-types/         # TypeScript types shared across apps
│   └── ui/                   # Shared shadcn/ui component library
├── infrastructure/
│   ├── docker-compose.yml    # Local dev stack
│   ├── docker-compose.prod.yml
│   └── nginx/
├── scripts/
│   ├── setup.sh              # One-command local setup
│   └── seed_dev.py
├── .env.example              # Every environment variable documented
├── .env.local.example
├── turbo.json                # Turborepo config
├── package.json              # Root workspace
└── README.md                 # Full setup guide
```

---

## TECH STACK — FOLLOW EXACTLY

### Frontend (`apps/web`)
- **Framework:** Next.js 14 with App Router, TypeScript strict mode
- **Styling:** Tailwind CSS v3 + shadcn/ui (New York style)
- **State:** Zustand for global state, React Query (TanStack Query v5) for server state
- **Forms:** React Hook Form + Zod validation
- **Real-time:** Native WebSocket with reconnect logic (no Socket.io)
- **Tables:** TanStack Table v8
- **Charts:** Recharts
- **Audio:** Web Audio API (for WebRTC in-browser calling)
- **Deployment target:** Vercel

### Backend (`apps/api`)
- **Framework:** FastAPI (Python 3.11+) with async/await throughout
- **Task queue:** Celery + Redis (for campaign dialing, async jobs)
- **WebSockets:** FastAPI native WebSocket endpoints
- **Database ORM:** SQLAlchemy 2.0 async + Alembic migrations
- **Auth middleware:** JWT verification (Supabase JWTs)
- **HTTP client:** httpx (async)
- **Audio processing:** audioop, pydub
- **Deployment target:** Railway (Dockerfile provided)

### Database
- **Primary:** Supabase (PostgreSQL 15) with Row Level Security
- **Vector store:** pgvector extension (for RAG knowledge base)
- **Cache/Queue broker:** Upstash Redis (or self-hosted Redis in Docker)
- **File storage:** Cloudflare R2 (S3-compatible) for recordings and audio

### Auth
- Supabase Auth (email + password, invite-based for team members)
- Three roles enforced at DB level via RLS: `superadmin`, `owner`, `member`
- JWT contains `role` and `tenant_id` claims
- Middleware on both frontend (Next.js middleware.ts) and backend (FastAPI dependency)

---

## DATABASE SCHEMA — BUILD ALL OF THIS

Create a full Supabase migration file at `packages/database/migrations/001_initial.sql`. Every table must have `created_at`, `updated_at` (auto-managed by trigger), and appropriate indexes.

### Tables

```sql
-- Tenants (one per paying customer / organisation)
tenants (
  id uuid PK,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,          -- used in URLs
  plan text DEFAULT 'free',           -- free | starter | pro | enterprise
  is_active boolean DEFAULT true,
  max_agents int DEFAULT 3,
  max_concurrent_calls int DEFAULT 2,
  monthly_call_minutes_limit int DEFAULT 100,
  metadata jsonb DEFAULT '{}',
  created_at, updated_at
)

-- Users (linked to Supabase auth.users)
users (
  id uuid PK REFERENCES auth.users,
  tenant_id uuid REFERENCES tenants,
  role text NOT NULL,                 -- superadmin | owner | member
  full_name text,
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at, updated_at
)

-- Provider credentials (encrypted at rest, per tenant)
provider_credentials (
  id uuid PK,
  tenant_id uuid REFERENCES tenants,
  provider_type text NOT NULL,        -- telephony | llm | stt | tts
  provider_name text NOT NULL,        -- twilio | openai | deepgram | elevenlabs | ...
  credentials jsonb NOT NULL,         -- { api_key, account_sid, auth_token, ... }
  is_default boolean DEFAULT false,
  label text,
  created_at, updated_at
)

-- Agents
agents (
  id uuid PK,
  tenant_id uuid REFERENCES tenants,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,

  -- Provider selection (FK to provider_credentials)
  telephony_provider_id uuid REFERENCES provider_credentials,
  llm_provider_id uuid REFERENCES provider_credentials,
  stt_provider_id uuid REFERENCES provider_credentials,
  tts_provider_id uuid REFERENCES provider_credentials,

  -- LLM config
  system_prompt text NOT NULL,
  llm_model text NOT NULL,            -- gpt-4o | claude-3-5-sonnet | llama-3-... | ...
  llm_temperature float DEFAULT 0.7,
  llm_max_tokens int DEFAULT 300,
  llm_extra_params jsonb DEFAULT '{}',

  -- Voice config
  voice_id text,                      -- provider-specific voice ID
  voice_speed float DEFAULT 1.0,
  voice_stability float DEFAULT 0.75,

  -- Call behaviour
  first_message text,                 -- what agent says first
  end_call_phrases text[],            -- phrases that trigger hangup
  max_call_duration_seconds int DEFAULT 300,
  silence_timeout_seconds int DEFAULT 10,
  interrupt_on_user_speech boolean DEFAULT true,
  language text DEFAULT 'en-US',

  -- Knowledge base
  knowledge_base_enabled boolean DEFAULT false,
  knowledge_base_id uuid REFERENCES knowledge_bases,

  -- Webhooks
  webhook_url text,
  webhook_events text[],

  metadata jsonb DEFAULT '{}',
  created_at, updated_at
)

-- Knowledge bases (for RAG)
knowledge_bases (
  id uuid PK,
  tenant_id uuid REFERENCES tenants,
  name text NOT NULL,
  description text,
  created_at, updated_at
)

-- Knowledge base documents
kb_documents (
  id uuid PK,
  knowledge_base_id uuid REFERENCES knowledge_bases,
  tenant_id uuid REFERENCES tenants,
  file_name text,
  file_url text,
  content_type text,
  status text DEFAULT 'processing',   -- processing | ready | failed
  chunk_count int DEFAULT 0,
  created_at, updated_at
)

-- Knowledge base chunks (vectors)
kb_chunks (
  id uuid PK,
  document_id uuid REFERENCES kb_documents,
  knowledge_base_id uuid REFERENCES knowledge_bases,
  tenant_id uuid REFERENCES tenants,
  content text NOT NULL,
  embedding vector(1536),
  chunk_index int,
  metadata jsonb DEFAULT '{}',
  created_at
)

-- Contacts
contacts (
  id uuid PK,
  tenant_id uuid REFERENCES tenants,
  phone_number text NOT NULL,
  first_name text,
  last_name text,
  email text,
  metadata jsonb DEFAULT '{}',        -- custom fields
  do_not_call boolean DEFAULT false,
  created_at, updated_at
)

-- Campaigns
campaigns (
  id uuid PK,
  tenant_id uuid REFERENCES tenants,
  agent_id uuid REFERENCES agents,
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft',        -- draft | scheduled | running | paused | completed | failed
  scheduled_at timestamptz,
  timezone text DEFAULT 'UTC',
  calling_hours_start time DEFAULT '09:00',
  calling_hours_end time DEFAULT '18:00',
  calling_days int[] DEFAULT '{1,2,3,4,5}',  -- 0=Sun..6=Sat
  max_retries int DEFAULT 2,
  retry_delay_minutes int DEFAULT 60,
  max_concurrent_calls int DEFAULT 1,
  total_contacts int DEFAULT 0,
  completed_calls int DEFAULT 0,
  failed_calls int DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at, updated_at
)

-- Campaign contacts (junction)
campaign_contacts (
  id uuid PK,
  campaign_id uuid REFERENCES campaigns,
  contact_id uuid REFERENCES contacts,
  tenant_id uuid REFERENCES tenants,
  status text DEFAULT 'pending',      -- pending | calling | completed | failed | do_not_call
  attempts int DEFAULT 0,
  last_attempted_at timestamptz,
  call_id uuid,                       -- references calls.id
  metadata jsonb DEFAULT '{}',
  created_at, updated_at
)

-- Calls (every call, inbound or outbound)
calls (
  id uuid PK,
  tenant_id uuid REFERENCES tenants,
  agent_id uuid REFERENCES agents,
  campaign_id uuid REFERENCES campaigns,
  contact_id uuid REFERENCES contacts,
  direction text NOT NULL,            -- outbound | inbound
  status text DEFAULT 'initiated',    -- initiated | ringing | in_progress | completed | failed | busy | no_answer
  telephony_provider text,
  telephony_call_id text,             -- provider's call SID/ID
  from_number text,
  to_number text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  recording_url text,
  recording_duration_seconds int,
  llm_provider text,
  stt_provider text,
  tts_provider text,
  total_tokens_used int DEFAULT 0,
  cost_usd float DEFAULT 0,
  end_reason text,                    -- completed | user_hangup | agent_hangup | timeout | error
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at, updated_at
)

-- Call transcripts (per turn)
call_turns (
  id uuid PK,
  call_id uuid REFERENCES calls,
  tenant_id uuid REFERENCES tenants,
  role text NOT NULL,                 -- user | assistant | system
  content text NOT NULL,
  timestamp_ms int,                   -- ms from call start
  duration_ms int,
  confidence float,                   -- STT confidence
  metadata jsonb DEFAULT '{}',
  created_at
)

-- Call events (for live monitoring)
call_events (
  id uuid PK,
  call_id uuid REFERENCES calls,
  tenant_id uuid REFERENCES tenants,
  event_type text NOT NULL,           -- call_started | turn_started | turn_ended | tts_started | tts_ended | call_ended | ...
  payload jsonb DEFAULT '{}',
  created_at
)

-- Usage / billing tracking
usage_records (
  id uuid PK,
  tenant_id uuid REFERENCES tenants,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_calls int DEFAULT 0,
  total_call_minutes float DEFAULT 0,
  total_tokens_used int DEFAULT 0,
  total_cost_usd float DEFAULT 0,
  breakdown jsonb DEFAULT '{}',       -- per-provider breakdown
  created_at, updated_at
)

-- Webhook delivery log
webhook_deliveries (
  id uuid PK,
  tenant_id uuid REFERENCES tenants,
  call_id uuid REFERENCES calls,
  url text NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  response_status int,
  response_body text,
  delivered_at timestamptz,
  failed boolean DEFAULT false,
  created_at
)
```

Also create:
- `packages/database/migrations/002_rls.sql` — Row Level Security policies for every table. Superadmin bypasses RLS. Owners and members can only see rows where `tenant_id = auth.jwt()->>'tenant_id'`.
- `packages/database/migrations/003_functions.sql` — Postgres functions: `update_updated_at()` trigger, `match_kb_chunks(query_embedding, match_count, tenant_id, kb_id)` for vector similarity search.
- `packages/database/seed.sql` — Seed data: one superadmin user, two demo tenants, one agent each, sample contacts.

---

## ENVIRONMENT VARIABLES

Create `.env.example` with every variable grouped and documented:

```env
# ── Supabase ──────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgresql://...

# ── Redis ─────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Storage (Cloudflare R2 / S3-compatible) ───────────
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# ── Telephony providers ───────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WEBHOOK_BASE_URL=

PLIVO_AUTH_ID=
PLIVO_AUTH_TOKEN=
PLIVO_WEBHOOK_BASE_URL=

VOBIZ_API_KEY=
VOBIZ_WEBHOOK_BASE_URL=

# ── LLM providers ─────────────────────────────────────
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GROQ_API_KEY=
GOOGLE_API_KEY=
TOGETHER_API_KEY=
MISTRAL_API_KEY=
COHERE_API_KEY=

# ── STT providers ─────────────────────────────────────
DEEPGRAM_API_KEY=
ASSEMBLYAI_API_KEY=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
GOOGLE_CLOUD_CREDENTIALS_JSON=

# ── TTS providers ─────────────────────────────────────
ELEVENLABS_API_KEY=
CARTESIA_API_KEY=
SARVAM_API_KEY=
AZURE_TTS_KEY=
AZURE_TTS_REGION=

# ── App config ────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:8000
API_SECRET_KEY=                        # random 64-char hex, used for internal signing
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# ── Celery ────────────────────────────────────────────
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

---

## BACKEND — FULL FASTAPI APPLICATION (`apps/api`)

### File structure

```
apps/api/
├── main.py
├── requirements.txt
├── Dockerfile
├── celery_app.py
├── app/
│   ├── core/
│   │   ├── config.py          # Settings via pydantic-settings
│   │   ├── database.py        # Async SQLAlchemy engine + session
│   │   ├── auth.py            # JWT verification, get_current_user dep
│   │   ├── redis.py           # Redis client
│   │   ├── storage.py         # R2/S3 client (boto3)
│   │   └── security.py        # Credential encryption/decryption (Fernet)
│   ├── models/                # SQLAlchemy ORM models (mirror DB schema)
│   ├── schemas/               # Pydantic request/response schemas
│   ├── routers/
│   │   ├── auth.py
│   │   ├── tenants.py
│   │   ├── agents.py
│   │   ├── campaigns.py
│   │   ├── contacts.py
│   │   ├── calls.py
│   │   ├── knowledge_base.py
│   │   ├── providers.py
│   │   ├── webhooks/
│   │   │   ├── twilio.py
│   │   │   ├── plivo.py
│   │   │   └── vobiz.py
│   │   ├── ws.py              # WebSocket endpoints
│   │   └── admin.py           # Superadmin-only endpoints
│   ├── services/
│   │   ├── call_orchestrator.py
│   │   ├── telephony/
│   │   │   ├── base.py
│   │   │   ├── twilio_provider.py
│   │   │   ├── plivo_provider.py
│   │   │   ├── vobiz_provider.py
│   │   │   └── webrtc_provider.py
│   │   ├── llm/
│   │   │   ├── base.py
│   │   │   ├── openai_provider.py
│   │   │   ├── anthropic_provider.py
│   │   │   ├── groq_provider.py
│   │   │   ├── gemini_provider.py
│   │   │   ├── together_provider.py
│   │   │   └── registry.py    # Maps provider name → class
│   │   ├── stt/
│   │   │   ├── base.py
│   │   │   ├── deepgram_provider.py
│   │   │   ├── openai_whisper_provider.py
│   │   │   ├── assemblyai_provider.py
│   │   │   ├── google_stt_provider.py
│   │   │   ├── azure_stt_provider.py
│   │   │   └── registry.py
│   │   ├── tts/
│   │   │   ├── base.py
│   │   │   ├── elevenlabs_provider.py
│   │   │   ├── openai_tts_provider.py
│   │   │   ├── google_tts_provider.py
│   │   │   ├── azure_tts_provider.py
│   │   │   ├── deepgram_aura_provider.py
│   │   │   ├── cartesia_provider.py
│   │   │   ├── sarvam_provider.py
│   │   │   └── registry.py
│   │   ├── rag/
│   │   │   ├── embeddings.py
│   │   │   ├── chunker.py
│   │   │   └── retriever.py
│   │   ├── campaign_dialer.py
│   │   ├── webhook_dispatcher.py
│   │   └── usage_tracker.py
│   └── tasks/
│       ├── campaign_tasks.py
│       ├── kb_indexing_tasks.py
│       └── webhook_tasks.py
```

### Provider abstraction — implement ALL of these

Every provider type has a base abstract class. Implement all listed providers fully (not stubs).

**Base LLM interface:**
```python
class BaseLLMProvider:
    async def complete(self, messages: list[dict], stream: bool, **kwargs) -> AsyncGenerator[str, None]: ...
    async def get_available_models(self) -> list[dict]: ...
    def estimate_tokens(self, text: str) -> int: ...
```

Implement for: `openai` (GPT-4o, GPT-4o-mini, GPT-3.5-turbo), `anthropic` (claude-3-5-sonnet, claude-3-haiku), `groq` (llama-3.1-70b, llama-3.1-8b, mixtral-8x7b, gemma2-9b — all free tier), `google` (gemini-1.5-flash, gemini-1.5-pro), `together` (many open models — free credits), `mistral` (mistral-7b-instruct free tier).

**Base STT interface:**
```python
class BaseSTTProvider:
    async def transcribe_stream(self, audio_stream: AsyncGenerator, language: str, **kwargs) -> AsyncGenerator[TranscriptChunk, None]: ...
    async def transcribe_file(self, audio_bytes: bytes, language: str, **kwargs) -> str: ...
```

Implement for: `deepgram` (nova-2, streaming), `openai_whisper` (whisper-1, file-based), `assemblyai` (streaming), `google` (streaming + file), `azure` (streaming + file).

**Base TTS interface:**
```python
class BaseTTSProvider:
    async def synthesize_stream(self, text: str, voice_id: str, **kwargs) -> AsyncGenerator[bytes, None]: ...
    async def get_voices(self) -> list[VoiceInfo]: ...
```

Implement for: `elevenlabs` (streaming), `openai` (tts-1, tts-1-hd), `google` (WaveNet, Neural2), `azure` (streaming neural voices), `deepgram_aura`, `cartesia` (streaming), `sarvam` (Indian languages — Hindi, Tamil, Telugu, etc.).

**Base Telephony interface:**
```python
class BaseTelephonyProvider:
    async def initiate_call(self, to: str, from_: str, webhook_url: str, **kwargs) -> CallInfo: ...
    async def hangup_call(self, call_id: str) -> bool: ...
    async def get_call_status(self, call_id: str) -> CallStatus: ...
    async def stream_audio_to_call(self, call_id: str, audio_stream: AsyncGenerator) -> None: ...
    def validate_webhook(self, headers: dict, body: bytes) -> bool: ...
```

Implement for: `twilio` (TwiML + Media Streams WebSocket), `plivo` (PHLO + streaming), `vobiz` (REST API), `webrtc` (browser-based via WebRTC + custom signaling).

### Call Orchestrator (`app/services/call_orchestrator.py`)

This is the heart of the system. Build it fully:

```
1. Receive audio chunks from telephony WebSocket
2. Buffer chunks until VAD (voice activity detection) detects end of utterance
   - Use webrtcvad library for VAD
   - Configurable silence threshold (default 800ms)
3. Send buffered audio to STT provider (streaming where available)
4. Receive transcript text
5. Save turn to call_turns table
6. Append to conversation history
7. If RAG enabled: embed query, fetch top-k relevant chunks, inject into context
8. Send full conversation + context to LLM (streaming)
9. First LLM chunk triggers TTS immediately (don't wait for full response)
   - Split on sentence boundaries for natural TTS chunks
   - Stream TTS audio back to telephony WebSocket in parallel
10. Continue until LLM done
11. Save assistant turn to call_turns
12. Detect end-call phrases in transcript → trigger hangup
13. Detect silence timeout → trigger hangup
14. On call end: save recording URL, compute cost, update call record, fire webhooks
15. Publish all events to Redis pub/sub → WebSocket server picks up for live monitor
```

Implement interrupt handling: if user starts speaking while agent is talking, stop TTS immediately and restart the STT→LLM→TTS cycle.

### Webhook handlers

**Twilio:**
- `POST /webhooks/twilio/voice` — TwiML response to initiate Media Stream
- `POST /webhooks/twilio/status` — Call status callbacks
- `WS /webhooks/twilio/stream/{call_id}` — Twilio Media Stream WebSocket (mulaw audio, base64)

**Plivo:**
- `POST /webhooks/plivo/answer` — PHLO response
- `POST /webhooks/plivo/hangup` — Status callback
- `WS /webhooks/plivo/stream/{call_id}` — Audio stream

**Vobiz:**
- `POST /webhooks/vobiz/event` — All events

All webhook endpoints must:
1. Validate signature/auth token
2. Be idempotent
3. Return correct HTTP responses quickly (under 100ms) — do heavy lifting in Celery tasks

### Campaign Dialer (`app/services/campaign_dialer.py` + `app/tasks/campaign_tasks.py`)

```
- Celery beat schedule: every 60s scan for campaigns that should be active
- Respect calling_hours_start/end and calling_days (in campaign's timezone)
- Pull pending campaign_contacts (respecting max_concurrent_calls)
- For each: initiate call via telephony provider, update status to 'calling'
- On call completion: update status, record attempt, schedule retry if needed
- Campaign status transitions: draft → scheduled → running → paused/completed/failed
- Emit progress events to Redis → live campaign stats on frontend
- Respect tenant's max_concurrent_calls limit
```

### Knowledge Base / RAG (`app/services/rag/`)

- `chunker.py`: Split documents into 512-token chunks with 50-token overlap. Support PDF (pypdf), DOCX (python-docx), TXT, CSV, URL (httpx fetch + markdownify).
- `embeddings.py`: Use OpenAI `text-embedding-3-small` (or `text-embedding-ada-002`) to embed chunks. Store vectors in pgvector.
- `retriever.py`: Given a user utterance, embed it and run `match_kb_chunks()` Postgres function. Return top 5 chunks. Inject into LLM system prompt as `## Relevant context:\n{chunks}`.
- `app/tasks/kb_indexing_tasks.py`: Celery task to process uploaded files asynchronously. Update document status as it progresses.

### WebSocket server (`app/routers/ws.py`)

```python
# Endpoint: WS /ws/calls/{call_id}
# Auth: JWT in query param or first message
# On connect: verify tenant owns call_id, subscribe to Redis pub/sub channel call:{call_id}
# Forward all Redis messages to connected WebSocket clients
# Handle client disconnect gracefully

# Endpoint: WS /ws/campaigns/{campaign_id}
# Stream live campaign progress (calls initiated, completed, failed counts)

# Endpoint: WS /ws/admin/calls
# Superadmin only: stream events from ALL active calls across all tenants
```

### Admin endpoints (`app/routers/admin.py`)

Superadmin-only (enforce in middleware):
- `GET /admin/tenants` — paginated list of all tenants with usage stats
- `GET /admin/tenants/{id}` — tenant detail + all agents + call history
- `POST /admin/tenants/{id}/suspend` — suspend tenant
- `GET /admin/calls` — all calls across all tenants with filters
- `GET /admin/usage` — platform-wide usage dashboard data
- `GET /admin/health` — system health: DB, Redis, Celery worker status

### API structure rules
- All endpoints return consistent `{ data: ..., error: null }` or `{ data: null, error: { code, message } }`
- All list endpoints support `page`, `page_size` (max 100), `sort_by`, `sort_dir`, and resource-specific filters
- All mutating endpoints emit audit log entries
- Rate limiting: 100 req/min per tenant on most endpoints, stricter on call initiation
- Credential values are encrypted at rest with Fernet before storing in DB; never returned in responses (return `{ id, label, provider_name, created_at }` only)

---

## FRONTEND — FULL NEXT.JS APPLICATION (`apps/web`)

### File structure

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   └── invite/[token]/
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Sidebar + topbar shell
│   │   ├── page.tsx              # Overview / home
│   │   ├── agents/
│   │   │   ├── page.tsx          # Agents list
│   │   │   ├── new/page.tsx      # Create agent wizard
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Agent detail / edit
│   │   │       └── test/page.tsx # Test agent via WebRTC
│   │   ├── campaigns/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Campaign detail
│   │   │       └── contacts/page.tsx
│   │   ├── calls/
│   │   │   ├── page.tsx          # Call history
│   │   │   └── [id]/page.tsx     # Call detail + transcript
│   │   ├── contacts/
│   │   │   ├── page.tsx
│   │   │   └── import/page.tsx   # CSV import
│   │   ├── knowledge-bases/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── settings/
│   │   │   ├── page.tsx          # General settings
│   │   │   ├── providers/page.tsx # Provider credentials
│   │   │   ├── team/page.tsx
│   │   │   └── usage/page.tsx
│   │   └── live/
│   │       └── page.tsx          # Live call monitor
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Admin overview
│   │   ├── tenants/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── calls/page.tsx
│   │   └── system/page.tsx
│   ├── api/                      # Next.js route handlers (thin proxies to FastAPI)
│   └── layout.tsx
├── components/
│   ├── agents/
│   │   ├── AgentCard.tsx
│   │   ├── AgentForm.tsx         # Full multi-step agent creation form
│   │   ├── ProviderSelector.tsx  # Pick telephony/LLM/STT/TTS per agent
│   │   ├── VoiceSelector.tsx     # Browse & preview voices
│   │   └── PromptEditor.tsx      # System prompt editor with variables
│   ├── calls/
│   │   ├── CallRow.tsx
│   │   ├── CallDetail.tsx
│   │   ├── TranscriptViewer.tsx  # Scrolling transcript with timestamps
│   │   └── AudioPlayer.tsx       # Waveform player for recordings
│   ├── campaigns/
│   │   ├── CampaignForm.tsx
│   │   ├── CampaignProgress.tsx  # Live progress bar + stats
│   │   └── ContactsUploader.tsx  # CSV drag-drop uploader
│   ├── live-monitor/
│   │   ├── LiveCallsGrid.tsx     # Grid of active call cards
│   │   ├── LiveCallCard.tsx      # Real-time transcript + waveform
│   │   └── CallEventStream.tsx
│   ├── providers/
│   │   └── ProviderCredentialForm.tsx  # Add/edit provider creds
│   ├── knowledge-base/
│   │   ├── KBDocumentList.tsx
│   │   └── DocumentUploader.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── MobileNav.tsx
│   ├── ui/                       # Re-exported shadcn components
│   └── shared/
│       ├── DataTable.tsx         # TanStack Table wrapper
│       ├── StatsCard.tsx
│       ├── EmptyState.tsx
│       ├── ConfirmDialog.tsx
│       └── CopyButton.tsx
├── hooks/
│   ├── useWebSocket.ts           # Reconnecting WebSocket hook
│   ├── useLiveCall.ts            # Subscribe to call events
│   ├── useCampaignProgress.ts
│   ├── useCurrentUser.ts
│   └── useProviders.ts
├── lib/
│   ├── api.ts                    # Typed API client (all endpoints)
│   ├── supabase.ts               # Supabase client
│   ├── utils.ts
│   ├── validators.ts             # Zod schemas matching backend
│   └── constants.ts             # Provider names, model lists, etc.
├── store/
│   ├── auth.ts                   # Zustand auth store
│   └── ui.ts                     # Sidebar state, etc.
└── middleware.ts                 # Route protection
```

### Design System

Build a **dark-primary, enterprise-grade SaaS UI**. The aesthetic is refined industrial: dark slate backgrounds, electric blue as the primary action color, with amber for warnings and green for success states. Think "mission control" meets "developer tool." Clean, dense, professional.

- **Background:** `#0A0E1A` (near-black navy)
- **Surface:** `#111827` (cards, panels)
- **Surface elevated:** `#1C2333` (modals, popovers)
- **Border:** `#2D3748` (subtle dividers)
- **Primary:** `#3B82F6` (electric blue — CTAs, links, active states)
- **Primary hover:** `#2563EB`
- **Success:** `#10B981`
- **Warning:** `#F59E0B`
- **Danger:** `#EF4444`
- **Text primary:** `#F9FAFB`
- **Text secondary:** `#9CA3AF`
- **Text muted:** `#6B7280`
- **Font:** Geist Sans (from `next/font/google`) + Geist Mono for code/transcripts

Configure `tailwind.config.ts` to use these as CSS variables and extend the default theme. Configure shadcn to use dark mode by default.

### Pages — build all of these fully

#### Auth pages
- **Login** (`/login`): Email + password. Remember me. Forgot password link. Clean centered card. Show error states inline.
- **Signup** (`/signup`): For creating a new tenant account. Full name, email, password, organisation name. On submit: create Supabase user + tenant + owner record.
- **Invite** (`/invite/[token]`): Accept team invitation. Pre-filled email. Set password. Join tenant.

#### Dashboard home (`/`)
Stats cards: Total agents, Active campaigns, Calls today, Minutes used this month (with limit indicator). Recent calls table (last 10). Active campaigns widget. Quick links to create agent / start campaign.

#### Agents list (`/agents`)
Grid of agent cards. Each card shows: name, status badge, telephony/LLM/TTS provider badges, total calls, last active. Filter by status. Sort by name/calls/created. Empty state with CTA.

#### Agent creation wizard (`/agents/new`)
Multi-step form (stepper with progress):

**Step 1 — Basic info:** Name, description, language selection.

**Step 2 — Telephony:** Select provider (dropdown of configured providers + "configure new"). Select phone number (fetched from provider API). Set first message (what the agent says when call connects).

**Step 3 — Intelligence (LLM):** Select provider + model. System prompt editor (large textarea with syntax highlighting and variable hints: `{{contact_name}}`, `{{contact_phone}}`, `{{campaign_name}}`). Temperature slider. Max tokens. End-call phrase configuration (add multiple).

**Step 4 — Voice (STT + TTS):** Select STT provider. Select TTS provider. Voice browser (grid of voice cards with play button — fetch voices from API and preview in browser). Voice speed / stability sliders. Language override.

**Step 5 — Knowledge base (optional):** Toggle knowledge base on/off. Select from existing KBs or create new. Preview relevant chunk retrieval.

**Step 6 — Advanced:** Max call duration. Silence timeout. Interrupt on speech toggle. Webhook URL + event checkboxes. Metadata JSON editor.

**Step 7 — Review:** Summary of all settings. "Test call" button (WebRTC). "Save" button.

#### Agent detail page (`/agents/[id]`)
- Edit all settings (same form, pre-populated)
- Call history for this agent
- Performance metrics: avg call duration, answer rate, completion rate
- Quick stats
- Danger zone: deactivate / delete agent

#### Agent test page (`/agents/[id]/test`)
- WebRTC call interface
- Shows live transcript as you speak
- Shows which LLM/STT/TTS is being used
- Full call controls (mute, hangup)
- Call ends → full transcript + duration displayed

#### Campaigns list (`/campaigns`)
Table with columns: Name, Agent, Status badge, Progress (x/y contacts with progress bar), Scheduled time, Start/Pause/Stop actions. Filter by status. Create new button.

#### Campaign creation (`/campaigns/new`)
Step 1 — Info: Name, description, agent selection (dropdown with agent preview).
Step 2 — Contacts: Upload CSV (drag-drop with column mapping UI) OR select from existing contacts with filter. Show preview of contacts (first 10, total count).
Step 3 — Schedule: Immediate or scheduled date/time picker. Timezone selector. Calling hours (time range picker). Calling days (day-of-week checkboxes). Max concurrent calls slider.
Step 4 — Retry config: Max attempts, retry delay.
Step 5 — Review + launch.

#### Campaign detail (`/campaigns/[id]`)
- Real-time progress bar (live via WebSocket)
- Stats: Contacts total / called / completed / failed / pending
- Live call feed: cards for currently active calls in this campaign (real-time transcript snippets)
- Full contacts table with per-contact status
- Pause / Resume / Cancel controls
- Export results as CSV

#### Calls list (`/calls`)
Full call history table. Columns: From/To, Agent, Campaign, Status, Duration, Date, Providers used. Filters: date range, status, agent, campaign. Click row → call detail.

#### Call detail (`/calls/[id]`)
- Call metadata bar (from, to, duration, providers, cost estimate)
- Audio player (waveform) if recording exists
- Full transcript (alternating user/assistant bubbles, with timestamps, STT confidence scores)
- Call events timeline (technical view: when STT started, LLM latency, TTS latency, etc.)
- JSON metadata viewer
- "Re-run with different agent" button (start new campaign with this contact)

#### Contacts (`/contacts`)
Table of all contacts. Import CSV. Add single contact form. Bulk operations: add to campaign, export, delete, mark DNC. Show call history count per contact.

#### CSV Import (`/contacts/import`)
1. Drag-drop CSV upload
2. Column mapping UI (match CSV columns to contact fields: phone_number required, first_name, last_name, email, metadata fields)
3. Validation preview (show errors: missing phone, invalid format, duplicates)
4. Confirm import → background Celery task → progress indicator

#### Knowledge Bases (`/knowledge-bases`)
List of KBs. Each KB shows: name, document count, status. Click → KB detail.

#### KB Detail (`/knowledge-bases/[id]`)
- Upload documents: drag-drop area accepting PDF, DOCX, TXT, CSV, or URL input
- Documents list with processing status (processing spinner → ready / failed)
- Per-document chunk count
- Test retrieval: type a query, see which chunks would be retrieved
- Delete document

#### Live Monitor (`/live`)
Mission-control style page. Real-time view of all currently active calls.
- Stats bar at top: Active calls count, calls today, minutes in use
- Grid of active call cards (one per active call):
  - Contact phone number (partially masked)
  - Agent name
  - Duration timer (counting up)
  - Live transcript (last 2 turns, streaming in real-time)
  - Provider badges
  - Status indicator (pulsing dot)
  - Click → expand to full transcript + hangup button
- Empty state: "No active calls"
- Auto-updates via WebSocket (new cards appear/disappear as calls start/end)

#### Settings — Providers (`/settings/providers`)
Critical page. Four tabs: Telephony | LLM | STT | TTS.

Each tab shows configured credentials as cards (show label, provider name, last 4 of key masked, "Default" badge if applicable). Add new credential button opens a drawer with a form specific to that provider:

**Telephony — Twilio:** Account SID, Auth Token, phone numbers (fetched from Twilio API on save). Validate by making a test API call.
**Telephony — Plivo:** Auth ID, Auth Token. Same validation.
**Telephony — Vobiz:** API Key. Validation call.
**Telephony — WebRTC:** No credentials needed, always available.

**LLM — OpenAI:** API Key. Fetch available models on save. Show model picker per agent.
**LLM — Anthropic:** API Key. Available models list.
**LLM — Groq:** API Key. Available models (free tier models highlighted).
**LLM — Google:** API Key or Service Account JSON.
**LLM — Together AI:** API Key. Show free models.
**LLM — Mistral:** API Key.

**STT — Deepgram:** API Key. Select model (nova-2, etc.).
**STT — OpenAI Whisper:** Uses OpenAI API key (reuse if configured).
**STT — AssemblyAI:** API Key.
**STT — Google STT:** Service Account JSON upload.
**STT — Azure STT:** Key + region.

**TTS — ElevenLabs:** API Key. Show voice quota usage.
**TTS — OpenAI TTS:** Uses OpenAI API key.
**TTS — Google TTS:** Service Account JSON.
**TTS — Azure TTS:** Key + region.
**TTS — Deepgram Aura:** Uses Deepgram API key.
**TTS — Cartesia:** API Key.
**TTS — Sarvam:** API Key. Show Indian language support note.
**TTS — Edge TTS (Free):** No credentials. Microsoft Edge TTS via `edge-tts` Python package. Free but rate-limited. Always available.
**TTS — Google TTS Basic (Free):** gTTS. Free, lower quality. Always available.

Show validation state per credential. "Set as default" button. Delete (with confirmation). Edit.

#### Settings — Usage (`/settings/usage`)
- Current billing period
- Progress bars: calls used / limit, minutes used / limit
- Per-provider breakdown table: provider, calls, minutes, estimated cost
- Upgrade CTA if approaching limits
- Historical usage chart (last 6 months)

#### Settings — Team (`/settings/team`)
- Members list (name, email, role, joined date)
- Invite new member (email input → sends invite email)
- Change role (owner only)
- Remove member

#### Admin Panel (`/admin`) — SUPERADMIN ONLY
Redirect to `/login` if not superadmin.

**Admin Overview:** Platform stats: total tenants, total calls today, total minutes today, total active calls now (live), revenue overview.

**Admin Tenants (`/admin/tenants`):** Full table of all tenants. Columns: Name, Plan, Status, Agents, Total Calls, Minutes This Month, Created. Click → tenant detail.

**Admin Tenant Detail (`/admin/tenants/[id]`):** All tenant info. Usage breakdown. Agent list (read-only). Recent calls. Suspend / unsuspend. Edit plan. View credentials (metadata only, never values). Impersonate button (for debugging — sets a special header).

**Admin Calls (`/admin/calls`):** All calls across all tenants. Filterable by tenant, date, status, provider.

**Admin System (`/admin/system`):** Health dashboard: DB connection status, Redis status, Celery worker count and queue depth, recent errors from logs.

### Components — key implementation details

**`ProviderSelector.tsx`:** A select component that groups providers by category. Shows provider logo icon (use simple SVG or first-letter avatar), name, and a "configured" / "not configured" badge. If not configured, clicking opens the settings/providers drawer inline.

**`TranscriptViewer.tsx`:** Virtualized scroll (use `react-window` for long transcripts). User turns on left (slate background), assistant turns on right (blue tint). Each turn shows: speaker icon, text, timestamp, confidence percentage. Live mode: new turns animate in from bottom.

**`LiveCallCard.tsx`:** Real-time card. Pulsing green dot. Duration counter ticking every second. Last assistant utterance streams in word by word (SSE/WS character streaming). Waveform visualizer using Web Audio API (shows audio level as animated bars).

**`CampaignProgress.tsx`:** Animated progress ring + stats. Live updated. Color: green when running, amber when paused, red when failed.

**`DataTable.tsx`:** Generic wrapper with: column sorting, pagination, row selection (checkboxes), bulk actions toolbar, empty state slot, loading skeleton rows.

---

## WEBRTC IN-BROWSER CALLING

Implement WebRTC calling so users can test their agents directly from the browser.

**Backend (`app/routers/ws.py`):**
- `WS /ws/webrtc/signal/{session_id}` — WebRTC signaling endpoint
- Handle SDP offer/answer exchange, ICE candidates
- Use `aiortc` Python library for WebRTC
- Once connected: route audio through the full STT→LLM→TTS pipeline

**Frontend (`components/agents/WebRTCCallButton.tsx`):**
- Request microphone permission
- Create RTCPeerConnection
- Connect to signaling WS
- Exchange SDP + ICE
- Capture microphone → send to backend
- Receive TTS audio → play through AudioContext
- Show live transcript (subscribe to call WS)
- Mute / hangup controls

---

## DOCKER + LOCAL DEV

`infrastructure/docker-compose.yml` must include:
- `postgres` (with pgvector extension) → port 5432
- `redis` → port 6379
- `api` (FastAPI) → port 8000 with hot-reload
- `worker` (Celery) → same image as api, different command
- `flower` (Celery monitoring) → port 5555

`scripts/setup.sh`:
```bash
#!/bin/bash
# 1. Check prerequisites (node, python, docker)
# 2. Copy .env.example to .env.local
# 3. pnpm install
# 4. pip install -r apps/api/requirements.txt
# 5. docker-compose up -d postgres redis
# 6. Wait for postgres ready
# 7. Run supabase migrations OR alembic upgrade head
# 8. Run seed.sql
# 9. Print "Setup complete! Run: pnpm dev"
```

---

## ERROR HANDLING — DO NOT SKIP

Every layer must handle errors gracefully:

**Backend:**
- FastAPI exception handlers for: `ValidationError` (422), `AuthenticationError` (401), `PermissionError` (403), `NotFoundError` (404), `ProviderError` (502 with provider name in error), `RateLimitError` (429)
- Celery tasks: retry with exponential backoff (max 3 retries) on provider errors. Dead letter queue for permanent failures.
- All provider API calls wrapped in try/except with structured logging
- Call orchestrator: if any step fails mid-call (LLM timeout, TTS error), fall back gracefully (play error message TTS, end call cleanly, record error in DB)

**Frontend:**
- React Error Boundaries on each major page section
- Toast notifications (shadcn Sonner) for all API errors
- Form validation errors shown inline (never just console.log)
- Loading states on every async action
- Optimistic updates where appropriate (with rollback on error)
- Retry logic for WebSocket disconnects (exponential backoff, max 5 retries, then show "Reconnecting..." banner)

---

## SECURITY — IMPLEMENT ALL

- All API endpoints require valid Supabase JWT (except webhooks and health check)
- Webhook endpoints verify signatures (Twilio: X-Twilio-Signature, Plivo: X-Plivo-Signature)
- Provider credentials encrypted with Fernet before DB storage, decrypted only inside service layer, never serialized to API responses
- Row Level Security on ALL tables — test with a query that explicitly bypasses service role
- CORS: only allow `NEXT_PUBLIC_APP_URL` origin on API
- Rate limiting per tenant on all endpoints (slowapi)
- Phone number normalization: always store in E.164 format
- DNC (Do Not Call) list enforcement: check before every call initiation
- Input sanitization: strip control characters from prompts, max length enforcement
- File upload validation: check MIME type (not just extension), max 50MB, virus-scan placeholder

---

## TESTING

Write the following tests (use pytest for backend, vitest for frontend):

**Backend:**
- `tests/test_call_orchestrator.py`: Mock all providers, test the full STT→LLM→TTS loop. Test interrupt handling. Test end-call phrase detection. Test silence timeout.
- `tests/test_campaign_dialer.py`: Test calling hours enforcement, retry logic, concurrent call limits.
- `tests/test_providers.py`: Unit tests for each provider's response parsing (mock HTTP responses).
- `tests/test_webhooks.py`: Test Twilio/Plivo webhook signature validation.
- `tests/test_rag.py`: Test chunking, embedding retrieval.
- `tests/test_auth.py`: Test JWT validation, RLS enforcement.

**Frontend:**
- `__tests__/AgentForm.test.tsx`: Test multi-step form validation.
- `__tests__/useWebSocket.test.ts`: Test reconnect logic.

---

## README.md

Write a comprehensive README at the root covering:
1. What this is (1 paragraph)
2. Architecture diagram (ASCII)
3. Prerequisites
4. Local setup (step by step)
5. Environment variable reference
6. How to add a new telephony provider (code example)
7. How to add a new LLM provider (code example)
8. How to deploy to Vercel + Railway
9. Database migrations guide
10. Troubleshooting common issues

---

## EXECUTION ORDER

Build in this exact order so nothing breaks:

1. Scaffold monorepo (`turbo.json`, root `package.json`, workspaces)
2. Database schema + migrations + RLS + seed
3. FastAPI project structure + config + database connection + auth middleware
4. All SQLAlchemy models
5. All Pydantic schemas
6. Provider base classes + all provider implementations (LLM, STT, TTS, Telephony)
7. Core services: call_orchestrator, campaign_dialer, rag, webhook_dispatcher, usage_tracker
8. All FastAPI routers (REST)
9. WebSocket server
10. Celery tasks
11. Telephony webhook handlers
12. Docker compose + scripts
13. Next.js project structure + Tailwind + shadcn setup
14. Auth pages
15. Layout (sidebar, topbar)
16. All dashboard pages (in order: agents, campaigns, calls, contacts, knowledge-bases, settings, live)
17. Admin pages
18. All shared components
19. All hooks
20. API client (`lib/api.ts`) with full typing
21. WebRTC implementation
22. Tests
23. README

---

## FINAL CHECKLIST — VERIFY BEFORE FINISHING

- [ ] Every page renders without console errors
- [ ] Auth flow works end to end (signup → login → protected route → logout)
- [ ] Agent can be created with all providers configured
- [ ] A call can be initiated via Twilio and audio routes through the pipeline
- [ ] Campaign creates, starts, processes contacts, and completes
- [ ] Live monitor shows real-time transcript
- [ ] Knowledge base upload processes and retrieval works
- [ ] Admin panel is accessible only to superadmin
- [ ] All provider credential forms validate and save correctly
- [ ] Docker compose starts all services cleanly
- [ ] `scripts/setup.sh` runs without errors on a clean machine
- [ ] `.env.example` has every variable used in the codebase
- [ ] No hardcoded credentials anywhere
- [ ] RLS tested: user from tenant A cannot access tenant B's data

---

**Build everything. Leave nothing as a stub. If a provider SDK isn't available, use httpx to call their REST API directly. The final deliverable must be a runnable, production-ready codebase.**