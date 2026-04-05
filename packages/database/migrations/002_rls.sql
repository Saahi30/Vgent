-- ══════════════════════════════════════════════════════════════
-- Row Level Security Policies
-- Superadmin bypasses RLS. Owners/members see only their tenant's data.
-- ══════════════════════════════════════════════════════════════

-- Helper: extract tenant_id from JWT
CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS UUID AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid,
        NULL
    );
$$ LANGUAGE sql STABLE;

-- Helper: extract role from JWT
CREATE OR REPLACE FUNCTION auth.user_role() RETURNS TEXT AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb ->> 'role',
        ''
    );
$$ LANGUAGE sql STABLE;

-- Helper: check if superadmin
CREATE OR REPLACE FUNCTION auth.is_superadmin() RETURNS BOOLEAN AS $$
    SELECT auth.user_role() = 'superadmin';
$$ LANGUAGE sql STABLE;

-- ── Enable RLS on all tables ─────────────────────────────────

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- ── Tenants ──────────────────────────────────────────────────

CREATE POLICY tenants_superadmin ON tenants
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY tenants_own ON tenants
    FOR ALL USING (id = auth.tenant_id());

-- ── Users ────────────────────────────────────────────────────

CREATE POLICY users_superadmin ON users
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY users_own_tenant ON users
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Provider Credentials ─────────────────────────────────────

CREATE POLICY provider_creds_superadmin ON provider_credentials
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY provider_creds_own ON provider_credentials
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Agents ───────────────────────────────────────────────────

CREATE POLICY agents_superadmin ON agents
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY agents_own ON agents
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Knowledge Bases ──────────────────────────────────────────

CREATE POLICY kb_superadmin ON knowledge_bases
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY kb_own ON knowledge_bases
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── KB Documents ─────────────────────────────────────────────

CREATE POLICY kb_docs_superadmin ON kb_documents
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY kb_docs_own ON kb_documents
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── KB Chunks ────────────────────────────────────────────────

CREATE POLICY kb_chunks_superadmin ON kb_chunks
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY kb_chunks_own ON kb_chunks
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Contacts ─────────────────────────────────────────────────

CREATE POLICY contacts_superadmin ON contacts
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY contacts_own ON contacts
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Campaigns ────────────────────────────────────────────────

CREATE POLICY campaigns_superadmin ON campaigns
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY campaigns_own ON campaigns
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Campaign Contacts ────────────────────────────────────────

CREATE POLICY cc_superadmin ON campaign_contacts
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY cc_own ON campaign_contacts
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Calls ────────────────────────────────────────────────────

CREATE POLICY calls_superadmin ON calls
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY calls_own ON calls
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Call Turns ───────────────────────────────────────────────

CREATE POLICY call_turns_superadmin ON call_turns
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY call_turns_own ON call_turns
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Call Events ──────────────────────────────────────────────

CREATE POLICY call_events_superadmin ON call_events
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY call_events_own ON call_events
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Usage Records ────────────────────────────────────────────

CREATE POLICY usage_superadmin ON usage_records
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY usage_own ON usage_records
    FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Webhook Deliveries ───────────────────────────────────────

CREATE POLICY webhook_superadmin ON webhook_deliveries
    FOR ALL USING (auth.is_superadmin());

CREATE POLICY webhook_own ON webhook_deliveries
    FOR ALL USING (tenant_id = auth.tenant_id());
