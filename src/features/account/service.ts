import 'server-only';
import { z } from 'zod';
import { database,requireUser } from '@/core/supabase';
import { rpcResult,voidResult } from '@/core/rpc';
import { limit } from '@/core/security';
import { accountSchema,preferencesSchema,qualificationSchema } from '@/lib/domain';
import { AppError } from '@/lib/errors';

export async function accountFor(userId:string){return rpcResult(database().rpc('neylo_account',{p_user_id:userId}),accountSchema.nullable());}
export async function requireAccount(){const user=await requireUser();const account=await accountFor(user.id);if(!account)throw new AppError('ACCOUNT_REQUIRED',409);return {user,account};}
export async function getAccount(){return (await requireAccount()).account;}
export async function preferences(input:unknown){const {user}=await requireAccount();const data=preferencesSchema.parse(input);return rpcResult(database().rpc('neylo_preferences',{p_user_id:user.id,p_analytics:data.analytics,p_marketing:data.marketing}),voidResult);}
export async function qualification(input:unknown){const {user}=await requireAccount();const data=qualificationSchema.parse(input);await limit('qualification',user.id,12,3600);return rpcResult(database().rpc('neylo_qualification',{p_user_id:user.id,p_pilot:data.pilot,p_use_case:data.useCase,p_need:data.need}),voidResult);}
export async function deletion(){const {user}=await requireAccount();await limit('deletion',user.id,3,3600);return {status:await rpcResult(database().rpc('neylo_request_deletion',{p_user_id:user.id}),z.string())};}
