-- Ending rewards is independent of pausing account enrollment.
-- A single campaign-row lock serializes closure, completion and grants.
alter table public.campaign_state add column rewards_ended_at timestamptz
  check (rewards_ended_at is null or rewards_ended_at <= now());

create function public.neylo_keep_reward_cutoff() returns trigger
language plpgsql set search_path = '' as $$ begin
  if old.rewards_ended_at is not null and new.rewards_ended_at is distinct from old.rewards_ended_at then
    raise exception 'REWARD_CUTOFF_IMMUTABLE';
  end if;
  return new;
end; $$;
create trigger reward_cutoff_immutable before update on public.campaign_state
  for each row execute function public.neylo_keep_reward_cutoff();
revoke all on function public.neylo_keep_reward_cutoff() from public,anon,authenticated;

create or replace function public.neylo_campaign() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version',v.id,'open',not s.paused and v.published_at is not null and v.starts_at <= now() and (v.ends_at is null or v.ends_at > now()),
    'rewardsEndedAt',s.rewards_ended_at,'remaining',case when s.rewards_ended_at is null then 100-s.allocated_founders else 0 end,'region',v.eligibility_region,'minimumAge',v.minimum_age,
    'terms',v.terms_body,'privacy',v.privacy_body,'publishedAt',v.published_at)
  from public.campaign_state s join public.campaign_versions v on v.id=s.active_version where s.id='founding';
