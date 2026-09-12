import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { campaignSchema,handleSchema,invitationCodeSchema,invitationSchema } from '@/lib/domain';
import { assertOrigin,hash,sessionToken,limit } from '@/core/security';
import { authConfigured,enrollmentReady } from '@/core/config';
import { database,optionalUser } from '@/core/supabase';
import { rpcResult,voidResult } from '@/core/rpc';
import { startClaim,pendingClaim,verifyClaim,resendClaim,finalizeClaim,signin,verifySignin,signout } from '@/features/signup/service';
import { getAccount,preferences,qualification,deletion } from '@/features/account/service';
import { adminRole,getMetrics,queue,reconcile,mutateAdmin } from '@/features/admin/service';
import { metricsCsv } from '@/features/admin/csv';

export const dynamic='force-dynamic';
const posts:Record<string,(input:unknown)=>Promise<unknown>>={
  'signup/start':startClaim,'signup/verify':verifyClaim,'signup/resend':resendClaim,'signup/finalize':finalizeClaim,
  'auth/signin':signin,'auth/verify':verifySignin,'auth/signout':signout,
  'account/preferences':preferences,'account/qualification':qualification,'account/deletion':deletion,
  'admin/pause':input=>mutateAdmin('pause',input),'admin/review':input=>mutateAdmin('review',input),
  'admin/reverse':input=>mutateAdmin('reverse',input),'admin/classify':input=>mutateAdmin('classify',input),'admin/deletion':input=>mutateAdmin('deletion',input),
};
async function readBody(request:Request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError('INVALID_INPUT',415);
  const reader=request.body?.getReader();if(!reader)return {};
  const decoder=new TextDecoder();let size=0,text='';
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new AppError('INVALID_INPUT',413);}text+=decoder.decode(value,{stream:true});}
  text+=decoder.decode();try{const value:unknown=JSON.parse(text||'{}');return value;}catch{throw new AppError('INVALID_INPUT');}
}
async function get(path:string,url:URL){
  if(path==='health')return {ok:true,service:'neylo'};
  if(path==='campaign'){if(!authConfigured())return {ready:false};return {ready:enrollmentReady(),campaign:await rpcResult(database().rpc('neylo_campaign'),campaignSchema)};}
  if(path==='handle'){const handle=handleSchema.parse(url.searchParams.get('handle'));return {available:await rpcResult(database().rpc('neylo_handle_available',{p_handle:handle}),z.boolean())};}
  if(path==='invitation'){const code=invitationCodeSchema.parse(url.searchParams.get('code'));const invitation=await rpcResult(database().rpc('neylo_invitation',{p_code:code}),invitationSchema.nullable());if(!invitation)throw new AppError('NOT_FOUND',404);return invitation;}
  if(path==='signup/pending')return {pending:await pendingClaim()};
  if(path==='account')return getAccount();
  if(path==='admin/role')return {role:(await adminRole()).role};
  if(path==='admin/metrics'||path==='admin/export')return getMetrics(Object.fromEntries(url.searchParams));
  if(path==='admin/queue')return queue();
  if(path==='admin/reconcile')return reconcile();
  if(path==='admin/readiness'){await adminRole();return {database:authConfigured(),enrollmentReady:enrollmentReady()};}
  throw new AppError('NOT_FOUND',404);
}
async function telemetry(input:unknown){
  const d=z.object({name:z.enum(['landing_view','signup_started','demo_started','demo_completed','share_attempted','invite_link_copied','referral_page_interaction']),key:z.string().min(8).max(100),consent:z.literal(true)}).strict().parse(input);
  const sessionHash=hash(await sessionToken());await limit('events',sessionHash,30,60);const user=await optionalUser();
  if(!user)return {recorded:false};
  return rpcResult(database().rpc('neylo_client_event',{p_user_id:user.id,p_session_hash:sessionHash,p_name:d.name,p_key:d.key}),voidResult);
}
async function handle(request:Request,context:{params:Promise<{path:string[]}>}){
  const requestId=crypto.randomUUID();const headers={'Cache-Control':'private, no-store, max-age=0','X-Request-ID':requestId,'X-Robots-Tag':'noindex, nofollow'};
  try{
    const path=(await context.params).path.join('/');let result:unknown;
    if(request.method==='POST'){assertOrigin(request);const body=await readBody(request);const handler=path==='events'?telemetry:posts[path];if(!handler)throw new AppError('NOT_FOUND',404);result=await handler(body);}
    else{result=await get(path,new URL(request.url));}
    if(path==='admin/export'){const {metricsSchema}=await import('@/lib/domain');return new Response(metricsCsv(metricsSchema.parse(result)),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="neylo-validation.csv"'}});}
    return Response.json(result,{headers});
  }catch(error){
    const failure=error instanceof AppError?error:error instanceof z.ZodError?new AppError('INVALID_INPUT'):new AppError('INTERNAL',500);
    if(failure.status>=500)console.error(JSON.stringify({requestId,code:failure.code}));
    return Response.json({error:{code:failure.code,message:failure.message,requestId}},{status:failure.status,headers});
  }
}
export const GET=handle;
export const POST=handle;
