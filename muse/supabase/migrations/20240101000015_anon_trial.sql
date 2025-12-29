-- ============================================================================
-- Anonymous Trial System
-- ============================================================================
-- Server-side enforcement of anonymous trial limits to prevent abuse.
-- Tracks pseudonymous device sessions and enforces quota + rate limits.
--
-- Key tables:
--   - anon_devices: Device/session tracking (pseudonymous)
--   - anon_trial_quotas: Per-device AI request quotas
--   - rate_limit_buckets: IP/device rate limiting
--
-- Key functions:
--   - register_anon_device: Create/reuse anonymous device
--   - consume_anon_trial_request: Atomic quota consumption
--   - check_rate_limit: Fixed-window rate limiting
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- Device tracking (pseudonymous)
create table if not exists public.anon_devices (
  id uuid primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  -- Privacy-preserving signals (only hashes stored)
  fingerprint_hash text null,
  ip_prefix_hash text null,
  user_agent_hash text null,

  -- Abuse controls
  is_blocked boolean not null default false,
  blocked_reason text null,
  blocked_at timestamptz null,

  -- Optional link after signup (for analytics/fraud continuity)
  claimed_user_id uuid null references auth.users(id) on delete set null,
  claimed_at timestamptz null
);

comment on table public.anon_devices is 'Pseudonymous device tracking for anonymous trial sessions';
comment on column public.anon_devices.fingerprint_hash is 'HMAC hash of coarse browser fingerprint';
comment on column public.anon_devices.ip_prefix_hash is 'HMAC hash of IP prefix (e.g., /24 for IPv4)';
comment on column public.anon_devices.claimed_user_id is 'User ID if device was claimed after signup';

-- Indexes for lookups
create index if not exists idx_anon_devices_fingerprint_hash
  on public.anon_devices(fingerprint_hash) where fingerprint_hash is not null;
create index if not exists idx_anon_devices_ip_prefix_hash
  on public.anon_devices(ip_prefix_hash) where ip_prefix_hash is not null;
create index if not exists idx_anon_devices_last_seen
  on public.anon_devices(last_seen_at);

-- Quota enforcement
create table if not exists public.anon_trial_quotas (
  device_id uuid primary key references public.anon_devices(id) on delete cascade,
  trial_limit int not null default 5,
  requests_used int not null default 0,
  first_used_at timestamptz null,
  last_used_at timestamptz null,

  constraint requests_used_non_negative check (requests_used >= 0)
);

comment on table public.anon_trial_quotas is 'Anonymous trial AI request quotas (server-enforced)';
comment on column public.anon_trial_quotas.trial_limit is 'Maximum AI requests allowed for this device';
comment on column public.anon_trial_quotas.requests_used is 'Number of AI requests consumed';

-- Rate limiting buckets (fixed-window)
create table if not exists public.rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket_key, window_start)
);

comment on table public.rate_limit_buckets is 'Fixed-window rate limiting counters';
comment on column public.rate_limit_buckets.bucket_key is 'Format: type:hash:action (e.g., ip:abc123:anon_session)';

