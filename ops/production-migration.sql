-- Intended project: tfphopejudgbfrucdxsy (neylo). Fresh schema only.
begin;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);

-- 202609120001_core.sql
-- All cross-account writes are service-only. auth.users remains provider-owned.
create extension if not exists pgcrypto with schema extensions;

create type public.participant_cohort as enum ('independent','founder_assisted','staff','test','compensated');
create type public.referral_status as enum ('pending','qualified','review_required','credited','ineligible');

create table public.campaign_versions (
  id text primary key,
  campaign_id text not null default 'founding' check (campaign_id = 'founding'),
  welcome_minor integer not null check (welcome_minor = 10000),
  referral_minor integer not null check (referral_minor = 5000),
  referral_cap integer not null check (referral_cap = 3),
  founder_cap integer not null check (founder_cap = 100),
  currency text not null default 'BAM' check (currency = 'BAM'),
  terms_body text not null,
  privacy_body text not null,
  eligibility_region text,
  minimum_age integer not null default 18 check (minimum_age >= 18),
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at < ends_at),
  check (published_at is null or (eligibility_region is not null and starts_at is not null))
);
insert into public.campaign_versions(id,welcome_minor,referral_minor,referral_cap,founder_cap,terms_body,privacy_body)
values ('founding-draft-v1',10000,5000,3,100,'Draft. Operator-reviewed campaign policy required before enrollment.','Draft. Operator-reviewed privacy notice required before enrollment.');

create table public.campaign_state (
  id text primary key check (id = 'founding'),
  active_version text not null references public.campaign_versions(id),
  allocated_founders integer not null default 0 check (allocated_founders between 0 and 100),
  paused boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.campaign_state(id,active_version) values ('founding','founding-draft-v1');

create table public.profiles (
  user_id uuid primary key references auth.users(id),
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  completed_at timestamptz not null default now(),
  verified_at timestamptz not null,
  cohort public.participant_cohort not null default 'independent',
  marketing_consent boolean not null default false,
  analytics_consent boolean not null default false,
  review_required boolean not null default false,
  source text not null check (source in ('direct','scc','invitation','social','outreach')),
  campaign_tag text check (length(campaign_tag) <= 80),
  consent_updated_at timestamptz not null default now()
);

create table public.participant_tags (
  email text primary key check (email = lower(trim(email))),
  cohort public.participant_cohort not null,
  review_required boolean not null default false,
  reason text not null check (length(reason) between 3 and 1000),
  created_at timestamptz not null default now()
);

create table public.pending_signups (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  email text not null check (email = lower(trim(email)) and length(email) <= 254),
  handle text not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  terms_version text not null references public.campaign_versions(id),
  accepted_at timestamptz not null default now(),
  offer_displayed boolean not null,
  eligible_attestation boolean not null check (eligible_attestation),
  inviter_id uuid references public.profiles(user_id),
  source text not null check (source in ('direct','scc','invitation','social','outreach')),
  campaign_tag text check (length(campaign_tag) <= 80),
  cohort public.participant_cohort not null default 'independent',
  review_required boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  otp_last_requested_at timestamptz,
  otp_provider_accepted_at timestamptz,
  finalized_user_id uuid unique references public.profiles(user_id),
  finalized_at timestamptz
);
create index pending_signups_email_idx on public.pending_signups(email,created_at desc);

create table public.handle_registry (
  handle text primary key check (handle ~ '^[a-z0-9_]{3,20}$'),
  attempt_id uuid unique references public.pending_signups(id),
  user_id uuid unique references public.profiles(user_id),
  expires_at timestamptz,
  check ((user_id is not null and expires_at is null) or (user_id is null and attempt_id is not null and expires_at is not null))
);

create table public.enrollments (
  user_id uuid primary key references public.profiles(user_id),
  campaign_id text not null default 'founding' check (campaign_id = 'founding'),
  terms_version text not null references public.campaign_versions(id),
  accepted_at timestamptz not null,
  eligibility text not null check (eligibility in ('eligible','review_required','excluded')),
  founder_ordinal integer unique check (founder_ordinal between 1 and 100),
  referral_slots_consumed integer not null default 0 check (referral_slots_consumed between 0 and 3),
  created_at timestamptz not null default now(),
  check (founder_ordinal is null or eligibility = 'eligible'),
  check (founder_ordinal is not null or referral_slots_consumed = 0)
);

create table public.invitation_codes (
  code text primary key default encode(extensions.gen_random_bytes(18),'hex') check (code ~ '^[a-f0-9]{36}$'),
  user_id uuid not null unique references public.profiles(user_id),
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(user_id),
  invitee_id uuid not null unique references public.profiles(user_id),
  terms_version text not null references public.campaign_versions(id),
  status public.referral_status not null default 'pending',
  reason_code text,
  reward_slot integer check (reward_slot between 1 and 3),
  qualified_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  check (inviter_id <> invitee_id),
  check ((credited_at is null and reward_slot is null) or (credited_at is not null and reward_slot is not null)),
  unique(inviter_id,reward_slot)
);

create table public.credit_entries (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.profiles(user_id),
  campaign_id text not null default 'founding' check (campaign_id = 'founding'),
  terms_version text not null references public.campaign_versions(id),
  amount_minor integer not null,
  currency text not null default 'BAM' check (currency = 'BAM'),
  source_type text not null check (source_type in ('welcome','referral','reversal')),
  source_key text not null unique,
  referral_id uuid unique references public.referrals(id),
  reversal_of uuid unique references public.credit_entries(id),
  reason text,
  created_at timestamptz not null default now(),
  check ((source_type = 'welcome' and amount_minor = 10000 and referral_id is null and reversal_of is null)
    or (source_type = 'referral' and amount_minor = 5000 and referral_id is not null and reversal_of is null)
    or (source_type = 'reversal' and amount_minor in (-10000,-5000) and referral_id is null and reversal_of is not null and length(reason) >= 3))
);
create unique index one_welcome_per_account on public.credit_entries(beneficiary_id,campaign_id) where source_type = 'welcome';
create index credit_entries_beneficiary_idx on public.credit_entries(beneficiary_id,created_at);

create table public.qualification_answers (
  user_id uuid primary key references public.profiles(user_id),
  pilot_interest boolean not null default false,
  recent_use_case text check (length(recent_use_case) <= 500),
  upcoming_need text check (length(upcoming_need) <= 500),
  updated_at timestamptz not null default now()
);
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id),
  session_hash text,
  provenance text not null check (provenance in ('server','client')),
  event_name text not null,
  domain_key text not null unique,
  created_at timestamptz not null default now(),
  check ((provenance = 'server' and event_name in ('account_finalized','welcome_credit_reserved','referral_qualified','referral_credit_reserved','credit_reversed','pilot_interest_recorded'))
    or (provenance = 'client' and event_name in ('landing_view','signup_started','demo_started','demo_completed','share_attempted','invite_link_copied','referral_page_interaction')))
);
create table public.admin_memberships (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('operator','presenter')),
  created_at timestamptz not null default now()
);
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_id text,
  reason text not null check (length(reason) between 3 and 1000),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.deletion_requests (
  user_id uuid primary key references public.profiles(user_id),
  requested_at timestamptz not null default now(),
  status text not null default 'requested' check (status in ('requested','processing','completed','retention_required')),
  operator_note text,
  updated_at timestamptz not null default now()
);
create table public.idempotency_records (
  actor_key text not null,
  operation text not null,
  key text not null,
  request_hash text not null,
  outcome jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_key,operation,key)
);
create table public.rate_limit_buckets (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null check (hits > 0)
);

create function public.reject_mutation() returns trigger language plpgsql set search_path = '' as $$
begin raise exception using message = 'IMMUTABLE_RECORD', errcode = 'P0001'; end; $$;
create trigger credit_entries_immutable before update or delete on public.credit_entries for each row execute function public.reject_mutation();
create trigger campaign_versions_immutable before update or delete on public.campaign_versions for each row execute function public.reject_mutation();
create trigger audit_log_immutable before update or delete on public.admin_audit_log for each row execute function public.reject_mutation();
create trigger events_immutable before update or delete on public.analytics_events for each row execute function public.reject_mutation();

do $$ declare t text; begin
  foreach t in array array['campaign_versions','campaign_state','profiles','participant_tags','pending_signups','handle_registry','enrollments','invitation_codes','referrals','credit_entries','qualification_answers','analytics_events','admin_memberships','admin_audit_log','deletion_requests','idempotency_records','rate_limit_buckets'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

grant select on public.profiles, public.enrollments, public.credit_entries, public.invitation_codes, public.qualification_answers, public.deletion_requests to authenticated;
create policy own_profile on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy own_enrollment on public.enrollments for select to authenticated using ((select auth.uid()) = user_id);
create policy own_credit_entries on public.credit_entries for select to authenticated using ((select auth.uid()) = beneficiary_id);
create policy own_invitation on public.invitation_codes for select to authenticated using ((select auth.uid()) = user_id);
create policy own_qualification on public.qualification_answers for select to authenticated using ((select auth.uid()) = user_id);
create policy own_deletion on public.deletion_requests for select to authenticated using ((select auth.uid()) = user_id);

revoke all on function public.reject_mutation() from public, anon, authenticated;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202609120001','core',array['-- All cross-account writes are service-only. auth.users remains provider-owned.
create extension if not exists pgcrypto with schema extensions;

create type public.participant_cohort as enum (''independent'',''founder_assisted'',''staff'',''test'',''compensated'');
create type public.referral_status as enum (''pending'',''qualified'',''review_required'',''credited'',''ineligible'');

create table public.campaign_versions (
  id text primary key,
  campaign_id text not null default ''founding'' check (campaign_id = ''founding''),
  welcome_minor integer not null check (welcome_minor = 10000),
  referral_minor integer not null check (referral_minor = 5000),
  referral_cap integer not null check (referral_cap = 3),
  founder_cap integer not null check (founder_cap = 100),
  currency text not null default ''BAM'' check (currency = ''BAM''),
  terms_body text not null,
  privacy_body text not null,
  eligibility_region text,
  minimum_age integer not null default 18 check (minimum_age >= 18),
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at < ends_at),
  check (published_at is null or (eligibility_region is not null and starts_at is not null))
);
insert into public.campaign_versions(id,welcome_minor,referral_minor,referral_cap,founder_cap,terms_body,privacy_body)
values (''founding-draft-v1'',10000,5000,3,100,''Draft. Operator-reviewed campaign policy required before enrollment.'',''Draft. Operator-reviewed privacy notice required before enrollment.'');

