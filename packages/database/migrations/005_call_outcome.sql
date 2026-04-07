-- Add call outcome classification column
ALTER TABLE calls
    ADD COLUMN IF NOT EXISTS outcome VARCHAR(20);

COMMENT ON COLUMN calls.outcome IS 'LLM-classified call outcome: converted, callback-needed, not-interested, no-answer, voicemail';

-- Index for filtering calls by outcome (e.g. campaign results)
CREATE INDEX IF NOT EXISTS idx_calls_outcome ON calls (outcome) WHERE outcome IS NOT NULL;

-- Index for filtering calls by campaign + outcome
CREATE INDEX IF NOT EXISTS idx_calls_campaign_outcome ON calls (campaign_id, outcome) WHERE campaign_id IS NOT NULL AND outcome IS NOT NULL;
