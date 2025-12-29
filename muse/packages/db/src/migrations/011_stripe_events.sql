-- Migration: 011_stripe_events
-- Description: Add stripe_events table for webhook idempotency
-- This prevents duplicate processing of Stripe webhook events

-- ============================================================================
-- STRIPE EVENTS TABLE (for idempotency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by event_id
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id);

-- Index for cleanup of old events
CREATE INDEX IF NOT EXISTS idx_stripe_events_created_at ON stripe_events(created_at);

-- RLS: Only service role can access this table
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- No user policies - this table is only accessed by service role (webhooks)

-- Function to clean up old events (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_stripe_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM stripe_events
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Comment for documentation
COMMENT ON TABLE stripe_events IS 'Stores processed Stripe webhook event IDs for idempotency. Events older than 30 days can be cleaned up.';
COMMENT ON COLUMN stripe_events.event_id IS 'Stripe event ID (e.g., evt_xxx)';
COMMENT ON COLUMN stripe_events.event_type IS 'Stripe event type (e.g., customer.subscription.updated)';

-- ============================================================================
-- DOWN MIGRATION (for rollback)
-- ============================================================================
-- To rollback, run:
-- DROP FUNCTION IF EXISTS cleanup_old_stripe_events();
-- DROP TABLE IF EXISTS stripe_events;
