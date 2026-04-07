-- ══════════════════════════════════════════════════════════════
-- 006 — SaaS Transformation: Spending Limits + Bolna Integration
-- Adds dollar-based limits, Bolna agent/batch/execution mappings
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- Tenant spending limits (admin-allocated)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS monthly_spend_limit_usd FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS allocated_minutes INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS allocated_dollars FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS used_minutes FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS used_dollars FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS spending_limit_action TEXT NOT NULL DEFAULT 'pause'
        CHECK (spending_limit_action IN ('pause', 'block', 'warn'));

COMMENT ON COLUMN tenants.allocated_minutes IS 'Admin-set total minutes this tenant can use (0 = use monthly_call_minutes_limit)';
COMMENT ON COLUMN tenants.allocated_dollars IS 'Admin-set total dollar budget this tenant can spend (0 = unlimited)';
COMMENT ON COLUMN tenants.used_minutes IS 'Running total of minutes consumed (reset monthly or by admin)';
COMMENT ON COLUMN tenants.used_dollars IS 'Running total of dollars consumed (reset monthly or by admin)';
COMMENT ON COLUMN tenants.spending_limit_action IS 'What to do when limit is hit: pause campaigns, block new calls, or just warn';

-- ──────────────────────────────────────────────────────────────
-- Bolna agent mapping (internal agent ↔ Bolna agent)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS bolna_agent_id TEXT,
    ADD COLUMN IF NOT EXISTS bolna_agent_config JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_agents_bolna ON agents(bolna_agent_id) WHERE bolna_agent_id IS NOT NULL;

COMMENT ON COLUMN agents.bolna_agent_id IS 'Bolna platform agent ID (set when agent is created via Bolna API)';
COMMENT ON COLUMN agents.bolna_agent_config IS 'Full Bolna agent_config snapshot for reference';

-- ──────────────────────────────────────────────────────────────
-- Bolna batch mapping on campaigns
-- ──────────────────────────────────────────────────────────────
ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS bolna_batch_id TEXT,
    ADD COLUMN IF NOT EXISTS bolna_batch_status TEXT;

CREATE INDEX IF NOT EXISTS idx_campaigns_bolna_batch ON campaigns(bolna_batch_id) WHERE bolna_batch_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- Bolna execution ID on calls
-- ──────────────────────────────────────────────────────────────
ALTER TABLE calls
    ADD COLUMN IF NOT EXISTS bolna_execution_id TEXT;

CREATE INDEX IF NOT EXISTS idx_calls_bolna_exec ON calls(bolna_execution_id) WHERE bolna_execution_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- Spending ledger — immutable log of all spending events
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spending_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'call_completed',      -- minutes/dollars deducted after a call
        'admin_credit',        -- admin added minutes/dollars
        'admin_debit',         -- admin removed minutes/dollars
        'monthly_reset',       -- monthly usage counters reset
        'limit_exceeded'       -- logged when a limit was hit
    )),
    minutes_delta FLOAT NOT NULL DEFAULT 0,
    dollars_delta FLOAT NOT NULL DEFAULT 0,
    balance_minutes_after FLOAT NOT NULL DEFAULT 0,
    balance_dollars_after FLOAT NOT NULL DEFAULT 0,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spending_ledger_tenant ON spending_ledger(tenant_id, created_at DESC);
CREATE INDEX idx_spending_ledger_event ON spending_ledger(tenant_id, event_type);

-- Enable RLS
ALTER TABLE spending_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY spending_ledger_superadmin ON spending_ledger
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
    );

CREATE POLICY spending_ledger_tenant ON spending_ledger
    FOR SELECT USING (tenant_id = auth.tenant_id());
