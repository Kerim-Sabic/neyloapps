import 'server-only';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { database,authClient,optionalUser,requireUser } from '@/core/supabase';
import { assertEnrollment } from '@/core/config';
import { hash,sessionToken,pendingHash,limit,markReauthenticated } from '@/core/security';
import { rpcResult,voidResult } from '@/core/rpc';
import { startSchema,pendingSchema,accountSchema,emailSchema,codeSchema } from '@/lib/domain';
import { AppError } from '@/lib/errors';

export async function pendingClaim(){const token=await pendingHash();return token?rpcResult(database().rpc('neylo_pending',{p_token_hash:token}),pendingSchema.nullable()):null;}
export async function startClaim(input:unknown){
  assertEnrollment();const data=startSchema.parse(input);const tokenHash=hash(await sessionToken());
  await limit('hold-session',tokenHash,8,900);await limit('hold-email',data.email,6,900);
  const hold=await rpcResult(database().rpc('neylo_hold',{p_token_hash:tokenHash,p_email:data.email,p_handle:data.handle,p_terms_version:data.termsVersion,
    p_invitation:data.invitation??'',p_source:data.source,p_campaign_tag:data.campaignTag,p_offer_displayed:data.offerDisplayed}),z.object({handle:z.string(),expiresAt:z.string(),termsVersion:z.string()}));
  const current=await optionalUser();
  if(current?.email_confirmed_at && current.email?.toLowerCase()===data.email){return {kind:'complete',account:await finalizeClaim({key:crypto.randomUUID()})};}
  await sendClaimCode(tokenHash,data.email);
  return {kind:'code',...hold};
}
async function sendClaimCode(tokenHash:string,email:string){
  await limit('otp-email',email,6,3600);
  const allowed=await rpcResult(database().rpc('neylo_request_otp',{p_token_hash:tokenHash}),z.boolean());
  if(!allowed)throw new AppError('RATE_LIMITED',429);
  const auth=await authClient();const {error}=await auth.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
  if(error)throw new AppError(error.status===429?'RATE_LIMITED':'EMAIL_UNAVAILABLE',error.status===429?429:503);
  await rpcResult(database().rpc('neylo_otp_accepted',{p_token_hash:tokenHash}),voidResult);
}
export async function resendClaim(){
  assertEnrollment();const pending=await pendingClaim();const token=await pendingHash();
  if(!pending || !token)throw new AppError('NOT_FOUND',404);
  if(Date.parse(pending.expiresAt)<=Date.now())throw new AppError('HOLD_EXPIRED',409);
  await sendClaimCode(token,pending.email);return {ok:true};
}
export async function verifyClaim(input:unknown){
  const {code,key}=z.object({code:codeSchema,key:z.string().min(8).max(100)}).strict().parse(input);
  const pending=await pendingClaim();const token=await pendingHash();
  if(!pending || !token)throw new AppError('NOT_FOUND',404);
  await limit('verify-session',token,8,900);await limit('verify-email',pending.email,12,3600);
  const auth=await authClient();const {error}=await auth.auth.verifyOtp({email:pending.email,token:code,type:'email'});
  if(error)throw new AppError('INVALID_CODE',400);
  const user=await requireUser();if(user.email?.toLowerCase()!==pending.email)throw new AppError('IDENTITY_MISMATCH',403);
  await markReauthenticated(user.id);
  return {account:await finalizeClaim({key})};
}
export async function finalizeClaim(input:unknown){
  assertEnrollment();const {key}=z.object({key:z.string().min(8).max(100)}).strict().parse(input);
  const user=await requireUser();const token=await pendingHash();if(!token)throw new AppError('NOT_FOUND',404);
  return rpcResult(database().rpc('neylo_finalize',{p_user_id:user.id,p_token_hash:token,p_idempotency_key:key}),accountSchema);
}
export async function signin(input:unknown){
  const {email}=z.object({email:emailSchema}).strict().parse(input);await limit('signin-email',email,6,3600);await limit('signin-cooldown',email,1,60);
  const auth=await authClient();const {error}=await auth.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
  // Identical response prevents an account-existence oracle. Provider never creates an identity on signin.
  if(error && error.status===429)throw new AppError('RATE_LIMITED',429);
  if(error && (!error.status || error.status>=500))throw new AppError('EMAIL_UNAVAILABLE',503);
  return {ok:true};
}
export async function verifySignin(input:unknown){
  const {email,code}=z.object({email:emailSchema,code:codeSchema}).strict().parse(input);await limit('signin-verify',email,12,900);
  const auth=await authClient();const {error}=await auth.auth.verifyOtp({email,token:code,type:'email'});
  if(error)throw new AppError('INVALID_CODE');
  const user=await requireUser();await markReauthenticated(user.id);
  const account=await rpcResult(database().rpc('neylo_account',{p_user_id:user.id}),accountSchema.nullable());
  return {complete:account!==null};
}
export async function signout(){
  const auth=await authClient();const {error}=await auth.auth.signOut({scope:'local'});if(error)throw new AppError('INTERNAL',500);
  const jar=await cookies();jar.delete('neylo_pending');jar.delete('neylo_reauth');return {ok:true};
}