create table public.campaign_state (
  id text primary key check (id = ''founding''),
  active_version text not null references public.campaign_versions(id),
  allocated_founders integer not null default 0 check (allocated_founders between 0 and 100),
  paused boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.campaign_state(id,active_version) values (''founding'',''founding-draft-v1'');

create table public.profiles (
  user_id uuid primary key references auth.users(id),
  handle text not null unique check (handle ~ ''^[a-z0-9_]{3,20}$''),
  completed_at timestamptz not null default now(),
  verified_at timestamptz not null,
  cohort public.participant_cohort not null default ''independent'',
  marketing_consent boolean not null default false,
  analytics_consent boolean not null default false,
  review_required boolean not null default false,
  source text not null check (source in (''direct'',''scc'',''invitation'',''social'',''outreach'')),
  campaign_tag text check (length(campaign_tag) <= 80),
  consent_updated_at timestamptz not null default now()
);

create table public.participant_tags (
  email text primary key check (email = lower(trim(email))),
  cohort public.participant_cohort not null,
  review_required boolean not null default false,
  reason text not null check (length(reason) between 3 and 1000),
  created_at timestamptz not null default now()
);

create table public.pending_signups (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ ''^[a-f0-9]{64}$''),
  email text not null check (email = lower(trim(email)) and length(email) <= 254),
  handle text not null check (handle ~ ''^[a-z0-9_]{3,20}$''),
  terms_version text not null references public.campaign_versions(id),
  accepted_at timestamptz not null default now(),
  offer_displayed boolean not null,
  eligible_attestation boolean not null check (eligible_attestation),
  inviter_id uuid references public.profiles(user_id),
  source text not null check (source in (''direct'',''scc'',''invitation'',''social'',''outreach'')),
  campaign_tag text check (length(campaign_tag) <= 80),
  cohort public.participant_cohort not null default ''independent'',
  review_required boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval ''15 minutes''),
  otp_last_requested_at timestamptz,
  otp_provider_accepted_at timestamptz,
  finalized_user_id uuid unique references public.profiles(user_id),
  finalized_at timestamptz
);
create index pending_signups_email_idx on public.pending_signups(email,created_at desc);

create table public.handle_registry (
  handle text primary key check (handle ~ ''^[a-z0-9_]{3,20}$''),
  attempt_id uuid unique references public.pending_signups(id),
  user_id uuid unique references public.profiles(user_id),
  expires_at timestamptz,
  check ((user_id is not null and expires_at is null) or (user_id is null and attempt_id is not null and expires_at is not null))
);

create table public.enrollments (
  user_id uuid primary key references public.profiles(user_id),
  campaign_id text not null default ''founding'' check (campaign_id = ''founding''),
  terms_version text not null references public.campaign_versions(id),
  accepted_at timestamptz not null,
  eligibility text not null check (eligibility in (''eligible'',''review_required'',''excluded'')),
  founder_ordinal integer unique check (founder_ordinal between 1 and 100),
  referral_slots_consumed integer not null default 0 check (referral_slots_consumed between 0 and 3),
  created_at timestamptz not null default now(),
  check (founder_ordinal is null or eligibility = ''eligible''),
  check (founder_ordinal is not null or referral_slots_consumed = 0)
);

create table public.invitation_codes (
  code text primary key default encode(extensions.gen_random_bytes(18),''hex'') check (code ~ ''^[a-f0-9]{36}$''),
  user_id uuid not null unique references public.profiles(user_id),
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(user_id),
  invitee_id uuid not null unique references public.profiles(user_id),
  terms_version text not null references public.campaign_versions(id),
  status public.referral_status not null default ''pending'',
  reason_code text,
  reward_slot integer check (reward_slot between 1 and 3),
  qualified_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  check (inviter_id <> invitee_id),
  check ((credited_at is null and reward_slot is null) or (credited_at is not null and reward_slot is not null)),
  unique(inviter_id,reward_slot)
);

create table public.credit_entries (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.profiles(user_id),
  campaign_id text not null default ''founding'' check (campaign_id = ''founding''),
  terms_version text not null references public.campaign_versions(id),
  amount_minor integer not null,
  currency text not null default ''BAM'' check (currency = ''BAM''),
  source_type text not null check (source_type in (''welcome'',''referral'',''reversal'')),
  source_key text not null unique,
  referral_id uuid unique references public.referrals(id),
  reversal_of uuid unique references public.credit_entries(id),
  reason text,
  created_at timestamptz not null default now(),
  check ((source_type = ''welcome'' and amount_minor = 10000 and referral_id is null and reversal_of is null)
    or (source_type = ''referral'' and amount_minor = 5000 and referral_id is not null and reversal_of is null)
    or (source_type = ''reversal'' and amount_minor in (-10000,-5000) and referral_id is null and reversal_of is not null and length(reason) >= 3))
);
create unique index one_welcome_per_account on public.credit_entries(beneficiary_id,campaign_id) where source_type = ''welcome'';
create index credit_entries_beneficiary_idx on public.credit_entries(beneficiary_id,created_at);

create table public.qualification_answers (
  user_id uuid primary key references public.profiles(user_id),
  pilot_interest boolean not null default false,
  recent_use_case text check (length(recent_use_case) <= 500),
  upcoming_need text check (length(upcoming_need) <= 500),
  updated_at timestamptz not null default now()
);
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id),
  session_hash text,
  provenance text not null check (provenance in (''server'',''client'')),
  event_name text not null,
  domain_key text not null unique,
  created_at timestamptz not null default now(),
  check ((provenance = ''server'' and event_name in (''account_finalized'',''welcome_credit_reserved'',''referral_qualified'',''referral_credit_reserved'',''credit_reversed'',''pilot_interest_recorded''))
    or (provenance = ''client'' and event_name in (''landing_view'',''signup_started'',''demo_started'',''demo_completed'',''share_attempted'',''invite_link_copied'',''referral_page_interaction'')))
);
create table public.admin_memberships (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in (''operator'',''presenter'')),
  created_at timestamptz not null default now()
);
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_id text,
  reason text not null check (length(reason) between 3 and 1000),
  details jsonb not null default ''{}'',
  created_at timestamptz not null default now()
);
create table public.deletion_requests (
  user_id uuid primary key references public.profiles(user_id),
  requested_at timestamptz not null default now(),
  status text not null default ''requested'' check (status in (''requested'',''processing'',''completed'',''retention_required'')),
  operator_note text,
  updated_at timestamptz not null default now()
);
create table public.idempotency_records (
  actor_key text not null,
  operation text not null,
  key text not null,
  request_hash text not null,
  outcome jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_key,operation,key)
);
create table public.rate_limit_buckets (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null check (hits > 0)
);

