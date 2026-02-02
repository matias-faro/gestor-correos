-- Hardening: estados de envío, locks e idempotencia

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'draft_item_state'::regtype
      AND enumlabel = 'sending'
  ) THEN
    ALTER TYPE draft_item_state ADD VALUE 'sending';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_campaigns_active_lock_true
ON campaigns (active_lock)
WHERE active_lock = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS ux_send_events_draft_item_id
ON send_events (draft_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bounce_events_message_id
ON bounce_events (gmail_message_id)
WHERE gmail_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_unsubscribe_events_token_hash
ON unsubscribe_events (token_hash);

CREATE OR REPLACE FUNCTION claim_next_pending_draft_item(p_campaign_id UUID)
RETURNS SETOF draft_items
LANGUAGE plpgsql
AS $$
DECLARE
  stale_before TIMESTAMPTZ := NOW() - INTERVAL '15 minutes';
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM draft_items
    WHERE campaign_id = p_campaign_id
      AND (
        state = 'pending'
        OR (state = 'sending' AND updated_at < stale_before)
      )
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE draft_items
  SET state = 'sending', updated_at = NOW()
  WHERE id IN (SELECT id FROM candidate)
  RETURNING *;
END;
$$;
