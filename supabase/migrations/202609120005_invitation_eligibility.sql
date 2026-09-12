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
