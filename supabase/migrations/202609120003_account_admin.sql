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
