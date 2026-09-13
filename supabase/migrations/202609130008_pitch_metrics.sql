-- Public presentation statistics are an explicit, aggregate-only projection.
-- No account identifiers, emails, handles, event payloads or timestamps per person.
create function public.neylo_pitch_metrics() returns jsonb
language sql stable security definer set search_path = '' as $$
  with participants as (
    select p.user_id,p.cohort,p.source,
      exists(select 1 from public.admin_audit_log a where a.action='account_import' and a.target_id=p.user_id::text) as imported,
      exists(select 1 from public.pending_signups s where s.finalized_user_id=p.user_id) as completed_in_neylo
    from public.profiles p join auth.users u on u.id=p.user_id
    where p.completed_at<=now() and p.verified_at<=now() and u.email_confirmed_at is not null
      and p.cohort in ('independent','founder_assisted')
  )
  select jsonb_build_object(
    'asOf',now(),
    'registered',(select count(*) from participants),
    'neyloVerified',(select count(*) from participants where not imported and completed_in_neylo),
    'imported',(select count(*) from participants where imported),
    'otherVerified',(select count(*) from participants where not imported and not completed_in_neylo),
    'independent',(select count(*) from participants where cohort='independent'),
    'founderAssisted',(select count(*) from participants where cohort='founder_assisted'),
    'founding',(select count(*) from public.enrollments e join participants p on p.user_id=e.user_id where e.founder_ordinal is not null),
    'qualifiedReferrals',(select count(*) from public.referrals r join participants p on p.user_id=r.invitee_id where r.qualified_at is not null),
    'pilotInterest',(select count(*) from public.qualification_answers q join participants p on p.user_id=q.user_id where q.pilot_interest),
    'handles',(select count(*) from public.handle_registry h join participants p on p.user_id=h.user_id),
    'sources',jsonb_build_object(
      'direct',(select count(*) from participants where source='direct'),
      'invitation',(select count(*) from participants where source='invitation'),
      'social',(select count(*) from participants where source='social'),
      'outreach',(select count(*) from participants where source='outreach'),
      'scc',(select count(*) from participants where source='scc')
    )
  );
$$;
revoke all on function public.neylo_pitch_metrics() from public,anon,authenticated;
grant execute on function public.neylo_pitch_metrics() to service_role;
comment on function public.neylo_pitch_metrics() is 'Aggregate-only public pitch projection. Staff/test/compensated and unfinished attempts excluded; import provenance preserved. Service endpoint only.';
