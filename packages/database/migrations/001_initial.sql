-- ══════════════════════════════════════════════════════════════
-- Vgent — Initial Database Schema
-- Run against Supabase PostgreSQL 15
-- ══════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ──────────────────────────────────────────────────────────────
-- Tenants
-- ──────────────────────────────────────────────────────────────
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    max_agents INT NOT NULL DEFAULT 3,
    max_concurrent_calls INT NOT NULL DEFAULT 2,
    monthly_call_minutes_limit INT NOT NULL DEFAULT 100,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_is_active ON tenants(is_active);

-- ──────────────────────────────────────────────────────────────
-- Users (linked to Supabase auth.users)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'owner', 'member')),
    full_name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);

-- ──────────────────────────────────────────────────────────────
-- Provider Credentials (encrypted at rest, per tenant)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE provider_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('telephony', 'llm', 'stt', 'tts')),
    provider_name TEXT NOT NULL,
    credentials JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_creds_tenant ON provider_credentials(tenant_id);
CREATE INDEX idx_provider_creds_type ON provider_credentials(tenant_id, provider_type);

-- ──────────────────────────────────────────────────────────────
-- Knowledge Bases (for RAG)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_tenant ON knowledge_bases(tenant_id);

-- ──────────────────────────────────────────────────────────────
-- Agents
-- ──────────────────────────────────────────────────────────────
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Provider selection
    telephony_provider_id UUID REFERENCES provider_credentials(id) ON DELETE SET NULL,
    llm_provider_id UUID REFERENCES provider_credentials(id) ON DELETE SET NULL,
    stt_provider_id UUID REFERENCES provider_credentials(id) ON DELETE SET NULL,
    tts_provider_id UUID REFERENCES provider_credentials(id) ON DELETE SET NULL,

    -- LLM config
    system_prompt TEXT NOT NULL,
    llm_model TEXT NOT NULL,
    llm_temperature FLOAT NOT NULL DEFAULT 0.7,
    llm_max_tokens INT NOT NULL DEFAULT 300,
    llm_extra_params JSONB NOT NULL DEFAULT '{}',

    -- Voice config
    voice_id TEXT,
    voice_speed FLOAT NOT NULL DEFAULT 1.0,
    voice_stability FLOAT NOT NULL DEFAULT 0.75,

    -- Call behaviour
    first_message TEXT,
    end_call_phrases TEXT[] DEFAULT '{}',
    max_call_duration_seconds INT NOT NULL DEFAULT 300,
    silence_timeout_seconds INT NOT NULL DEFAULT 10,
    interrupt_on_user_speech BOOLEAN NOT NULL DEFAULT TRUE,
    language TEXT NOT NULL DEFAULT 'en-US',

    -- Knowledge base
    knowledge_base_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL,

    -- Webhooks
    webhook_url TEXT,
    webhook_events TEXT[] DEFAULT '{}',

    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_tenant ON agents(tenant_id);
CREATE INDEX idx_agents_active ON agents(tenant_id, is_active);

-- ──────────────────────────────────────────────────────────────
-- Knowledge Base Documents
-- ──────────────────────────────────────────────────────────────
CREATE TABLE kb_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_name TEXT,
    file_url TEXT,
    content_type TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
    chunk_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_docs_kb ON kb_documents(knowledge_base_id);
CREATE INDEX idx_kb_docs_tenant ON kb_documents(tenant_id);

-- ──────────────────────────────────────────────────────────────
-- Knowledge Base Chunks (vectors)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE kb_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    chunk_index INT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_chunks_doc ON kb_chunks(document_id);
CREATE INDEX idx_kb_chunks_kb ON kb_chunks(knowledge_base_id);
CREATE INDEX idx_kb_chunks_tenant ON kb_chunks(tenant_id);

-- ──────────────────────────────────────────────────────────────
-- Contacts
-- ──────────────────────────────────────────────────────────────
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    do_not_call BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_phone ON contacts(tenant_id, phone_number);
CREATE INDEX idx_contacts_dnc ON contacts(tenant_id, do_not_call);