$$;
create or replace function public.neylo_hold(p_token_hash text,p_email text,p_handle text,p_terms_version text,p_invitation text,
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
  if p_terms_version is distinct from v_state.active_version then raise exception 'TERMS_CHANGED'; end if;

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
    -- Preserve attribution. An explicit new acceptance can move an unfinished claim to waitlist terms.
    if v_pending.terms_version<>v_state.active_version then
      update public.pending_signups set terms_version=v_state.active_version,accepted_at=now(),offer_displayed=false where id=v_pending.id;
    end if;
    delete from public.handle_registry where attempt_id=v_pending.id and user_id is null;
    update public.pending_signups set handle=p_handle,expires_at=now()+interval '15 minutes' where id=v_pending.id returning * into v_pending;
  end if;
  insert into public.handle_registry(handle,attempt_id,expires_at) values(p_handle,v_pending.id,v_pending.expires_at)
  on conflict(handle) do update set attempt_id=excluded.attempt_id,expires_at=excluded.expires_at
  where public.handle_registry.user_id is null and public.handle_registry.expires_at <= now();
  if not found then raise exception 'HANDLE_UNAVAILABLE'; end if;
  return jsonb_build_object('handle',p_handle,'expiresAt',v_pending.expires_at,'termsVersion',v_pending.terms_version);
end; $$;
create or replace function public.neylo_finalize(p_user_id uuid,p_token_hash text,p_idempotency_key text) returns jsonb
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
  if v_state.rewards_ended_at is not null and v_pending.terms_version<>v_state.active_version then raise exception 'TERMS_CHANGED'; end if;
  select * into strict v_terms from public.campaign_versions where id=v_pending.terms_version;
  if v_terms.published_at is null or v_terms.starts_at>now() or v_terms.ends_at<=now() then raise exception 'CAMPAIGN_CLOSED'; end if;
  if v_pending.expires_at<=now() then raise exception 'HOLD_EXPIRED'; end if;
  perform 1 from public.handle_registry where handle=v_pending.handle and attempt_id=v_pending.id and user_id is null and expires_at>now() for update;
  if not found then raise exception 'HOLD_EXPIRED'; end if;
  if v_pending.inviter_id=p_user_id then raise exception 'SELF_REFERRAL'; end if;
  v_eligibility := case when v_pending.cohort in ('test','staff','compensated') then 'excluded' when v_pending.review_required then 'review_required' else 'eligible' end;
  if v_state.rewards_ended_at is null and v_eligibility='eligible' and v_state.allocated_founders<100 then
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
create or replace function public.neylo_qualify_referral(p_referral_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_ref public.referrals; v_inviter public.enrollments; v_invitee public.enrollments; v_slot integer; begin
  perform 1 from public.campaign_state where id='founding' for update;
  select * into strict v_ref from public.referrals where id=p_referral_id for update;
  if v_ref.status in ('credited','ineligible') then return; end if;
  if exists(select 1 from public.campaign_state where id='founding' and rewards_ended_at is not null) then
    if v_ref.qualified_at is null then update public.referrals set status='ineligible',reason_code='promotion_ended' where id=p_referral_id; end if;
    return;
  end if;
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
create or replace function public.neylo_credit_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v_original public.credit_entries; v_enrollment public.enrollments; v_referral public.referrals; begin
  perform 1 from public.campaign_state where id='founding' for update;
  if new.source_type<>'reversal' and exists(select 1 from public.campaign_state where id='founding' and rewards_ended_at is not null) then raise exception 'REWARDS_ENDED'; end if;
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
create or replace function public.neylo_account(p_user_id uuid) returns jsonb
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
    'rewardsEndedAt',(select rewards_ended_at from public.campaign_state where id='founding'),
    'canInviteForReward',(select rewards_ended_at is null from public.campaign_state where id='founding') and e.founder_ordinal is not null and e.referral_slots_consumed<3 and not p.review_required
      and not exists(select 1 from public.credit_entries c join public.credit_entries original on original.id=c.reversal_of where c.beneficiary_id=p.user_id and original.source_type='welcome'))
  from public.profiles p join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null
  join public.enrollments e on e.user_id=p.user_id join public.invitation_codes i on i.user_id=p.user_id
  left join public.qualification_answers q on q.user_id=p.user_id left join public.deletion_requests d on d.user_id=p.user_id
  where p.user_id=p_user_id;
$$;
create or replace function public.neylo_invitation(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('handle',p.handle,'code',i.code,'mayEarn',
    (select rewards_ended_at is null from public.campaign_state where id='founding') and e.founder_ordinal is not null and e.referral_slots_consumed<3 and not p.review_required
    and e.eligibility='eligible' and p.cohort in ('independent','founder_assisted')
    and not exists(select 1 from public.credit_entries reversal
      join public.credit_entries original on original.id=reversal.reversal_of
      where original.beneficiary_id=p.user_id and original.source_type='welcome'))
  from public.invitation_codes i join public.profiles p on p.user_id=i.user_id
  join public.enrollments e on e.user_id=p.user_id where i.code=p_code;
$$;
create or replace function public.neylo_metrics(p_actor uuid,p_from timestamptz,p_to timestamptz,p_cohort text default 'participants') returns jsonb
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
    'rewardsEndedAt',(select rewards_ended_at from public.campaign_state where id='founding'),
    'remainingFounders',(select case when rewards_ended_at is null then 100-allocated_founders else 0 end from public.campaign_state where id='founding'),
    'paused',(select paused from public.campaign_state where id='founding'),
    'sources',coalesce((select jsonb_agg(jsonb_build_object('source',source,'accounts',accounts)) from grouped),'[]'::jsonb),
    'cohorts',coalesce((select jsonb_agg(jsonb_build_object('cohort',cohort,'accounts',accounts)) from cohorts),'[]'::jsonb),
    'demoCompletions',(select count(distinct a.session_hash) from public.analytics_events a join selected p on p.user_id=a.user_id where a.provenance='client' and a.event_name='demo_completed' and a.created_at>=p_from and a.created_at<p_to),
    'recentEvents',coalesce((select jsonb_agg(row_to_json(t)) from (select a.event_name as name,a.created_at as at from public.analytics_events a join selected p on p.user_id=a.user_id where a.provenance='server' order by a.created_at desc limit 12) t),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

-- Published historical policies remain readable without rewriting accepted terms.
create function public.neylo_policy(p_version text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version',id,'terms',terms_body,'privacy',privacy_body,'publishedAt',published_at)
  from public.campaign_versions where id=p_version and published_at is not null;
$$;
revoke all on function public.neylo_policy(text) from public,anon,authenticated;
grant execute on function public.neylo_policy(text) to service_role;
