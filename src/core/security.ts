import 'server-only';
import { createHash,createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { applicationOrigin } from './config';
import { database } from './supabase';
import { AppError,databaseError } from '@/lib/errors';

export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function hmac(value:string){const key=process.env.RATE_LIMIT_SECRET;if(!key || key.length<32)throw new AppError('UNAVAILABLE',503);return createHmac('sha256',key).update(value).digest('hex');}
export async function sessionToken(){const jar=await cookies();const current=jar.get('neylo_pending')?.value;if(current && /^[a-f0-9]{64}$/.test(current))return current;const token=randomBytes(32).toString('hex');jar.set('neylo_pending',token,{httpOnly:true,secure:process.env.APP_STAGE!=='development',sameSite:'lax',path:'/',maxAge:60*60*24});return token;}
export async function pendingHash(){const token=(await cookies()).get('neylo_pending')?.value;return token&&/^[a-f0-9]{64}$/.test(token)?hash(token):null;}
export async function limit(operation:string,identity:string,count:number,seconds:number){
  const {data,error}=await database().rpc('neylo_rate_limit',{p_key:`${operation}:${hmac(identity)}`,p_limit:count,p_window_seconds:seconds});
  if(error)databaseError(error.message,error.code);if(!data)throw new AppError('RATE_LIMITED',429);
}
export function assertOrigin(request:Request){
  const requestOrigin=request.headers.get('origin');
  const allowed=new Set([applicationOrigin()]);
  if(process.env.APP_STAGE==='development'){allowed.add('http://localhost:3100');allowed.add('http://127.0.0.1:3100');}
  if(!requestOrigin || !allowed.has(requestOrigin) || request.headers.get('sec-fetch-site')==='cross-site')throw new AppError('INVALID_ORIGIN',403);
}
export async function markReauthenticated(userId:string){
  const value=`${userId}:${Date.now()}`;const jar=await cookies();jar.set('neylo_reauth',`${value}:${hmac(value)}`,{httpOnly:true,secure:process.env.APP_STAGE!=='development',sameSite:'strict',path:'/',maxAge:600});
}
export async function requireRecentAuth(userId:string){
  const value=(await cookies()).get('neylo_reauth')?.value??'';const [id,time,signature]=value.split(':');
  if(id!==userId || !time || !signature || !/^[a-f0-9]{64}$/.test(signature) || Date.now()-Number(time)>600000 || Number(time)>Date.now())throw new AppError('REAUTH_REQUIRED',403);
  if(!timingSafeEqual(Buffer.from(signature),Buffer.from(hmac(`${id}:${time}`))))throw new AppError('REAUTH_REQUIRED',403);
}
