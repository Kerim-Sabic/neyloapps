import 'server-only';
import { z } from 'zod';
import { database,requireUser } from '@/core/supabase';
import { rpcResult,voidResult } from '@/core/rpc';
import { requireRecentAuth,limit } from '@/core/security';
import { metricsSchema,metricsFilterSchema,cohortSchema } from '@/lib/domain';
import { accountsFilterSchema,registeredAccountsSchema } from './accounts-domain';
import { AppError } from '@/lib/errors';
const reason=z.string().min(3).max(1000);

export async function adminRole(){const user=await requireUser();const role=await rpcResult(database().rpc('neylo_require_admin',{p_actor:user.id}),z.enum(['operator','presenter']));return {user,role};}
export async function getRegisteredAccounts(input:unknown){const {user,role}=await adminRole();if(role!=='operator')throw new AppError('FORBIDDEN',403);const f=accountsFilterSchema.parse(input);return rpcResult(database().rpc('neylo_registered_accounts',{p_actor:user.id,p_search:f.search.replace(/^@/,''),p_cohort:f.cohort,p_page:f.page,p_page_size:f.pageSize}),registeredAccountsSchema);}
export async function getMetrics(input:unknown){const {user}=await adminRole();const f=metricsFilterSchema.parse(input);return rpcResult(database().rpc('neylo_metrics',{p_actor:user.id,p_from:f.from,p_to:f.to,p_cohort:f.cohort}),metricsSchema);}
export async function queue(){const {user}=await adminRole();return rpcResult(database().rpc('neylo_review_queue',{p_actor:user.id}),z.unknown());}
export async function reconcile(){const {user}=await adminRole();return rpcResult(database().rpc('neylo_reconcile',{p_actor:user.id}),z.record(z.string(),z.boolean()));}
export async function mutateAdmin(action:string,input:unknown){
  const {user}=await adminRole();await requireRecentAuth(user.id);await limit('admin-mutation',user.id,20,60);
  if(action==='pause'){const d=z.object({paused:z.boolean(),reason}).strict().parse(input);return rpcResult(database().rpc('neylo_pause',{p_actor:user.id,p_paused:d.paused,p_reason:d.reason}),voidResult);}
  if(action==='review'){const d=z.object({userId:z.uuid(),decision:z.enum(['eligible','excluded']),reason}).strict().parse(input);return rpcResult(database().rpc('neylo_review',{p_actor:user.id,p_user_id:d.userId,p_decision:d.decision,p_reason:d.reason}),voidResult);}
  if(action==='reverse'){const d=z.object({entryId:z.uuid(),reason}).strict().parse(input);await rpcResult(database().rpc('neylo_reverse',{p_actor:user.id,p_entry_id:d.entryId,p_reason:d.reason}),z.uuid());return {ok:true};}
  if(action==='classify'){const d=z.object({userId:z.uuid(),cohort:cohortSchema,reason}).strict().parse(input);return rpcResult(database().rpc('neylo_classify',{p_actor:user.id,p_user_id:d.userId,p_cohort:d.cohort,p_reason:d.reason}),voidResult);}
  const d=z.object({userId:z.uuid(),status:z.enum(['processing','retention_required']),reason}).strict().parse(input);
  return rpcResult(database().rpc('neylo_process_deletion',{p_actor:user.id,p_user_id:d.userId,p_status:d.status,p_note:d.reason}),voidResult);
}
