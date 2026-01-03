-- Fix ambiguous trial_limit reference in consume_anon_trial_request
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
    and requests_used < public.anon_trial_quotas.trial_limit
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