create function public.reject_mutation() returns trigger language plpgsql set search_path = '''' as $$
begin raise exception using message = ''IMMUTABLE_RECORD'', errcode = ''P0001''; end; $$;
create trigger credit_entries_immutable before update or delete on public.credit_entries for each row execute function public.reject_mutation();
create trigger campaign_versions_immutable before update or delete on public.campaign_versions for each row execute function public.reject_mutation();
create trigger audit_log_immutable before update or delete on public.admin_audit_log for each row execute function public.reject_mutation();
create trigger events_immutable before update or delete on public.analytics_events for each row execute function public.reject_mutation();

do $$ declare t text; begin
  foreach t in array array[''campaign_versions'',''campaign_state'',''profiles'',''participant_tags'',''pending_signups'',''handle_registry'',''enrollments'',''invitation_codes'',''referrals'',''credit_entries'',''qualification_answers'',''analytics_events'',''admin_memberships'',''admin_audit_log'',''deletion_requests'',''idempotency_records'',''rate_limit_buckets''] loop
    execute format(''alter table public.%I enable row level security'',t);
    execute format(''revoke all on public.%I from anon, authenticated'',t);
    execute format(''grant all on public.%I to service_role'',t);
  end loop;
end $$;

grant select on public.profiles, public.enrollments, public.credit_entries, public.invitation_codes, public.qualification_answers, public.deletion_requests to authenticated;
create policy own_profile on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy own_enrollment on public.enrollments for select to authenticated using ((select auth.uid()) = user_id);
create policy own_credit_entries on public.credit_entries for select to authenticated using ((select auth.uid()) = beneficiary_id);
create policy own_invitation on public.invitation_codes for select to authenticated using ((select auth.uid()) = user_id);
create policy own_qualification on public.qualification_answers for select to authenticated using ((select auth.uid()) = user_id);
create policy own_deletion on public.deletion_requests for select to authenticated using ((select auth.uid()) = user_id);

revoke all on function public.reject_mutation() from public, anon, authenticated;
']);

-- 202609120002_signup_transactions.sql
create function public.neylo_valid_handle(p_handle text) returns boolean
language sql immutable set search_path = '' as $$
  select p_handle ~ '^[a-z0-9_]{3,20}$' and p_handle <> all(array[
    'neylo','support','admin','administrator','official','security','api','payments',
    'account','signin','login','help','root','staff','team','founder','billing','abuse','null','undefined','www','judge'
  ]);
$$;

create function public.neylo_rate_limit(p_key text,p_limit integer,p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_hits integer; begin
  if length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 then raise exception 'INVALID_RATE_LIMIT'; end if;
  insert into public.rate_limit_buckets(key,window_start,hits) values(p_key,clock_timestamp(),1)
  on conflict(key) do update set
    hits = case when public.rate_limit_buckets.window_start + make_interval(secs=>p_window_seconds) <= clock_timestamp() then 1 else public.rate_limit_buckets.hits + 1 end,
    window_start = case when public.rate_limit_buckets.window_start + make_interval(secs=>p_window_seconds) <= clock_timestamp() then clock_timestamp() else public.rate_limit_buckets.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end; $$;

create function public.neylo_campaign() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version',v.id,'open',not s.paused and v.published_at is not null and v.starts_at <= now() and (v.ends_at is null or v.ends_at > now()),
    'remaining',100-s.allocated_founders,'region',v.eligibility_region,'minimumAge',v.minimum_age,
    'terms',v.terms_body,'privacy',v.privacy_body,'publishedAt',v.published_at)
  from public.campaign_state s join public.campaign_versions v on v.id=s.active_version where s.id='founding';
$$;

create function public.neylo_handle_available(p_handle text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.neylo_valid_handle(p_handle) and not exists(
    select 1 from public.handle_registry where handle=p_handle and (user_id is not null or expires_at > now())
  );
$$;

create function public.neylo_invitation(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('handle',p.handle,'code',i.code,'mayEarn',e.founder_ordinal is not null and e.referral_slots_consumed<3 and not p.review_required)
  from public.invitation_codes i join public.profiles p on p.user_id=i.user_id
  join public.enrollments e on e.user_id=p.user_id where i.code=p_code;
$$;

create function public.neylo_hold(p_token_hash text,p_email text,p_handle text,p_terms_version text,p_invitation text,
  p_source text,p_campaign_tag text,p_offer_displayed boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_state public.campaign_state; v_terms public.campaign_versions; v_pending public.pending_signups;
  v_handle public.handle_registry; v_inviter uuid; v_tag public.participant_tags;
begin
  select * into strict v_state from public.campaign_state where id='founding' for update;
  select * into strict v_terms from public.campaign_versions where id=v_state.active_version;
  if v_state.paused or v_terms.published_at is null or v_terms.starts_at > now() or v_terms.ends_at <= now() then raise exception 'CAMPAIGN_PAUSED'; end if;
  if not public.neylo_valid_handle(p_handle) then raise exception 'HANDLE_INVALID'; end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' or length(p_email)>254 or p_email <> lower(trim(p_email)) or p_email not like '%@%' then raise exception 'INVALID_INPUT'; end if;
  select * into v_pending from public.pending_signups where token_hash=p_token_hash for update;
  if v_pending.finalized_user_id is not null then raise exception 'ALREADY_COMPLETED'; end if;
  if exists(select 1 from public.profiles p join auth.users u on u.id=p.user_id where lower(u.email)=p_email) then raise exception 'SIGN_IN_REQUIRED'; end if;
  if v_pending.id is not null and v_pending.email <> p_email then raise exception 'PENDING_EMAIL_MISMATCH'; end if;
  if v_pending.id is null and p_terms_version <> v_state.active_version then raise exception 'TERMS_CHANGED'; end if;

  select * into v_handle from public.handle_registry where handle=p_handle for update;
  if v_handle.user_id is not null or (v_handle.expires_at > now() and v_handle.attempt_id is distinct from v_pending.id) then raise exception 'HANDLE_UNAVAILABLE'; end if;
  if v_pending.id is null then
    select user_id into v_inviter from public.invitation_codes where code=p_invitation;
    select * into v_tag from public.participant_tags where email=p_email;
    insert into public.pending_signups(token_hash,email,handle,terms_version,offer_displayed,eligible_attestation,inviter_id,source,campaign_tag,cohort,review_required)
    values(p_token_hash,p_email,p_handle,p_terms_version,p_offer_displayed,true,v_inviter,
      case when v_inviter is not null then 'invitation' else p_source end,p_campaign_tag,
      coalesce(v_tag.cohort,'independent'),coalesce(v_tag.review_required,false)) returning * into v_pending;
  else
    -- Attribution, eligibility and accepted offer never change when the hold is renewed.
    delete from public.handle_registry where attempt_id=v_pending.id and user_id is null;
    update public.pending_signups set handle=p_handle,expires_at=now()+interval '15 minutes' where id=v_pending.id returning * into v_pending;
  end if;
  insert into public.handle_registry(handle,attempt_id,expires_at) values(p_handle,v_pending.id,v_pending.expires_at)
  on conflict(handle) do update set attempt_id=excluded.attempt_id,expires_at=excluded.expires_at
  where public.handle_registry.user_id is null and public.handle_registry.expires_at <= now();
  if not found then raise exception 'HANDLE_UNAVAILABLE'; end if;
  return jsonb_build_object('handle',p_handle,'expiresAt',v_pending.expires_at,'termsVersion',v_pending.terms_version);
end; $$;

create function public.neylo_pending(p_token_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email',email,'handle',handle,'expiresAt',expires_at,'termsVersion',terms_version,
    'finalized',finalized_user_id is not null,'lastOtpAt',otp_last_requested_at)
  from public.pending_signups where token_hash=p_token_hash;
$$;

create function public.neylo_request_otp(p_token_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.pending_signups set otp_last_requested_at=clock_timestamp()
  where token_hash=p_token_hash and finalized_user_id is null and expires_at>now()
    and (otp_last_requested_at is null or otp_last_requested_at < clock_timestamp()-interval '60 seconds');
  return found;
end; $$;
create function public.neylo_otp_accepted(p_token_hash text) returns void
language sql security definer set search_path = '' as $$
  update public.pending_signups set otp_provider_accepted_at=clock_timestamp() where token_hash=p_token_hash;
$$;

create function public.neylo_account(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('handle',p.handle,'completedAt',p.completed_at,'cohort',p.cohort,'email',u.email,
    'founderOrdinal',e.founder_ordinal,'eligibility',e.eligibility,'termsVersion',e.terms_version,'acceptedAt',e.accepted_at,
    'inviteCode',i.code,'referralSlots',e.referral_slots_consumed,'analyticsConsent',p.analytics_consent,'marketingConsent',p.marketing_consent,
    'totalMinor',coalesce((select sum(amount_minor) from public.credit_entries where beneficiary_id=p.user_id),0),
    'welcomeMinor',coalesce((select sum(amount_minor) from public.credit_entries where beneficiary_id=p.user_id and (source_type='welcome' or reversal_of in (select id from public.credit_entries where beneficiary_id=p.user_id and source_type='welcome'))),0),
    'referralMinor',coalesce((select sum(amount_minor) from public.credit_entries where beneficiary_id=p.user_id and (source_type='referral' or reversal_of in (select id from public.credit_entries where beneficiary_id=p.user_id and source_type='referral'))),0),
    'entries',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'type',c.source_type,'amountMinor',c.amount_minor,'createdAt',c.created_at) order by c.created_at desc) from public.credit_entries c where c.beneficiary_id=p.user_id),'[]'::jsonb),
    'referrals',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'reason',r.reason_code,'createdAt',r.created_at) order by r.created_at desc) from public.referrals r where r.inviter_id=p.user_id),'[]'::jsonb),
    'pilotInterest',coalesce(q.pilot_interest,false),'deletionStatus',d.status,
    'canInviteForReward',e.founder_ordinal is not null and e.referral_slots_consumed<3 and not p.review_required
      and not exists(select 1 from public.credit_entries c join public.credit_entries original on original.id=c.reversal_of where c.beneficiary_id=p.user_id and original.source_type='welcome'))
  from public.profiles p join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null
  join public.enrollments e on e.user_id=p.user_id join public.invitation_codes i on i.user_id=p.user_id
  left join public.qualification_answers q on q.user_id=p.user_id left join public.deletion_requests d on d.user_id=p.user_id
  where p.user_id=p_user_id;
$$;

create function public.neylo_credit_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v_original public.credit_entries; v_enrollment public.enrollments; v_referral public.referrals; begin
  select * into strict v_enrollment from public.enrollments where user_id=new.beneficiary_id;
  if new.source_type='reversal' then
    select * into strict v_original from public.credit_entries where id=new.reversal_of;
    if v_original.source_type='reversal' or new.amount_minor <> -v_original.amount_minor or new.beneficiary_id<>v_original.beneficiary_id
      or new.terms_version<>v_original.terms_version or new.source_key<>'reversal:'||v_original.id then raise exception 'INVALID_REVERSAL'; end if;
    return new;
  end if;
  if v_enrollment.founder_ordinal is null or new.terms_version<>v_enrollment.terms_version then raise exception 'FOUNDER_REQUIRED'; end if;
  if new.source_type='welcome' and new.source_key<>'welcome:'||new.beneficiary_id then raise exception 'INVALID_WELCOME_SOURCE'; end if;
  if new.source_type='referral' then
    select * into strict v_referral from public.referrals where id=new.referral_id;
    if v_referral.inviter_id<>new.beneficiary_id or v_referral.status<>'credited' or v_referral.reward_slot is null
      or new.source_key<>'referral:'||v_referral.id then raise exception 'INVALID_REFERRAL_SOURCE'; end if;
  end if;
  if coalesce((select sum(amount_minor) from public.credit_entries where beneficiary_id=new.beneficiary_id and amount_minor>0),0)+new.amount_minor>25000 then raise exception 'CREDIT_CAP'; end if;
  return new;
end; $$;
create trigger credit_integrity before insert on public.credit_entries for each row execute function public.neylo_credit_guard();

create function public.neylo_qualify_referral(p_referral_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_ref public.referrals; v_inviter public.enrollments; v_invitee public.enrollments; v_slot integer; begin
  perform 1 from public.campaign_state where id='founding' for update;
  select * into strict v_ref from public.referrals where id=p_referral_id for update;
  if v_ref.status in ('credited','ineligible') then return; end if;
  select * into strict v_inviter from public.enrollments where user_id=v_ref.inviter_id for update;
  select * into strict v_invitee from public.enrollments where user_id=v_ref.invitee_id;
  if v_invitee.eligibility='excluded' or v_inviter.founder_ordinal is null or exists(
    select 1 from public.credit_entries r join public.credit_entries c on c.id=r.reversal_of where c.beneficiary_id=v_ref.inviter_id and c.source_type='welcome'
  ) then update public.referrals set status='ineligible',reason_code='not_eligible' where id=p_referral_id; return; end if;
  if v_invitee.eligibility='review_required' or exists(select 1 from public.profiles where user_id in (v_ref.inviter_id,v_ref.invitee_id) and review_required) then
    update public.referrals set status='review_required',reason_code='eligibility_review' where id=p_referral_id; return;
  end if;
  update public.referrals set status='qualified',qualified_at=coalesce(qualified_at,now()) where id=p_referral_id;
  insert into public.analytics_events(user_id,provenance,event_name,domain_key) values(v_ref.invitee_id,'server','referral_qualified','qualified:'||v_ref.id) on conflict(domain_key) do nothing;
  if v_inviter.referral_slots_consumed>=3 then update public.referrals set reason_code='reward_cap_reached' where id=p_referral_id; return; end if;
  update public.enrollments set referral_slots_consumed=referral_slots_consumed+1 where user_id=v_ref.inviter_id returning referral_slots_consumed into v_slot;
  update public.referrals set status='credited',reason_code=null,reward_slot=v_slot,credited_at=now() where id=p_referral_id;
  insert into public.credit_entries(beneficiary_id,terms_version,amount_minor,source_type,source_key,referral_id)
    values(v_ref.inviter_id,v_inviter.terms_version,5000,'referral','referral:'||v_ref.id,v_ref.id);
  insert into public.analytics_events(user_id,provenance,event_name,domain_key) values(v_ref.inviter_id,'server','referral_credit_reserved','referral-credit:'||v_ref.id);
end; $$;

create function public.neylo_finalize(p_user_id uuid,p_token_hash text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_state public.campaign_state; v_pending public.pending_signups; v_email text; v_verified timestamptz;
  v_ordinal integer; v_eligibility text; v_ref uuid; v_terms public.campaign_versions; v_outcome jsonb; v_request_hash text;
begin
  if length(p_idempotency_key) not between 8 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  -- Global campaign lock is always first: hold, finalize, review, reversal, pause.
  select * into strict v_state from public.campaign_state where id='founding' for update;
  select email,email_confirmed_at into v_email,v_verified from auth.users where id=p_user_id;
  if v_email is null or v_verified is null then raise exception 'VERIFIED_IDENTITY_REQUIRED'; end if;
  select * into v_pending from public.pending_signups where token_hash=p_token_hash for update;
  if v_pending.id is null or v_pending.email<>lower(v_email) then raise exception 'PENDING_IDENTITY_MISMATCH'; end if;
  if v_pending.finalized_user_id is not null and v_pending.finalized_user_id<>p_user_id then raise exception 'PENDING_IDENTITY_MISMATCH'; end if;
  v_request_hash := encode(extensions.digest(p_token_hash,'sha256'),'hex');
  if exists(select 1 from public.idempotency_records where actor_key=p_user_id::text and operation='finalize' and key=p_idempotency_key and request_hash<>v_request_hash) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  -- Domain identity wins over arbitrary new HTTP idempotency keys. No re-enrollment or attribution changes.
  if exists(select 1 from public.profiles where user_id=p_user_id) then return public.neylo_account(p_user_id); end if;
  if v_state.paused then raise exception 'CAMPAIGN_PAUSED'; end if;
  select * into strict v_terms from public.campaign_versions where id=v_pending.terms_version;
  if v_terms.published_at is null or v_terms.starts_at>now() or v_terms.ends_at<=now() then raise exception 'CAMPAIGN_CLOSED'; end if;
  if v_pending.expires_at<=now() then raise exception 'HOLD_EXPIRED'; end if;
  perform 1 from public.handle_registry where handle=v_pending.handle and attempt_id=v_pending.id and user_id is null and expires_at>now() for update;
  if not found then raise exception 'HOLD_EXPIRED'; end if;
  if v_pending.inviter_id=p_user_id then raise exception 'SELF_REFERRAL'; end if;
  v_eligibility := case when v_pending.cohort in ('test','staff','compensated') then 'excluded' when v_pending.review_required then 'review_required' else 'eligible' end;
  if v_eligibility='eligible' and v_state.allocated_founders<100 then
    update public.campaign_state set allocated_founders=allocated_founders+1,updated_at=now() where id='founding' returning allocated_founders into v_ordinal;
  end if;
  insert into public.profiles(user_id,handle,verified_at,cohort,review_required,source,campaign_tag)
    values(p_user_id,v_pending.handle,v_verified,v_pending.cohort,v_pending.review_required,v_pending.source,v_pending.campaign_tag);
  update public.handle_registry set user_id=p_user_id,expires_at=null where handle=v_pending.handle and attempt_id=v_pending.id;
  insert into public.enrollments(user_id,terms_version,accepted_at,eligibility,founder_ordinal)
    values(p_user_id,v_pending.terms_version,v_pending.accepted_at,v_eligibility,v_ordinal);
  insert into public.invitation_codes(user_id) values(p_user_id);
  if v_ordinal is not null then
    insert into public.credit_entries(beneficiary_id,terms_version,amount_minor,source_type,source_key)
      values(p_user_id,v_pending.terms_version,10000,'welcome','welcome:'||p_user_id);
    insert into public.analytics_events(user_id,provenance,event_name,domain_key) values(p_user_id,'server','welcome_credit_reserved','welcome:'||p_user_id);
  end if;
  if v_pending.inviter_id is not null then
    insert into public.referrals(inviter_id,invitee_id,terms_version)
      select v_pending.inviter_id,p_user_id,terms_version from public.enrollments where user_id=v_pending.inviter_id returning id into v_ref;
    perform public.neylo_qualify_referral(v_ref);
  end if;
  update public.pending_signups set finalized_user_id=p_user_id,finalized_at=now() where id=v_pending.id;
  insert into public.analytics_events(user_id,provenance,event_name,domain_key) values(p_user_id,'server','account_finalized','account:'||p_user_id);
  v_outcome := public.neylo_account(p_user_id);
  insert into public.idempotency_records(actor_key,operation,key,request_hash,outcome) values(p_user_id::text,'finalize',p_idempotency_key,v_request_hash,v_outcome);
  return v_outcome;
end; $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'neylo_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202609120002','signup_transactions',array['create function public.neylo_valid_handle(p_handle text) returns boolean
language sql immutable set search_path = '''' as $$
  select p_handle ~ ''^[a-z0-9_]{3,20}$'' and p_handle <> all(array[
    ''neylo'',''support'',''admin'',''administrator'',''official'',''security'',''api'',''payments'',
    ''account'',''signin'',''login'',''help'',''root'',''staff'',''team'',''founder'',''billing'',''abuse'',''null'',''undefined'',''www'',''judge''
  ]);
