import { createHash } from 'node:crypto';
import { z } from 'zod';
import { handleSchema,emailSchema,sourceSchema } from '../src/lib/domain';

const importSchema=z.object({
  batch:z.string().regex(/^[a-z0-9_]{8,80}$/),actor:z.uuid(),
  rows:z.array(z.object({user_id:z.uuid(),handle:handleSchema,email:emailSchema,completed_at:z.iso.datetime(),
    cohort:z.literal('independent'),source:sourceSchema}).strict()).min(1).max(500),
}).strict();
const literal=(value:string)=>`'${value.replaceAll("'","''")}'`;

/** Produces a reviewable transaction. Authentication identities must first be
 * created through Supabase Admin Auth, using the operator's verification
 * attestation. No email, password, login session or credit grant is created here.
 * Keep the input and generated SQL outside Git: they contain personal data.
 */
export function accountImportSql(input:unknown){
  const data=importSchema.parse(input);
  for(const key of ['user_id','handle','email'] as const){
    if(new Set(data.rows.map(row=>row[key])).size!==data.rows.length)throw new Error(`Duplicate ${key}`);
  }
  if(data.rows.some(row=>Date.parse(row.completed_at)>Date.now()))throw new Error('Completion cannot be in the future');
  const hash=createHash('sha256').update(JSON.stringify(data.rows)).digest('hex');
  return `begin;
do $neylo_import$
declare
  v_actor uuid := ${literal(data.actor)};
  v_batch text := ${literal(data.batch)};
  v_hash text := ${literal(hash)};
  v_rows jsonb := ${literal(JSON.stringify(data.rows))}::jsonb;
  v_prior public.idempotency_records;
  v_row record;
  v_version text;
  v_verified timestamptz;
  v_auth_email text;
  v_count integer := 0;
begin
  perform public.neylo_require_admin(v_actor,true);
  -- The normal completion path takes this same lock. Handle claims and
  -- campaign allocations cannot race this import transaction.
  select active_version into strict v_version from public.campaign_state where id='founding' for update;
  select * into v_prior from public.idempotency_records
    where actor_key=v_actor::text and operation='account_import' and key=v_batch;
  if found then
    if v_prior.request_hash<>v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return;
  end if;
  for v_row in select * from jsonb_to_recordset(v_rows)
    as x(user_id uuid,handle text,email text,completed_at timestamptz,cohort text,source text)
  loop
    select email,email_confirmed_at into v_auth_email,v_verified from auth.users where id=v_row.user_id for share;
    if not found or v_auth_email<>v_row.email or v_verified is null then raise exception 'VERIFIED_IDENTITY_REQUIRED'; end if;
    if v_row.completed_at>now() then raise exception 'FUTURE_COMPLETION'; end if;
    if exists(select 1 from public.profiles where user_id=v_row.user_id or handle=v_row.handle)
      then raise exception 'EXISTING_ACCOUNT_CONFLICT'; end if;
    if exists(select 1 from public.handle_registry where handle=v_row.handle and (user_id is not null or expires_at>now()))
      then raise exception 'HANDLE_UNAVAILABLE'; end if;
    insert into public.profiles(user_id,handle,completed_at,verified_at,cohort,review_required,source,campaign_tag)
      values(v_row.user_id,v_row.handle,v_row.completed_at,v_verified,'independent',true,v_row.source,v_batch);
    insert into public.handle_registry(handle,user_id) values(v_row.handle,v_row.user_id)
      on conflict(handle) do update set user_id=excluded.user_id,attempt_id=null,expires_at=null
      where public.handle_registry.user_id is null and public.handle_registry.expires_at<=now();
    if not found then raise exception 'HANDLE_UNAVAILABLE'; end if;
    insert into public.enrollments(user_id,terms_version,accepted_at,eligibility)
      values(v_row.user_id,v_version,null,'review_required');
    insert into public.invitation_codes(user_id) values(v_row.user_id);
    insert into public.admin_audit_log(actor_id,action,target_id,reason,details)
      values(v_actor,'account_import',v_row.user_id::text,
        'Operator confirms this is a genuine independently acquired participant whose email was previously verified.',
        jsonb_build_object('batch',v_batch,'verificationBasis','operator_attestation',
          'claimedCompletedAt',v_row.completed_at,'authConfirmedAt',v_verified,'source',v_row.source,
          'campaignConsentRecorded',false,'eligibility','review_required',
          'inviterProvided',false,'creditsGranted',0));
    v_count := v_count+1;
  end loop;
  insert into public.idempotency_records(actor_key,operation,key,request_hash,outcome)
    values(v_actor::text,'account_import',v_batch,v_hash,jsonb_build_object('imported',v_count,'creditsGranted',0));
end;
$neylo_import$;
commit;
`;
}
