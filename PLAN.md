# Vgent — Voice AI Agent SaaS Platform — Build Plan

## What We're Building

A multi-tenant SaaS platform where businesses create AI voice agents that make **outbound** phone calls, carry on intelligent conversations, and serve any business purpose. Pluggable telephony, LLM, STT, and TTS providers. Superadmin panel + per-tenant dashboards.

**No inbound calls.** Outbound only.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, Zustand, TanStack Query |
| Backend | FastAPI (Python 3.11+), async, SQLAlchemy 2.0, Alembic |
| Task Queue | Celery + Redis |
| Database | Supabase (PostgreSQL 15 + pgvector + RLS) |
| Cache | Redis (local install) |
| Storage | Cloudflare R2 (later) |
| Auth | Supabase Auth (JWT, 3 roles: superadmin, owner, member) |

---

## Provider Strategy — Free Tier First

### LLM
| Provider | Free Tier | Priority |
|----------|-----------|----------|
| Groq | Generous free tier | **P0** |
| Google Gemini | 15 RPM, 1M tokens/day | **P0** |
| Mistral | Free tier | P1 |
| Together AI | $5 signup credits | P1 |
| Cohere | Free trial | P2 |
| OpenAI | Paid only | P2 |
| Anthropic | Paid only | P2 |

### STT (Speech-to-Text)
| Provider | Free Tier | Priority |
|----------|-----------|----------|
| Deepgram | $200 free credits | **P0** |
| Google Cloud STT | 60 min/month free | P1 |
| AssemblyAI | $50 free credits | P1 |
| Azure STT | 5 hrs/month free | P2 |
| OpenAI Whisper | Paid only | P2 |

### TTS (Text-to-Speech)
| Provider | Free Tier | Priority |
|----------|-----------|----------|
| Edge TTS | Completely free, no key | **P0** |
| gTTS | Completely free, no key | **P0** |
| Sarvam AI | Free tier, Indian languages | **P0** |
| Google Cloud TTS | 4M chars/month free | P1 |
| ElevenLabs | 10K chars/month free | P1 |
| Deepgram Aura | Uses Deepgram credits | P1 |
| Cartesia | Limited free | P2 |
| OpenAI TTS | Paid only | P2 |
| Azure TTS | 5M chars/month free | P2 |

### Telephony
| Provider | Free Tier | Priority |
|----------|-----------|----------|
| WebRTC | Free (browser-based) | **P0** |
| Twilio | $15 trial credit | **P0** |
| Vobiz | TBD | P1 |
| Plivo | Trial credits | P1 |

---

## Build Phases

### Phase 1: Foundation
**Goal**: Backend boots, connects to DB, CRUD works with auth.

- [x] Scaffold monorepo (turbo, workspaces, root package.json)
- [x] .env.local template with all keys documented
- [x] Database schema (all tables, migrations, RLS, seed)
- [x] FastAPI project structure + config + DB connection + auth middleware
- [x] All SQLAlchemy ORM models
- [x] All Pydantic schemas
- [x] CRUD routers (tenants, agents, contacts, campaigns, calls, providers, admin)
- [x] setup.sh for native local dev (no Docker)

**User action after Phase 1**: Fill in .env.local with Supabase URL/keys + provider API keys.

---

### Phase 2: Provider Abstractions + Free Providers
**Goal**: Can call any configured provider programmatically.

- [ ] Base abstract classes (LLM, STT, TTS, Telephony)
- [ ] Registry pattern (maps provider name → class)
- [ ] LLM: Groq, Google Gemini, Mistral, Together
- [ ] STT: Deepgram (streaming), Google STT
- [ ] TTS: Edge TTS, gTTS, Sarvam, Google Cloud TTS
- [ ] Telephony: WebRTC, Twilio, Vobiz
- [ ] Provider credential encryption (Fernet)
- [ ] Provider CRUD + validation endpoints

---

### Phase 3: Call Orchestrator (The Heart)
**Goal**: Can make a real outbound call through the AI pipeline.

- [ ] Call orchestrator: STT → LLM → TTS pipeline
- [ ] VAD (voice activity detection) with webrtcvad
- [ ] Interrupt handling (stop TTS when user speaks)
- [ ] Twilio Media Streams webhook + WebSocket
- [ ] Vobiz webhook integration
- [ ] Call events → Redis pub/sub
- [ ] Call recording, transcript storage (call_turns)
- [ ] Usage tracking per call
- [ ] Webhook dispatcher (fire webhooks on call events)
- [ ] End-call phrase detection + silence timeout

---

### Phase 4: Frontend — Shell + Auth + Core Pages
**Goal**: Functional web UI for managing agents and viewing calls.

- [ ] Next.js setup + Tailwind + shadcn + dark theme
- [ ] Auth pages (login, signup, invite)
- [ ] Dashboard layout (sidebar, topbar, mobile nav)
- [ ] Dashboard home (stats cards, recent calls)
- [ ] Agents list + create wizard (multi-step) + detail/edit
- [ ] Provider settings page (4 tabs: Telephony/LLM/STT/TTS)
- [ ] Calls list + call detail + transcript viewer
- [ ] API client (lib/api.ts) with full typing

---

### Phase 5: Campaigns + Contacts
**Goal**: Can run an automated outbound calling campaign.

- [x] Contact management + CSV import with column mapping
- [x] Campaign CRUD + scheduling
- [x] Campaign dialer (Celery tasks)
- [x] Calling hours, retries, concurrent call limits
- [x] Campaign progress via WebSocket
- [x] Campaign UI pages (list, create, detail, live progress)

---

### Phase 6: Knowledge Base / RAG
**Goal**: Agents can reference uploaded documents during calls.

- [x] Document upload (PDF, DOCX, TXT, CSV, URL)
- [x] Chunking (512 tokens, 50 overlap)
- [x] Embeddings → pgvector storage (OpenAI / Gemini / hash fallback)
- [x] Retrieval during calls (top-5 chunks injected into LLM context)
- [x] KB management UI (upload, list, test retrieval)
- [x] Celery task for async indexing

---

### Phase 7: Live Monitor + WebRTC Testing ← CURRENT (DONE)
**Goal**: Real-time call monitoring + browser-based agent testing.

- [x] WebSocket server (call events, campaign progress)
- [x] Live monitor page (mission control grid)
- [x] WebRTC signaling (LiveKit)
- [x] Browser mic → STT → LLM → TTS → speaker
- [x] Agent test page with live transcript

---

### Phase 8: Admin Panel + Polish + Tests (DONE)
**Goal**: Platform-wide admin view, remaining providers, tests.

- [x] Admin overview, tenants list/detail, calls, system health
- [x] Remaining provider implementations (paid tier ones)
- [x] Backend tests (pytest): orchestrator, dialer, providers, webhooks, auth
- [x] Frontend tests (vitest): utils, auth store, WebSocket hook, API client
- [x] Settings: usage page, team management
- [x] README.md

---

## Local Dev Setup (No Docker)

```
PostgreSQL 15  → brew install postgresql@15 → port 5432
Redis          → brew install redis          → port 6379
FastAPI        → uvicorn (hot reload)        → port 8000
Celery Worker  → celery -A worker            → background
Next.js        → pnpm dev                    → port 3000
```

---

## Deployment (Later)
- Frontend → Vercel
- Backend → Railway
- DB → Supabase (managed)
- Redis → Upstash
- Storage → Cloudflare R2