-- Index for cleanup of old buckets
create index if not exists idx_rate_limit_buckets_window
  on public.rate_limit_buckets(window_start);

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Register or reuse an anonymous device
create or replace function public.register_anon_device(
  p_fingerprint_hash text,
  p_ip_prefix_hash text,
  p_user_agent_hash text default null
) returns table (
  device_id uuid,
  is_new boolean,
  trial_limit int,
  requests_used int,
  remaining int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
  v_is_new boolean := false;
  v_limit int;
  v_used int;
begin
  -- Try to find existing device by fingerprint + IP (recent activity)
  select d.id into v_device_id
  from public.anon_devices d
  where d.fingerprint_hash = p_fingerprint_hash
    and d.ip_prefix_hash = p_ip_prefix_hash
    and d.last_seen_at > now() - interval '30 days'
    and d.is_blocked = false
  limit 1;

  if v_device_id is null then
    -- Create new device
    v_device_id := gen_random_uuid();
    v_is_new := true;

    insert into public.anon_devices(
      id, fingerprint_hash, ip_prefix_hash, user_agent_hash
    ) values (
      v_device_id, p_fingerprint_hash, p_ip_prefix_hash, p_user_agent_hash
    );

    insert into public.anon_trial_quotas(device_id)
    values (v_device_id);
  else
    -- Update last seen
    update public.anon_devices
    set last_seen_at = now(),
        user_agent_hash = coalesce(p_user_agent_hash, user_agent_hash)
    where id = v_device_id;
  end if;

  -- Get quota info
  select q.trial_limit, q.requests_used
  into v_limit, v_used
  from public.anon_trial_quotas q
  where q.device_id = v_device_id;

  return query select
    v_device_id,
    v_is_new,
    v_limit,
    v_used,
    greatest(v_limit - v_used, 0);
end;
$$;

comment on function public.register_anon_device is
  'Create or reuse anonymous device session. Returns device ID and quota status.';

-- Consume one trial request atomically
create or replace function public.consume_anon_trial_request(
  p_device_id uuid
) returns table (
  allowed boolean,
  used int,
  remaining int,
  trial_limit int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_used int;
  v_new_used int;
  v_blocked boolean;
begin
  -- Check if device is blocked
  select d.is_blocked into v_blocked
  from public.anon_devices d
  where d.id = p_device_id;

  if v_blocked is null then
    -- Device doesn't exist
    return query select false, 0, 0, 0;
    return;
  end if;

  if v_blocked then
    return query select false, 0, 0, 0;
    return;
  end if;

  -- Get current quota
  select q.trial_limit, q.requests_used
  into v_limit, v_used
  from public.anon_trial_quotas q
  where q.device_id = p_device_id
  for update; -- Lock the row

  if v_limit is null then
    -- Defensive: create quota row if missing
    insert into public.anon_trial_quotas(device_id)
    values (p_device_id)
    on conflict do nothing;

    select q.trial_limit, q.requests_used
    into v_limit, v_used
    from public.anon_trial_quotas q
    where q.device_id = p_device_id;
  end if;

  -- Check if already exhausted
  if v_used >= v_limit then
    return query select false, v_used, 0, v_limit;
    return;
  end if;

  -- Consume one request
  update public.anon_trial_quotas
  set requests_used = requests_used + 1,
      first_used_at = coalesce(first_used_at, now()),
      last_used_at = now()
  where device_id = p_device_id
    and requests_used < trial_limit
  returning requests_used into v_new_used;

  if v_new_used is null then
    -- Race condition: another request consumed the last slot
    return query select false, v_used, 0, v_limit;
    return;
  end if;

  -- Update device last seen
  update public.anon_devices
  set last_seen_at = now()
  where id = p_device_id;

  return query select true, v_new_used, greatest(v_limit - v_new_used, 0), v_limit;
end;
$$;

comment on function public.consume_anon_trial_request is
  'Atomically consume one anonymous trial request. Returns false if exhausted.';

-- Get anonymous trial status (read-only)
create or replace function public.get_anon_trial_status(
  p_device_id uuid
) returns table (
  is_valid boolean,
  is_blocked boolean,
  trial_limit int,
  requests_used int,
  remaining int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocked boolean;
  v_limit int;
  v_used int;
begin
  -- Get device and quota info
  select d.is_blocked, q.trial_limit, q.requests_used
  into v_blocked, v_limit, v_used
  from public.anon_devices d
  left join public.anon_trial_quotas q on q.device_id = d.id
  where d.id = p_device_id;

  if v_limit is null then
    -- Device not found
    return query select false, false, 0, 0, 0;
    return;
  end if;

  return query select
    true,
    v_blocked,
    v_limit,
    v_used,
    greatest(v_limit - v_used, 0);
end;
$$;

comment on function public.get_anon_trial_status is
  'Get read-only anonymous trial status for a device.';

-- Rate limit check (fixed-window)
create or replace function public.check_rate_limit(
  p_bucket_key text,
  p_window_seconds int,
  p_limit int
) returns table (
  allowed boolean,
  current_count int,
  resets_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  -- Calculate window start (floor to window boundary)
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- Upsert bucket and get count
  insert into public.rate_limit_buckets(bucket_key, window_start, count)
  values (p_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set count = rate_limit_buckets.count + 1
  returning count into v_count;

  return query select
    v_count <= p_limit,
    v_count,
    v_window_start + (p_window_seconds || ' seconds')::interval;
end;
$$;

comment on function public.check_rate_limit is
  'Fixed-window rate limiting. Returns whether request is allowed.';

-- Claim anonymous device after signup
create or replace function public.claim_anon_device(
  p_device_id uuid,
  p_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.anon_devices
  set claimed_user_id = p_user_id,
      claimed_at = now()
  where id = p_device_id
    and claimed_user_id is null; -- Only claim if not already claimed

  return found;
end;
$$;

comment on function public.claim_anon_device is
  'Link anonymous device to user after signup for analytics continuity.';

-- ============================================================================
-- CLEANUP FUNCTION (run periodically)
-- ============================================================================

create or replace function public.cleanup_anon_trial_data()
returns table (
  devices_deleted int,
  buckets_deleted int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_devices int;
  v_buckets int;
begin
  -- Delete old unclaimed devices (90 days inactive)
  with deleted as (
    delete from public.anon_devices
    where last_seen_at < now() - interval '90 days'
      and claimed_user_id is null
    returning 1
  )
  select count(*) into v_devices from deleted;

  -- Delete old rate limit buckets (7 days old)
  with deleted as (
    delete from public.rate_limit_buckets
    where window_start < now() - interval '7 days'
    returning 1
  )
  select count(*) into v_buckets from deleted;

  return query select v_devices, v_buckets;
end;
$$;

comment on function public.cleanup_anon_trial_data is
  'Cleanup stale anonymous trial data. Call periodically via cron.';

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Revoke direct access from anon and authenticated roles
-- All access should go through RPC functions with service_role

revoke all on public.anon_devices from anon, authenticated;
revoke all on public.anon_trial_quotas from anon, authenticated;
revoke all on public.rate_limit_buckets from anon, authenticated;

-- RPC functions are SECURITY DEFINER, so they run as the definer (superuser)
-- Edge functions use service_role key which has full access

-- Grant execute on RPC functions to service_role only
-- (Edge functions will call these with service key)
revoke execute on function public.register_anon_device from public;
revoke execute on function public.consume_anon_trial_request from public;
revoke execute on function public.get_anon_trial_status from public;
revoke execute on function public.check_rate_limit from public;
revoke execute on function public.claim_anon_device from public;
revoke execute on function public.cleanup_anon_trial_data from public;

-- Enable RLS but with no policies (service_role bypasses RLS)
alter table public.anon_devices enable row level security;
alter table public.anon_trial_quotas enable row level security;
alter table public.rate_limit_buckets enable row level security;