$$;

create function public.neylo_rate_limit(p_key text,p_limit integer,p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = '''' as $$
declare v_hits integer; begin
  if length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 then raise exception ''INVALID_RATE_LIMIT''; end if;
  insert into public.rate_limit_buckets(key,window_start,hits) values(p_key,clock_timestamp(),1)
  on conflict(key) do update set
    hits = case when public.rate_limit_buckets.window_start + make_interval(secs=>p_window_seconds) <= clock_timestamp() then 1 else public.rate_limit_buckets.hits + 1 end,
    window_start = case when public.rate_limit_buckets.window_start + make_interval(secs=>p_window_seconds) <= clock_timestamp() then clock_timestamp() else public.rate_limit_buckets.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end; $$;

create function public.neylo_campaign() returns jsonb
language sql stable security definer set search_path = '''' as $$
  select jsonb_build_object(''version'',v.id,''open'',not s.paused and v.published_at is not null and v.starts_at <= now() and (v.ends_at is null or v.ends_at > now()),
    ''remaining'',100-s.allocated_founders,''region'',v.eligibility_region,''minimumAge'',v.minimum_age,
    ''terms'',v.terms_body,''privacy'',v.privacy_body,''publishedAt'',v.published_at)
  from public.campaign_state s join public.campaign_versions v on v.id=s.active_version where s.id=''founding'';
$$;

create function public.neylo_handle_available(p_handle text) returns boolean
language sql stable security definer set search_path = '''' as $$
  select public.neylo_valid_handle(p_handle) and not exists(
    select 1 from public.handle_registry where handle=p_handle and (user_id is not null or expires_at > now())
  );
$$;

create function public.neylo_invitation(p_code text) returns jsonb
language sql stable security definer set search_path = '''' as $$
  select jsonb_build_object(''handle'',p.handle,''code'',i.code,''mayEarn'',e.founder_ordinal is not null and e.referral_slots_consumed<3 and not p.review_required)
  from public.invitation_codes i join public.profiles p on p.user_id=i.user_id
  join public.enrollments e on e.user_id=p.user_id where i.code=p_code;
$$;

create function public.neylo_hold(p_token_hash text,p_email text,p_handle text,p_terms_version text,p_invitation text,
  p_source text,p_campaign_tag text,p_offer_displayed boolean) returns jsonb
language plpgsql security definer set search_path = '''' as $$
declare
  v_state public.campaign_state; v_terms public.campaign_versions; v_pending public.pending_signups;
  v_handle public.handle_registry; v_inviter uuid; v_tag public.participant_tags;
begin
  select * into strict v_state from public.campaign_state where id=''founding'' for update;
  select * into strict v_terms from public.campaign_versions where id=v_state.active_version;
  if v_state.paused or v_terms.published_at is null or v_terms.starts_at > now() or v_terms.ends_at <= now() then raise exception ''CAMPAIGN_PAUSED''; end if;
  if not public.neylo_valid_handle(p_handle) then raise exception ''HANDLE_INVALID''; end if;
  if p_token_hash !~ ''^[a-f0-9]{64}$'' or length(p_email)>254 or p_email <> lower(trim(p_email)) or p_email not like ''%@%'' then raise exception ''INVALID_INPUT''; end if;
  select * into v_pending from public.pending_signups where token_hash=p_token_hash for update;
  if v_pending.finalized_user_id is not null then raise exception ''ALREADY_COMPLETED''; end if;
  if exists(select 1 from public.profiles p join auth.users u on u.id=p.user_id where lower(u.email)=p_email) then raise exception ''SIGN_IN_REQUIRED''; end if;
  if v_pending.id is not null and v_pending.email <> p_email then raise exception ''PENDING_EMAIL_MISMATCH''; end if;
  if v_pending.id is null and p_terms_version <> v_state.active_version then raise exception ''TERMS_CHANGED''; end if;

  select * into v_handle from public.handle_registry where handle=p_handle for update;
  if v_handle.user_id is not null or (v_handle.expires_at > now() and v_handle.attempt_id is distinct from v_pending.id) then raise exception ''HANDLE_UNAVAILABLE''; end if;
  if v_pending.id is null then
    select user_id into v_inviter from public.invitation_codes where code=p_invitation;
    select * into v_tag from public.participant_tags where email=p_email;
    insert into public.pending_signups(token_hash,email,handle,terms_version,offer_displayed,eligible_attestation,inviter_id,source,campaign_tag,cohort,review_required)
    values(p_token_hash,p_email,p_handle,p_terms_version,p_offer_displayed,true,v_inviter,
      case when v_inviter is not null then ''invitation'' else p_source end,p_campaign_tag,
      coalesce(v_tag.cohort,''independent''),coalesce(v_tag.review_required,false)) returning * into v_pending;
  else
    -- Attribution, eligibility and accepted offer never change when the hold is renewed.
    delete from public.handle_registry where attempt_id=v_pending.id and user_id is null;
    update public.pending_signups set handle=p_handle,expires_at=now()+interval ''15 minutes'' where id=v_pending.id returning * into v_pending;
  end if;
  insert into public.handle_registry(handle,attempt_id,expires_at) values(p_handle,v_pending.id,v_pending.expires_at)
  on conflict(handle) do update set attempt_id=excluded.attempt_id,expires_at=excluded.expires_at
  where public.handle_registry.user_id is null and public.handle_registry.expires_at <= now();
  if not found then raise exception ''HANDLE_UNAVAILABLE''; end if;
  return jsonb_build_object(''handle'',p_handle,''expiresAt'',v_pending.expires_at,''termsVersion'',v_pending.terms_version);
end; $$;

create function public.neylo_pending(p_token_hash text) returns jsonb
language sql stable security definer set search_path = '''' as $$
  select jsonb_build_object(''email'',email,''handle'',handle,''expiresAt'',expires_at,''termsVersion'',terms_version,
    ''finalized'',finalized_user_id is not null,''lastOtpAt'',otp_last_requested_at)
  from public.pending_signups where token_hash=p_token_hash;
$$;

create function public.neylo_request_otp(p_token_hash text) returns boolean
language plpgsql security definer set search_path = '''' as $$
begin
  update public.pending_signups set otp_last_requested_at=clock_timestamp()
  where token_hash=p_token_hash and finalized_user_id is null and expires_at>now()
    and (otp_last_requested_at is null or otp_last_requested_at < clock_timestamp()-interval ''60 seconds'');
  return found;
end; $$;
create function public.neylo_otp_accepted(p_token_hash text) returns void
language sql security definer set search_path = '''' as $$
  update public.pending_signups set otp_provider_accepted_at=clock_timestamp() where token_hash=p_token_hash;
$$;

create function public.neylo_account(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '''' as $$
  select jsonb_build_object(''handle'',p.handle,''completedAt'',p.completed_at,''cohort'',p.cohort,''email'',u.email,
    ''founderOrdinal'',e.founder_ordinal,''eligibility'',e.eligibility,''termsVersion'',e.terms_version,''acceptedAt'',e.accepted_at,
    ''inviteCode'',i.code,''referralSlots'',e.referral_slots_consumed,''analyticsConsent'',p.analytics_consent,''marketingConsent'',p.marketing_consent,
    ''totalMinor'',coalesce((select sum(amount_minor) from public.credit_entries where beneficiary_id=p.user_id),0),
    ''welcomeMinor'',coalesce((select sum(amount_minor) from public.credit_entries where beneficiary_id=p.user_id and (source_type=''welcome'' or reversal_of in (select id from public.credit_entries where beneficiary_id=p.user_id and source_type=''welcome''))),0),
    ''referralMinor'',coalesce((select sum(amount_minor) from public.credit_entries where beneficiary_id=p.user_id and (source_type=''referral'' or reversal_of in (select id from public.credit_entries where beneficiary_id=p.user_id and source_type=''referral''))),0),
    ''entries'',coalesce((select jsonb_agg(jsonb_build_object(''id'',c.id,''type'',c.source_type,''amountMinor'',c.amount_minor,''createdAt'',c.created_at) order by c.created_at desc) from public.credit_entries c where c.beneficiary_id=p.user_id),''[]''::jsonb),
    ''referrals'',coalesce((select jsonb_agg(jsonb_build_object(''id'',r.id,''status'',r.status,''reason'',r.reason_code,''createdAt'',r.created_at) order by r.created_at desc) from public.referrals r where r.inviter_id=p.user_id),''[]''::jsonb),
    ''pilotInterest'',coalesce(q.pilot_interest,false),''deletionStatus'',d.status,
    ''canInviteForReward'',e.founder_ordinal is not null and e.referral_slots_consumed<3 and not p.review_required
      and not exists(select 1 from public.credit_entries c join public.credit_entries original on original.id=c.reversal_of where c.beneficiary_id=p.user_id and original.source_type=''welcome''))
  from public.profiles p join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null
  join public.enrollments e on e.user_id=p.user_id join public.invitation_codes i on i.user_id=p.user_id
  left join public.qualification_answers q on q.user_id=p.user_id left join public.deletion_requests d on d.user_id=p.user_id
  where p.user_id=p_user_id;
$$;

create function public.neylo_credit_guard() returns trigger
language plpgsql set search_path = '''' as $$
declare v_original public.credit_entries; v_enrollment public.enrollments; v_referral public.referrals; begin
  select * into strict v_enrollment from public.enrollments where user_id=new.beneficiary_id;
  if new.source_type=''reversal'' then
    select * into strict v_original from public.credit_entries where id=new.reversal_of;
    if v_original.source_type=''reversal'' or new.amount_minor <> -v_original.amount_minor or new.beneficiary_id<>v_original.beneficiary_id
      or new.terms_version<>v_original.terms_version or new.source_key<>''reversal:''||v_original.id then raise exception ''INVALID_REVERSAL''; end if;
    return new;
  end if;
  if v_enrollment.founder_ordinal is null or new.terms_version<>v_enrollment.terms_version then raise exception ''FOUNDER_REQUIRED''; end if;
  if new.source_type=''welcome'' and new.source_key<>''welcome:''||new.beneficiary_id then raise exception ''INVALID_WELCOME_SOURCE''; end if;
  if new.source_type=''referral'' then
    select * into strict v_referral from public.referrals where id=new.referral_id;
    if v_referral.inviter_id<>new.beneficiary_id or v_referral.status<>''credited'' or v_referral.reward_slot is null
      or new.source_key<>''referral:''||v_referral.id then raise exception ''INVALID_REFERRAL_SOURCE''; end if;
  end if;
  if coalesce((select sum(amount_minor) from public.credit_entries where beneficiary_id=new.beneficiary_id and amount_minor>0),0)+new.amount_minor>25000 then raise exception ''CREDIT_CAP''; end if;
  return new;
end; $$;
create trigger credit_integrity before insert on public.credit_entries for each row execute function public.neylo_credit_guard();

create function public.neylo_qualify_referral(p_referral_id uuid) returns void
language plpgsql security definer set search_path = '''' as $$
declare v_ref public.referrals; v_inviter public.enrollments; v_invitee public.enrollments; v_slot integer; begin
  perform 1 from public.campaign_state where id=''founding'' for update;
  select * into strict v_ref from public.referrals where id=p_referral_id for update;
  if v_ref.status in (''credited'',''ineligible'') then return; end if;
  select * into strict v_inviter from public.enrollments where user_id=v_ref.inviter_id for update;
  select * into strict v_invitee from public.enrollments where user_id=v_ref.invitee_id;
  if v_invitee.eligibility=''excluded'' or v_inviter.founder_ordinal is null or exists(
    select 1 from public.credit_entries r join public.credit_entries c on c.id=r.reversal_of where c.beneficiary_id=v_ref.inviter_id and c.source_type=''welcome''
  ) then update public.referrals set status=''ineligible'',reason_code=''not_eligible'' where id=p_referral_id; return; end if;
  if v_invitee.eligibility=''review_required'' or exists(select 1 from public.profiles where user_id in (v_ref.inviter_id,v_ref.invitee_id) and review_required) then
    update public.referrals set status=''review_required'',reason_code=''eligibility_review'' where id=p_referral_id; return;
  end if;
  update public.referrals set status=''qualified'',qualified_at=coalesce(qualified_at,now()) where id=p_referral_id;
  insert into public.analytics_events(user_id,provenance,event_name,domain_key) values(v_ref.invitee_id,''server'',''referral_qualified'',''qualified:''||v_ref.id) on conflict(domain_key) do nothing;
  if v_inviter.referral_slots_consumed>=3 then update public.referrals set reason_code=''reward_cap_reached'' where id=p_referral_id; return; end if;
  update public.enrollments set referral_slots_consumed=referral_slots_consumed+1 where user_id=v_ref.inviter_id returning referral_slots_consumed into v_slot;
  update public.referrals set status=''credited'',reason_code=null,reward_slot=v_slot,credited_at=now() where id=p_referral_id;
  insert into public.credit_entries(beneficiary_id,terms_version,amount_minor,source_type,source_key,referral_id)
    values(v_ref.inviter_id,v_inviter.terms_version,5000,''referral'',''referral:''||v_ref.id,v_ref.id);
  insert into public.analytics_events(user_id,provenance,event_name,domain_key) values(v_ref.inviter_id,''server'',''referral_credit_reserved'',''referral-credit:''||v_ref.id);
end; $$;

create function public.neylo_finalize(p_user_id uuid,p_token_hash text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '''' as $$
declare
  v_state public.campaign_state; v_pending public.pending_signups; v_email text; v_verified timestamptz;
  v_ordinal integer; v_eligibility text; v_ref uuid; v_terms public.campaign_versions; v_outcome jsonb; v_request_hash text;
begin
  if length(p_idempotency_key) not between 8 and 100 then raise exception ''INVALID_IDEMPOTENCY_KEY''; end if;
  -- Global campaign lock is always first: hold, finalize, review, reversal, pause.
  select * into strict v_state from public.campaign_state where id=''founding'' for update;
  select email,email_confirmed_at into v_email,v_verified from auth.users where id=p_user_id;
  if v_email is null or v_verified is null then raise exception ''VERIFIED_IDENTITY_REQUIRED''; end if;
  select * into v_pending from public.pending_signups where token_hash=p_token_hash for update;
  if v_pending.id is null or v_pending.email<>lower(v_email) then raise exception ''PENDING_IDENTITY_MISMATCH''; end if;
  if v_pending.finalized_user_id is not null and v_pending.finalized_user_id<>p_user_id then raise exception ''PENDING_IDENTITY_MISMATCH''; end if;
  v_request_hash := encode(extensions.digest(p_token_hash,''sha256''),''hex'');
  if exists(select 1 from public.idempotency_records where actor_key=p_user_id::text and operation=''finalize'' and key=p_idempotency_key and request_hash<>v_request_hash) then raise exception ''IDEMPOTENCY_CONFLICT''; end if;
  -- Domain identity wins over arbitrary new HTTP idempotency keys. No re-enrollment or attribution changes.
  if exists(select 1 from public.profiles where user_id=p_user_id) then return public.neylo_account(p_user_id); end if;
  if v_state.paused then raise exception ''CAMPAIGN_PAUSED''; end if;
  select * into strict v_terms from public.campaign_versions where id=v_pending.terms_version;
  if v_terms.published_at is null or v_terms.starts_at>now() or v_terms.ends_at<=now() then raise exception ''CAMPAIGN_CLOSED''; end if;
  if v_pending.expires_at<=now() then raise exception ''HOLD_EXPIRED''; end if;
  perform 1 from public.handle_registry where handle=v_pending.handle and attempt_id=v_pending.id and user_id is null and expires_at>now() for update;
  if not found then raise exception ''HOLD_EXPIRED''; end if;
  if v_pending.inviter_id=p_user_id then raise exception ''SELF_REFERRAL''; end if;
  v_eligibility := case when v_pending.cohort in (''test'',''staff'',''compensated'') then ''excluded'' when v_pending.review_required then ''review_required'' else ''eligible'' end;
  if v_eligibility=''eligible'' and v_state.allocated_founders<100 then
    update public.campaign_state set allocated_founders=allocated_founders+1,updated_at=now() where id=''founding'' returning allocated_founders into v_ordinal;
  end if;
  insert into public.profiles(user_id,handle,verified_at,cohort,review_required,source,campaign_tag)
    values(p_user_id,v_pending.handle,v_verified,v_pending.cohort,v_pending.review_required,v_pending.source,v_pending.campaign_tag);
  update public.handle_registry set user_id=p_user_id,expires_at=null where handle=v_pending.handle and attempt_id=v_pending.id;
  insert into public.enrollments(user_id,terms_version,accepted_at,eligibility,founder_ordinal)
    values(p_user_id,v_pending.terms_version,v_pending.accepted_at,v_eligibility,v_ordinal);
  insert into public.invitation_codes(user_id) values(p_user_id);
  if v_ordinal is not null then
    insert into public.credit_entries(beneficiary_id,terms_version,amount_minor,source_type,source_key)
      values(p_user_id,v_pending.terms_version,10000,''welcome'',''welcome:''||p_user_id);
    insert into public.analytics_events(user_id,provenance,event_name,domain_key) values(p_user_id,''server'',''welcome_credit_reserved'',''welcome:''||p_user_id);
  end if;
  if v_pending.inviter_id is not null then
    insert into public.referrals(inviter_id,invitee_id,terms_version)
      select v_pending.inviter_id,p_user_id,terms_version from public.enrollments where user_id=v_pending.inviter_id returning id into v_ref;
    perform public.neylo_qualify_referral(v_ref);
  end if;
  update public.pending_signups set finalized_user_id=p_user_id,finalized_at=now() where id=v_pending.id;
  insert into public.analytics_events(user_id,provenance,event_name,domain_key) values(p_user_id,''server'',''account_finalized'',''account:''||p_user_id);
  v_outcome := public.neylo_account(p_user_id);
  insert into public.idempotency_records(actor_key,operation,key,request_hash,outcome) values(p_user_id::text,''finalize'',p_idempotency_key,v_request_hash,v_outcome);
  return v_outcome;
end; $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=''public'' and p.proname like ''neylo_%'' loop
    execute format(''revoke all on function %s from public, anon, authenticated'',f.signature);
    execute format(''grant execute on function %s to service_role'',f.signature);
  end loop;
end $$;
']);

-- 202609120003_account_admin.sql
create function public.neylo_require_admin(p_actor uuid,p_operator boolean default false) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; begin
  select m.role into v_role from public.admin_memberships m join auth.users u on u.id=m.user_id
    where m.user_id=p_actor and u.email_confirmed_at is not null;
  if v_role is null or (p_operator and v_role<>'operator') then raise exception 'FORBIDDEN'; end if;
  return v_role;
end; $$;

create function public.neylo_preferences(p_user_id uuid,p_analytics boolean,p_marketing boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set analytics_consent=p_analytics,marketing_consent=p_marketing,consent_updated_at=now() where user_id=p_user_id;
  if not found then raise exception 'ACCOUNT_REQUIRED'; end if;
end; $$;

create function public.neylo_qualification(p_user_id uuid,p_pilot boolean,p_use_case text,p_need text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.qualification_answers(user_id,pilot_interest,recent_use_case,upcoming_need)
  values(p_user_id,p_pilot,p_use_case,p_need) on conflict(user_id) do update set
    pilot_interest=excluded.pilot_interest,recent_use_case=excluded.recent_use_case,upcoming_need=excluded.upcoming_need,updated_at=now();
  if p_pilot then
    insert into public.analytics_events(user_id,provenance,event_name,domain_key)
      values(p_user_id,'server','pilot_interest_recorded','pilot:'||p_user_id) on conflict(domain_key) do nothing;
  end if;
end; $$;

create function public.neylo_request_deletion(p_user_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_status text; begin
  insert into public.deletion_requests(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select status into v_status from public.deletion_requests where user_id=p_user_id;
  return v_status;
end; $$;

create function public.neylo_client_event(p_user_id uuid,p_session_hash text,p_name text,p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_name <> all(array['landing_view','signup_started','demo_started','demo_completed','share_attempted','invite_link_copied','referral_page_interaction'])
    or length(p_key)>100 or p_session_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_EVENT'; end if;
  if p_user_id is not null and not exists(select 1 from public.profiles where user_id=p_user_id and analytics_consent) then raise exception 'CONSENT_REQUIRED'; end if;
  insert into public.analytics_events(user_id,session_hash,provenance,event_name,domain_key)
    values(p_user_id,p_session_hash,'client',p_name,'client:'||p_session_hash||':'||p_name||':'||p_key) on conflict(domain_key) do nothing;
end; $$;

create function public.neylo_metrics(p_actor uuid,p_from timestamptz,p_to timestamptz,p_cohort text default 'participants') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb; begin
  perform public.neylo_require_admin(p_actor);
  if p_from>=p_to or p_cohort<>all(array['participants','independent','founder_assisted','staff','test','compensated','all']) then raise exception 'INVALID_FILTER'; end if;
  with selected as (
    select p.* from public.profiles p join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null
    where p.completed_at>=p_from and p.completed_at<p_to and
      (p_cohort='all' or (p_cohort='participants' and p.cohort in ('independent','founder_assisted')) or p.cohort::text=p_cohort)
  ), selected_attempts as (
    select a.* from public.pending_signups a where a.created_at>=p_from and a.created_at<p_to and a.finalized_user_id is null and
      (p_cohort='all' or (p_cohort='participants' and a.cohort in ('independent','founder_assisted')) or a.cohort::text=p_cohort)
  ), ledger as (
    select c.* from public.credit_entries c join selected p on p.user_id=c.beneficiary_id
  ), grouped as (
    select source,count(*) as accounts from selected group by source
  ), cohorts as (
    select cohort::text,count(*) as accounts from public.profiles p join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null
    where p.completed_at>=p_from and p.completed_at<p_to group by cohort
  )
  select jsonb_build_object(
    'asOf',now(),'from',p_from,'to',p_to,'cohort',p_cohort,
    'verifiedCompleted',(select count(*) from selected),
    'lifetimeVerified',(select count(*) from public.profiles p join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null),
    'finalizedHandles',(select count(*) from public.handle_registry h join selected p on p.user_id=h.user_id),
    'foundingAccounts',(select count(*) from public.enrollments e join selected p on p.user_id=e.user_id where e.founder_ordinal is not null),
    'qualifiedReferrals',(select count(*) from public.referrals r join selected p on p.user_id=r.invitee_id where r.qualified_at is not null),
    'creditedReferrals',(select count(*) from public.referrals r join selected p on p.user_id=r.invitee_id where r.credited_at is not null),
    'pendingAttempts',(select count(*) from selected_attempts),
    'activeHolds',(select count(*) from selected_attempts where expires_at>now()),
    'reviewRequired',(select count(*) from selected where review_required),
    'pilotInterest',(select count(*) from public.qualification_answers q join selected p on p.user_id=q.user_id where q.pilot_interest),
    'reservedMinor',coalesce((select sum(amount_minor) from ledger),0),
    'grantedMinor',coalesce((select sum(amount_minor) from ledger where amount_minor>0),0),
    'reversedMinor',coalesce((select -sum(amount_minor) from ledger where amount_minor<0),0),
    'configuredCeilingMinor',2500000,
    'remainingFounders',(select 100-allocated_founders from public.campaign_state where id='founding'),
    'paused',(select paused from public.campaign_state where id='founding'),
    'sources',coalesce((select jsonb_agg(jsonb_build_object('source',source,'accounts',accounts)) from grouped),'[]'::jsonb),
    'cohorts',coalesce((select jsonb_agg(jsonb_build_object('cohort',cohort,'accounts',accounts)) from cohorts),'[]'::jsonb),
    'demoCompletions',(select count(distinct a.session_hash) from public.analytics_events a join selected p on p.user_id=a.user_id where a.provenance='client' and a.event_name='demo_completed' and a.created_at>=p_from and a.created_at<p_to),
    'recentEvents',coalesce((select jsonb_agg(row_to_json(t)) from (select a.event_name as name,a.created_at as at from public.analytics_events a join selected p on p.user_id=a.user_id where a.provenance='server' order by a.created_at desc limit 12) t),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

create function public.neylo_review_queue(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.neylo_require_admin(p_actor,true);
  return jsonb_build_object(
    'reviews',coalesce((select jsonb_agg(row_to_json(t)) from (select user_id,handle,cohort,completed_at from public.profiles where review_required order by completed_at limit 100) t),'[]'::jsonb),
    'deletions',coalesce((select jsonb_agg(row_to_json(t)) from (select d.user_id,p.handle,d.requested_at,d.status from public.deletion_requests d join public.profiles p on p.user_id=d.user_id where d.status<>'completed' order by d.requested_at limit 100) t),'[]'::jsonb)
  );
end; $$;

create function public.neylo_review(p_actor uuid,p_user_id uuid,p_decision text,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_ref record; v_status text; begin
  perform public.neylo_require_admin(p_actor,true);
  if p_decision<>all(array['eligible','excluded']) or length(p_reason) not between 3 and 1000 then raise exception 'INVALID_REVIEW'; end if;
  perform 1 from public.campaign_state where id='founding' for update;
  select eligibility into v_status from public.enrollments where user_id=p_user_id for update;
  if v_status<>'review_required' then raise exception 'NOT_PENDING_REVIEW'; end if;
  update public.enrollments set eligibility=p_decision where user_id=p_user_id;
  update public.profiles set review_required=false where user_id=p_user_id;
  -- Review cannot retroactively seize a first-100 place or mint a discretionary welcome grant.
  for v_ref in select id from public.referrals where invitee_id=p_user_id or inviter_id=p_user_id order by id loop
    perform public.neylo_qualify_referral(v_ref.id);
  end loop;
  insert into public.admin_audit_log(actor_id,action,target_id,reason,details) values(p_actor,'review',p_user_id::text,p_reason,jsonb_build_object('decision',p_decision));
end; $$;

create function public.neylo_reverse(p_actor uuid,p_entry_id uuid,p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_entry public.credit_entries; v_id uuid; begin
  perform public.neylo_require_admin(p_actor,true);
  if length(p_reason) not between 3 and 1000 then raise exception 'REASON_REQUIRED'; end if;
  perform 1 from public.campaign_state where id='founding' for update;
  select * into strict v_entry from public.credit_entries where id=p_entry_id;
  if v_entry.source_type='reversal' then raise exception 'INVALID_REVERSAL'; end if;
  select id into v_id from public.credit_entries where reversal_of=p_entry_id;
  if v_id is not null then return v_id; end if;
  insert into public.credit_entries(beneficiary_id,terms_version,amount_minor,source_type,source_key,reversal_of,reason)
    values(v_entry.beneficiary_id,v_entry.terms_version,-v_entry.amount_minor,'reversal','reversal:'||p_entry_id,p_entry_id,p_reason) returning id into v_id;
  insert into public.admin_audit_log(actor_id,action,target_id,reason) values(p_actor,'credit_reversal',p_entry_id::text,p_reason);
  insert into public.analytics_events(user_id,provenance,event_name,domain_key) values(v_entry.beneficiary_id,'server','credit_reversed','reversal:'||p_entry_id);
  return v_id;
end; $$;

create function public.neylo_pause(p_actor uuid,p_paused boolean,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.neylo_require_admin(p_actor,true);
  if length(p_reason) not between 3 and 1000 then raise exception 'REASON_REQUIRED'; end if;
  perform 1 from public.campaign_state where id='founding' for update;
  if not p_paused and not exists(select 1 from public.campaign_state s join public.campaign_versions v on v.id=s.active_version where v.published_at is not null) then raise exception 'TERMS_NOT_PUBLISHED'; end if;
  update public.campaign_state set paused=p_paused,updated_at=now() where id='founding';
  insert into public.admin_audit_log(actor_id,action,target_id,reason,details) values(p_actor,'campaign_pause','founding',p_reason,jsonb_build_object('paused',p_paused));
end; $$;

create function public.neylo_classify(p_actor uuid,p_user_id uuid,p_cohort public.participant_cohort,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.neylo_require_admin(p_actor,true);
  if length(p_reason) not between 3 and 1000 then raise exception 'REASON_REQUIRED'; end if;
  update public.profiles set cohort=p_cohort where user_id=p_user_id;
  if not found then raise exception 'ACCOUNT_REQUIRED'; end if;
  insert into public.admin_audit_log(actor_id,action,target_id,reason,details) values(p_actor,'cohort_classification',p_user_id::text,p_reason,jsonb_build_object('cohort',p_cohort));
end; $$;

create function public.neylo_process_deletion(p_actor uuid,p_user_id uuid,p_status text,p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.neylo_require_admin(p_actor,true);
  if p_status<>all(array['processing','retention_required']) or length(p_note) not between 3 and 1000 then raise exception 'INVALID_DELETION_STATUS'; end if;
  -- "Completed" is deliberately not a UI shortcut. Actual erasure requires the documented operator procedure.
  update public.deletion_requests set status=p_status,operator_note=p_note,updated_at=now() where user_id=p_user_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id,action,target_id,reason,details) values(p_actor,'deletion_processing',p_user_id::text,p_note,jsonb_build_object('status',p_status));
end; $$;

create function public.neylo_reconcile(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.neylo_require_admin(p_actor,true);
  return jsonb_build_object(
    'counterMatches',(select allocated_founders=(select count(*) from public.enrollments where founder_ordinal is not null) from public.campaign_state where id='founding'),
    'welcomeMatches',not exists(select 1 from public.enrollments e where (e.founder_ordinal is not null) <> exists(select 1 from public.credit_entries c where c.beneficiary_id=e.user_id and c.source_type='welcome')),
    'referralSlotsMatch',not exists(select 1 from public.enrollments e where e.referral_slots_consumed<>(select count(*) from public.referrals r where r.inviter_id=e.user_id and r.reward_slot is not null)),
    'referralLedgerMatches',not exists(select 1 from public.referrals r where (r.reward_slot is not null) <> exists(select 1 from public.credit_entries c where c.referral_id=r.id)),
    'balanceBounds',not exists(select 1 from public.credit_entries group by beneficiary_id having sum(amount_minor)<0 or sum(amount_minor)>25000)
  );
end; $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'neylo_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202609120003','account_admin',array['create function public.neylo_require_admin(p_actor uuid,p_operator boolean default false) returns text
language plpgsql stable security definer set search_path = '''' as $$
declare v_role text; begin
  select m.role into v_role from public.admin_memberships m join auth.users u on u.id=m.user_id
    where m.user_id=p_actor and u.email_confirmed_at is not null;
  if v_role is null or (p_operator and v_role<>''operator'') then raise exception ''FORBIDDEN''; end if;
  return v_role;
end; $$;

create function public.neylo_preferences(p_user_id uuid,p_analytics boolean,p_marketing boolean) returns void
language plpgsql security definer set search_path = '''' as $$
begin
  update public.profiles set analytics_consent=p_analytics,marketing_consent=p_marketing,consent_updated_at=now() where user_id=p_user_id;
  if not found then raise exception ''ACCOUNT_REQUIRED''; end if;
end; $$;

create function public.neylo_qualification(p_user_id uuid,p_pilot boolean,p_use_case text,p_need text) returns void
language plpgsql security definer set search_path = '''' as $$
begin
  insert into public.qualification_answers(user_id,pilot_interest,recent_use_case,upcoming_need)
  values(p_user_id,p_pilot,p_use_case,p_need) on conflict(user_id) do update set
    pilot_interest=excluded.pilot_interest,recent_use_case=excluded.recent_use_case,upcoming_need=excluded.upcoming_need,updated_at=now();
  if p_pilot then
    insert into public.analytics_events(user_id,provenance,event_name,domain_key)
      values(p_user_id,''server'',''pilot_interest_recorded'',''pilot:''||p_user_id) on conflict(domain_key) do nothing;
  end if;
end; $$;

create function public.neylo_request_deletion(p_user_id uuid) returns text
language plpgsql security definer set search_path = '''' as $$
declare v_status text; begin
  insert into public.deletion_requests(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select status into v_status from public.deletion_requests where user_id=p_user_id;
  return v_status;
end; $$;

create function public.neylo_client_event(p_user_id uuid,p_session_hash text,p_name text,p_key text) returns void
language plpgsql security definer set search_path = '''' as $$
begin
  if p_name <> all(array[''landing_view'',''signup_started'',''demo_started'',''demo_completed'',''share_attempted'',''invite_link_copied'',''referral_page_interaction''])
    or length(p_key)>100 or p_session_hash !~ ''^[a-f0-9]{64}$'' then raise exception ''INVALID_EVENT''; end if;
  if p_user_id is not null and not exists(select 1 from public.profiles where user_id=p_user_id and analytics_consent) then raise exception ''CONSENT_REQUIRED''; end if;
  insert into public.analytics_events(user_id,session_hash,provenance,event_name,domain_key)
    values(p_user_id,p_session_hash,''client'',p_name,''client:''||p_session_hash||'':''||p_name||'':''||p_key) on conflict(domain_key) do nothing;
end; $$;

create function public.neylo_metrics(p_actor uuid,p_from timestamptz,p_to timestamptz,p_cohort text default ''participants'') returns jsonb
language plpgsql stable security definer set search_path = '''' as $$
declare v_result jsonb; begin
  perform public.neylo_require_admin(p_actor);
  if p_from>=p_to or p_cohort<>all(array[''participants'',''independent'',''founder_assisted'',''staff'',''test'',''compensated'',''all'']) then raise exception ''INVALID_FILTER''; end if;
  with selected as (
    select p.* from public.profiles p join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null
    where p.completed_at>=p_from and p.completed_at<p_to and
      (p_cohort=''all'' or (p_cohort=''participants'' and p.cohort in (''independent'',''founder_assisted'')) or p.cohort::text=p_cohort)
  ), selected_attempts as (
    select a.* from public.pending_signups a where a.created_at>=p_from and a.created_at<p_to and a.finalized_user_id is null and
      (p_cohort=''all'' or (p_cohort=''participants'' and a.cohort in (''independent'',''founder_assisted'')) or a.cohort::text=p_cohort)
  ), ledger as (
    select c.* from public.credit_entries c join selected p on p.user_id=c.beneficiary_id
  ), grouped as (
    select source,count(*) as accounts from selected group by source
  ), cohorts as (
    select cohort::text,count(*) as accounts from public.profiles p join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null
    where p.completed_at>=p_from and p.completed_at<p_to group by cohort
  )
  select jsonb_build_object(
    ''asOf'',now(),''from'',p_from,''to'',p_to,''cohort'',p_cohort,
    ''verifiedCompleted'',(select count(*) from selected),
    ''lifetimeVerified'',(select count(*) from public.profiles p join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null),
    ''finalizedHandles'',(select count(*) from public.handle_registry h join selected p on p.user_id=h.user_id),
    ''foundingAccounts'',(select count(*) from public.enrollments e join selected p on p.user_id=e.user_id where e.founder_ordinal is not null),
    ''qualifiedReferrals'',(select count(*) from public.referrals r join selected p on p.user_id=r.invitee_id where r.qualified_at is not null),
    ''creditedReferrals'',(select count(*) from public.referrals r join selected p on p.user_id=r.invitee_id where r.credited_at is not null),
    ''pendingAttempts'',(select count(*) from selected_attempts),
    ''activeHolds'',(select count(*) from selected_attempts where expires_at>now()),
    ''reviewRequired'',(select count(*) from selected where review_required),
    ''pilotInterest'',(select count(*) from public.qualification_answers q join selected p on p.user_id=q.user_id where q.pilot_interest),
    ''reservedMinor'',coalesce((select sum(amount_minor) from ledger),0),
    ''grantedMinor'',coalesce((select sum(amount_minor) from ledger where amount_minor>0),0),
    ''reversedMinor'',coalesce((select -sum(amount_minor) from ledger where amount_minor<0),0),
    ''configuredCeilingMinor'',2500000,
    ''remainingFounders'',(select 100-allocated_founders from public.campaign_state where id=''founding''),
    ''paused'',(select paused from public.campaign_state where id=''founding''),
    ''sources'',coalesce((select jsonb_agg(jsonb_build_object(''source'',source,''accounts'',accounts)) from grouped),''[]''::jsonb),
    ''cohorts'',coalesce((select jsonb_agg(jsonb_build_object(''cohort'',cohort,''accounts'',accounts)) from cohorts),''[]''::jsonb),
    ''demoCompletions'',(select count(distinct a.session_hash) from public.analytics_events a join selected p on p.user_id=a.user_id where a.provenance=''client'' and a.event_name=''demo_completed'' and a.created_at>=p_from and a.created_at<p_to),
    ''recentEvents'',coalesce((select jsonb_agg(row_to_json(t)) from (select a.event_name as name,a.created_at as at from public.analytics_events a join selected p on p.user_id=a.user_id where a.provenance=''server'' order by a.created_at desc limit 12) t),''[]''::jsonb)
  ) into v_result;
  return v_result;
end; $$;

create function public.neylo_review_queue(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '''' as $$
begin
  perform public.neylo_require_admin(p_actor,true);
  return jsonb_build_object(
    ''reviews'',coalesce((select jsonb_agg(row_to_json(t)) from (select user_id,handle,cohort,completed_at from public.profiles where review_required order by completed_at limit 100) t),''[]''::jsonb),
    ''deletions'',coalesce((select jsonb_agg(row_to_json(t)) from (select d.user_id,p.handle,d.requested_at,d.status from public.deletion_requests d join public.profiles p on p.user_id=d.user_id where d.status<>''completed'' order by d.requested_at limit 100) t),''[]''::jsonb)
  );
end; $$;

create function public.neylo_review(p_actor uuid,p_user_id uuid,p_decision text,p_reason text) returns void
language plpgsql security definer set search_path = '''' as $$
declare v_ref record; v_status text; begin
  perform public.neylo_require_admin(p_actor,true);
  if p_decision<>all(array[''eligible'',''excluded'']) or length(p_reason) not between 3 and 1000 then raise exception ''INVALID_REVIEW''; end if;
  perform 1 from public.campaign_state where id=''founding'' for update;
  select eligibility into v_status from public.enrollments where user_id=p_user_id for update;
  if v_status<>''review_required'' then raise exception ''NOT_PENDING_REVIEW''; end if;
  update public.enrollments set eligibility=p_decision where user_id=p_user_id;
  update public.profiles set review_required=false where user_id=p_user_id;
  -- Review cannot retroactively seize a first-100 place or mint a discretionary welcome grant.
  for v_ref in select id from public.referrals where invitee_id=p_user_id or inviter_id=p_user_id order by id loop
    perform public.neylo_qualify_referral(v_ref.id);
  end loop;
  insert into public.admin_audit_log(actor_id,action,target_id,reason,details) values(p_actor,''review'',p_user_id::text,p_reason,jsonb_build_object(''decision'',p_decision));
end; $$;

create function public.neylo_reverse(p_actor uuid,p_entry_id uuid,p_reason text) returns uuid
language plpgsql security definer set search_path = '''' as $$
declare v_entry public.credit_entries; v_id uuid; begin
  perform public.neylo_require_admin(p_actor,true);
  if length(p_reason) not between 3 and 1000 then raise exception ''REASON_REQUIRED''; end if;
  perform 1 from public.campaign_state where id=''founding'' for update;
  select * into strict v_entry from public.credit_entries where id=p_entry_id;
  if v_entry.source_type=''reversal'' then raise exception ''INVALID_REVERSAL''; end if;
  select id into v_id from public.credit_entries where reversal_of=p_entry_id;
  if v_id is not null then return v_id; end if;
  insert into public.credit_entries(beneficiary_id,terms_version,amount_minor,source_type,source_key,reversal_of,reason)
    values(v_entry.beneficiary_id,v_entry.terms_version,-v_entry.amount_minor,''reversal'',''reversal:''||p_entry_id,p_entry_id,p_reason) returning id into v_id;
  insert into public.admin_audit_log(actor_id,action,target_id,reason) values(p_actor,''credit_reversal'',p_entry_id::text,p_reason);
  insert into public.analytics_events(user_id,provenance,event_name,domain_key) values(v_entry.beneficiary_id,''server'',''credit_reversed'',''reversal:''||p_entry_id);
  return v_id;
end; $$;

create function public.neylo_pause(p_actor uuid,p_paused boolean,p_reason text) returns void
language plpgsql security definer set search_path = '''' as $$
begin
  perform public.neylo_require_admin(p_actor,true);
  if length(p_reason) not between 3 and 1000 then raise exception ''REASON_REQUIRED''; end if;
  perform 1 from public.campaign_state where id=''founding'' for update;
  if not p_paused and not exists(select 1 from public.campaign_state s join public.campaign_versions v on v.id=s.active_version where v.published_at is not null) then raise exception ''TERMS_NOT_PUBLISHED''; end if;
  update public.campaign_state set paused=p_paused,updated_at=now() where id=''founding'';
  insert into public.admin_audit_log(actor_id,action,target_id,reason,details) values(p_actor,''campaign_pause'',''founding'',p_reason,jsonb_build_object(''paused'',p_paused));
end; $$;

create function public.neylo_classify(p_actor uuid,p_user_id uuid,p_cohort public.participant_cohort,p_reason text) returns void
language plpgsql security definer set search_path = '''' as $$
begin
  perform public.neylo_require_admin(p_actor,true);
  if length(p_reason) not between 3 and 1000 then raise exception ''REASON_REQUIRED''; end if;
  update public.profiles set cohort=p_cohort where user_id=p_user_id;
  if not found then raise exception ''ACCOUNT_REQUIRED''; end if;
  insert into public.admin_audit_log(actor_id,action,target_id,reason,details) values(p_actor,''cohort_classification'',p_user_id::text,p_reason,jsonb_build_object(''cohort'',p_cohort));
end; $$;

create function public.neylo_process_deletion(p_actor uuid,p_user_id uuid,p_status text,p_note text) returns void
language plpgsql security definer set search_path = '''' as $$
begin
  perform public.neylo_require_admin(p_actor,true);
  if p_status<>all(array[''processing'',''retention_required'']) or length(p_note) not between 3 and 1000 then raise exception ''INVALID_DELETION_STATUS''; end if;
  -- "Completed" is deliberately not a UI shortcut. Actual erasure requires the documented operator procedure.
  update public.deletion_requests set status=p_status,operator_note=p_note,updated_at=now() where user_id=p_user_id;
  if not found then raise exception ''REQUEST_NOT_FOUND''; end if;
  insert into public.admin_audit_log(actor_id,action,target_id,reason,details) values(p_actor,''deletion_processing'',p_user_id::text,p_note,jsonb_build_object(''status'',p_status));
end; $$;

create function public.neylo_reconcile(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '''' as $$
begin
  perform public.neylo_require_admin(p_actor,true);
  return jsonb_build_object(
    ''counterMatches'',(select allocated_founders=(select count(*) from public.enrollments where founder_ordinal is not null) from public.campaign_state where id=''founding''),
    ''welcomeMatches'',not exists(select 1 from public.enrollments e where (e.founder_ordinal is not null) <> exists(select 1 from public.credit_entries c where c.beneficiary_id=e.user_id and c.source_type=''welcome'')),
    ''referralSlotsMatch'',not exists(select 1 from public.enrollments e where e.referral_slots_consumed<>(select count(*) from public.referrals r where r.inviter_id=e.user_id and r.reward_slot is not null)),
    ''referralLedgerMatches'',not exists(select 1 from public.referrals r where (r.reward_slot is not null) <> exists(select 1 from public.credit_entries c where c.referral_id=r.id)),
    ''balanceBounds'',not exists(select 1 from public.credit_entries group by beneficiary_id having sum(amount_minor)<0 or sum(amount_minor)>25000)
  );
end; $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=''public'' and p.proname like ''neylo_%'' loop
    execute format(''revoke all on function %s from public, anon, authenticated'',f.signature);
    execute format(''grant execute on function %s to service_role'',f.signature);
  end loop;
end $$;
']);

-- 202609120004_owner_bootstrap.sql
-- This service-only function never creates an identity and never trusts editable user metadata.
create function public.neylo_bootstrap_owner(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; begin
  if p_email <> 'kerim@horalix.com' then raise exception 'OWNER_EMAIL_MISMATCH'; end if;
  select id into strict v_user from auth.users where lower(email)=p_email and email_confirmed_at is not null;
  insert into public.admin_memberships(user_id,role) values(v_user,'operator') on conflict(user_id) do nothing;
  if found then
    insert into public.admin_audit_log(actor_id,action,target_id,reason) values(v_user,'owner_bootstrap',v_user::text,'Explicit owner email supplied by the project operator');
  end if;
  return v_user;
end; $$;
revoke all on function public.neylo_bootstrap_owner(text) from public,anon,authenticated;
grant execute on function public.neylo_bootstrap_owner(text) to service_role;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202609120004','owner_bootstrap',array['-- This service-only function never creates an identity and never trusts editable user metadata.
create function public.neylo_bootstrap_owner(p_email text) returns uuid
language plpgsql security definer set search_path = '''' as $$
declare v_user uuid; begin
  if p_email <> ''kerim@horalix.com'' then raise exception ''OWNER_EMAIL_MISMATCH''; end if;
  select id into strict v_user from auth.users where lower(email)=p_email and email_confirmed_at is not null;
  insert into public.admin_memberships(user_id,role) values(v_user,''operator'') on conflict(user_id) do nothing;
  if found then
    insert into public.admin_audit_log(actor_id,action,target_id,reason) values(v_user,''owner_bootstrap'',v_user::text,''Explicit owner email supplied by the project operator'');
  end if;
  return v_user;
end; $$;
revoke all on function public.neylo_bootstrap_owner(text) from public,anon,authenticated;
grant execute on function public.neylo_bootstrap_owner(text) to service_role;
']);

-- 202609120005_invitation_eligibility.sql
-- Public invitation copy must agree with the account and grant decision after a reversal.
create or replace function public.neylo_invitation(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('handle',p.handle,'code',i.code,'mayEarn',
    e.founder_ordinal is not null and e.referral_slots_consumed<3 and not p.review_required
    and e.eligibility='eligible' and p.cohort in ('independent','founder_assisted')
    and not exists(select 1 from public.credit_entries reversal
      join public.credit_entries original on original.id=reversal.reversal_of
      where original.beneficiary_id=p.user_id and original.source_type='welcome'))
  from public.invitation_codes i join public.profiles p on p.user_id=i.user_id
  join public.enrollments e on e.user_id=p.user_id where i.code=p_code;
$$;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202609120005','invitation_eligibility',array['-- Public invitation copy must agree with the account and grant decision after a reversal.
create or replace function public.neylo_invitation(p_code text) returns jsonb
language sql stable security definer set search_path = '''' as $$
  select jsonb_build_object(''handle'',p.handle,''code'',i.code,''mayEarn'',
    e.founder_ordinal is not null and e.referral_slots_consumed<3 and not p.review_required
    and e.eligibility=''eligible'' and p.cohort in (''independent'',''founder_assisted'')
    and not exists(select 1 from public.credit_entries reversal
      join public.credit_entries original on original.id=reversal.reversal_of
      where original.beneficiary_id=p.user_id and original.source_type=''welcome''))
  from public.invitation_codes i join public.profiles p on p.user_id=i.user_id
  join public.enrollments e on e.user_id=p.user_id where i.code=p_code;
$$;
']);

commit;
select count(*) as protected_tables from pg_tables where schemaname='public' and rowsecurity;
