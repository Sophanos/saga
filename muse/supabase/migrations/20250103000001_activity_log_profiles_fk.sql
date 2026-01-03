-- Migration: Fix activity_log actor_user_id relationship to profiles
-- Ensures PostgREST can join activity_log.actor_user_id -> profiles.id

ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_actor_user_id_fkey;

ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL
  NOT VALID;