-- ──────────────────────────────────────────────────────────────
-- Campaigns (outbound only)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),
    scheduled_at TIMESTAMPTZ,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    calling_hours_start TIME NOT NULL DEFAULT '09:00',
    calling_hours_end TIME NOT NULL DEFAULT '18:00',
    calling_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
    max_retries INT NOT NULL DEFAULT 2,
    retry_delay_minutes INT NOT NULL DEFAULT 60,
    max_concurrent_calls INT NOT NULL DEFAULT 1,
    total_contacts INT NOT NULL DEFAULT 0,
    completed_calls INT NOT NULL DEFAULT 0,
    failed_calls INT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON campaigns(tenant_id, status);
CREATE INDEX idx_campaigns_agent ON campaigns(agent_id);

-- ──────────────────────────────────────────────────────────────
-- Campaign Contacts (junction)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE campaign_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'failed', 'do_not_call')),
    attempts INT NOT NULL DEFAULT 0,
    last_attempted_at TIMESTAMPTZ,
    call_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cc_campaign ON campaign_contacts(campaign_id);
CREATE INDEX idx_cc_contact ON campaign_contacts(contact_id);
CREATE INDEX idx_cc_status ON campaign_contacts(campaign_id, status);

-- ──────────────────────────────────────────────────────────────
-- Calls (outbound only)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction = 'outbound'),
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'busy', 'no_answer')),
    telephony_provider TEXT,
    telephony_call_id TEXT,
    from_number TEXT,
    to_number TEXT,
    started_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INT,
    recording_url TEXT,
    recording_duration_seconds INT,
    llm_provider TEXT,
    stt_provider TEXT,
    tts_provider TEXT,
    total_tokens_used INT NOT NULL DEFAULT 0,
    cost_usd FLOAT NOT NULL DEFAULT 0,
    end_reason TEXT CHECK (end_reason IN ('completed', 'user_hangup', 'agent_hangup', 'timeout', 'error')),
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calls_tenant ON calls(tenant_id);
CREATE INDEX idx_calls_agent ON calls(agent_id);
CREATE INDEX idx_calls_campaign ON calls(campaign_id);
CREATE INDEX idx_calls_status ON calls(tenant_id, status);
CREATE INDEX idx_calls_created ON calls(tenant_id, created_at DESC);

-- Add FK from campaign_contacts to calls
ALTER TABLE campaign_contacts
    ADD CONSTRAINT fk_cc_call FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────
-- Call Turns (transcript per turn)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE call_turns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp_ms INT,
    duration_ms INT,
    confidence FLOAT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_turns_call ON call_turns(call_id);
CREATE INDEX idx_call_turns_tenant ON call_turns(tenant_id);

-- ──────────────────────────────────────────────────────────────
-- Call Events (for live monitoring)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE call_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_events_call ON call_events(call_id);
CREATE INDEX idx_call_events_type ON call_events(call_id, event_type);

-- ──────────────────────────────────────────────────────────────
-- Usage Records (billing tracking)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_calls INT NOT NULL DEFAULT 0,
    total_call_minutes FLOAT NOT NULL DEFAULT 0,
    total_tokens_used INT NOT NULL DEFAULT 0,
    total_cost_usd FLOAT NOT NULL DEFAULT 0,
    breakdown JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_tenant ON usage_records(tenant_id);
CREATE INDEX idx_usage_period ON usage_records(tenant_id, period_start, period_end);

-- ──────────────────────────────────────────────────────────────
-- Webhook Deliveries
-- ──────────────────────────────────────────────────────────────
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB,
    response_status INT,
    response_body TEXT,
    delivered_at TIMESTAMPTZ,
    failed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_tenant ON webhook_deliveries(tenant_id);
CREATE INDEX idx_webhook_call ON webhook_deliveries(call_id);
