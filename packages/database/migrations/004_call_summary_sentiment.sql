-- Add post-call summary and sentiment analysis columns to calls table
ALTER TABLE calls
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS sentiment_score FLOAT,
    ADD COLUMN IF NOT EXISTS sentiment_label TEXT;

COMMENT ON COLUMN calls.summary IS 'LLM-generated post-call summary';
COMMENT ON COLUMN calls.sentiment_score IS 'Sentiment score from -1.0 (negative) to 1.0 (positive)';
COMMENT ON COLUMN calls.sentiment_label IS 'Sentiment label: positive, negative, neutral, mixed';
