-- ══════════════════════════════════════════════════════════════
-- Seed Data
-- NOTE: Run AFTER creating users in Supabase Auth.
-- The UUIDs below are placeholders — replace with real auth.users IDs.
-- ══════════════════════════════════════════════════════════════

-- Demo tenants
INSERT INTO tenants (id, name, slug, plan, max_agents, max_concurrent_calls, monthly_call_minutes_limit) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Vgent Platform', 'vgent', 'enterprise', 100, 50, 10000),
    ('a0000000-0000-0000-0000-000000000002', 'Acme Corp', 'acme', 'pro', 10, 5, 500),
    ('a0000000-0000-0000-0000-000000000003', 'Demo Startup', 'demo-startup', 'free', 3, 2, 100);

-- NOTE: Users must be created in Supabase Auth first, then insert here with matching UUIDs.
-- Example (replace UUIDs with real auth.users IDs after signup):
--
-- INSERT INTO users (id, tenant_id, role, full_name) VALUES
--     ('<superadmin-auth-uid>', 'a0000000-0000-0000-0000-000000000001', 'superadmin', 'Platform Admin'),
--     ('<owner1-auth-uid>', 'a0000000-0000-0000-0000-000000000002', 'owner', 'Acme Owner'),
--     ('<owner2-auth-uid>', 'a0000000-0000-0000-0000-000000000003', 'owner', 'Demo Owner');

-- Sample contacts for Acme Corp
INSERT INTO contacts (tenant_id, phone_number, first_name, last_name, email) VALUES
    ('a0000000-0000-0000-0000-000000000002', '+14155551001', 'Alice', 'Johnson', 'alice@example.com'),
    ('a0000000-0000-0000-0000-000000000002', '+14155551002', 'Bob', 'Smith', 'bob@example.com'),
    ('a0000000-0000-0000-0000-000000000002', '+14155551003', 'Carol', 'Williams', 'carol@example.com'),
    ('a0000000-0000-0000-0000-000000000002', '+14155551004', 'David', 'Brown', 'david@example.com'),
    ('a0000000-0000-0000-0000-000000000002', '+14155551005', 'Eve', 'Davis', 'eve@example.com');

-- Sample contacts for Demo Startup
INSERT INTO contacts (tenant_id, phone_number, first_name, last_name, email) VALUES
    ('a0000000-0000-0000-0000-000000000003', '+919876543001', 'Raj', 'Patel', 'raj@example.com'),
    ('a0000000-0000-0000-0000-000000000003', '+919876543002', 'Priya', 'Sharma', 'priya@example.com'),
    ('a0000000-0000-0000-0000-000000000003', '+919876543003', 'Amit', 'Kumar', 'amit@example.com');
