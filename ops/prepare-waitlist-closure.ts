import { writeFile } from 'node:fs/promises';
import { waitlistTerms } from '../src/features/legal/policy';

// The owner explicitly requested ending all new rewards while preserving earned credits.
// Generate a reviewable transaction. Running this script does not contact production.
const literal=(value:string)=>`'${value.replaceAll("'","''")}'`;
await writeFile('ops/end-rewards.sql',`begin;
do $$ declare v_actor uuid; v_count bigint; v_minor bigint; v_fingerprint text; v_founders integer; begin
  perform 1 from public.campaign_state where id='founding' for update;
  if exists(select 1 from public.campaign_state where id='founding' and rewards_ended_at is not null) then return; end if;
  select id into strict v_actor from auth.users where lower(email)='kerim@horalix.com' and email_confirmed_at is not null;
  perform public.neylo_require_admin(v_actor,true);
  select count(*),coalesce(sum(amount_minor),0),md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'[]'))
    into v_count,v_minor,v_fingerprint from public.credit_entries c;
  select allocated_founders into v_founders from public.campaign_state where id='founding';
  insert into public.campaign_versions(id,welcome_minor,referral_minor,referral_cap,founder_cap,terms_body,privacy_body,eligibility_region,minimum_age,starts_at,published_at)
    select 'waitlist-2026-09-13-v1',welcome_minor,referral_minor,referral_cap,founder_cap,${literal(waitlistTerms)},privacy_body,eligibility_region,minimum_age,now(),now()
    from public.campaign_versions where id=(select active_version from public.campaign_state where id='founding');
  update public.campaign_state set rewards_ended_at=now(),active_version='waitlist-2026-09-13-v1',updated_at=now() where id='founding';
  if v_fingerprint<>(select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'[]')) from public.credit_entries c)
    or v_founders<>(select allocated_founders from public.campaign_state where id='founding') then raise exception 'HISTORICAL_ENTITLEMENTS_CHANGED'; end if;
  insert into public.admin_audit_log(actor_id,action,target_id,reason,details)
    values(v_actor,'rewards_ended','founding','Owner requested ending new welcome and referral rewards; preserve all previously earned credits.',
    jsonb_build_object('endedAt',now(),'ledgerEntries',v_count,'reservedMinor',v_minor,'ledgerFingerprint',v_fingerprint,'allocatedFounders',v_founders,'waitlistVersion','waitlist-2026-09-13-v1'));
end; $$;
commit;
`);
console.log('Prepared ops/end-rewards.sql; no remote changes made.');
