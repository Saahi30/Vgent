-- Scheduled callbacks: allows scheduling a future call to a contact via an agent.
-- The Celery Beat scanner picks up due rows every 60s and dispatches calls.

CREATE TABLE scheduled_callbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | dispatched | completed | failed | cancelled
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_callbacks_tenant ON scheduled_callbacks(tenant_id);
CREATE INDEX idx_scheduled_callbacks_due ON scheduled_callbacks(status, scheduled_at)
    WHERE status = 'pending';

-- RLS
ALTER TABLE scheduled_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_callbacks_tenant_isolation ON scheduled_callbacks
    USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_scheduled_callbacks
    BEFORE UPDATE ON scheduled_callbacks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
