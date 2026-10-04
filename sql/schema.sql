-- Run once in the Supabase SQL editor for the portfolio project.
-- Public/anon/authenticated clients receive no table policies. Vercel functions use the
-- service-role key only on the server after validating contact input or admin auth.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  company text not null default '' check (char_length(company) <= 100),
  role text not null default '' check (char_length(role) <= 100),
  subject text not null check (char_length(subject) between 1 and 160),
  message text not null check (char_length(message) between 20 and 5000),
  linkedin text not null default '' check (char_length(linkedin) <= 250),
  status text not null default 'unread' check (status in ('unread', 'read', 'replied', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_status_created_at_idx on public.messages (status, created_at desc);

-- Supabase Auth owns password hashing and session issuance. Add only a deliberately
-- provisioned Auth user to this table to authorize the private inbox.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (char_length(email) <= 254),
  created_at timestamptz not null default now()
);

create table if not exists public.message_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  event text not null check (event in ('received', 'status_changed', 'reply_sent', 'deleted')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists message_events_message_created_idx on public.message_events (message_id, created_at desc);

-- Fingerprints are HMAC-SHA-256 values. Raw client IP addresses are never stored.
create table if not exists public.contact_rate_limits (
  fingerprint_hash text primary key check (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1),
  updated_at timestamptz not null default now()
);

alter table public.messages enable row level security;
alter table public.admin_users enable row level security;
alter table public.message_events enable row level security;
alter table public.contact_rate_limits enable row level security;

revoke all on public.messages, public.admin_users, public.message_events, public.contact_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.messages, public.admin_users, public.message_events, public.contact_rate_limits to service_role;

create or replace function public.consume_contact_rate_limit(
  p_fingerprint text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate-limit fingerprint';
  end if;
  if p_limit < 1 or p_limit > 100 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit parameters';
  end if;

  insert into public.contact_rate_limits (fingerprint_hash, window_started_at, request_count, updated_at)
  values (p_fingerprint, v_now, 1, v_now)
  on conflict (fingerprint_hash) do update set
    window_started_at = case
      when public.contact_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now
      else public.contact_rate_limits.window_started_at
    end,
    request_count = case
      when public.contact_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1
      else public.contact_rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_contact_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_contact_rate_limit(text, integer, integer) to service_role;
