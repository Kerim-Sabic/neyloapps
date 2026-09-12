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
