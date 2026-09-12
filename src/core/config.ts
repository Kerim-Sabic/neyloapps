import 'server-only';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { origin } from '@/lib/domain';

export function authConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY);}
export function authConfig(){
  if(!authConfigured()) throw new AppError('UNAVAILABLE',503);
  const parsed=z.object({url:z.url(),publishable:z.string().min(10),secret:z.string().min(10)}).parse({url:process.env.NEXT_PUBLIC_SUPABASE_URL,publishable:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret:process.env.SUPABASE_SECRET_KEY});
  if(process.env.APP_STAGE==='production' && (!parsed.url.startsWith('https://') || process.env.APP_ORIGIN!==origin)) throw new AppError('UNAVAILABLE',503);
  if(process.env.AUTH_BYPASS || process.env.FAKE_OTP || process.env.SYNTHETIC_REWARDS) throw new Error('Authentication bypass configuration is forbidden.');
  return parsed;
}
export function enrollmentReady(){return authConfigured() && process.env.PUBLIC_ENROLLMENT_ENABLED==='true' && process.env.TERMS_APPROVED==='true' && process.env.SMTP_VERIFIED==='true' && Boolean(process.env.OPERATOR_NAME && process.env.OPERATOR_ADDRESS && process.env.SUPPORT_EMAIL);}
export function assertEnrollment(){if(!enrollmentReady())throw new AppError('UNAVAILABLE',503);}
export function applicationOrigin(){return process.env.APP_STAGE==='development' ? (process.env.APP_ORIGIN || 'http://127.0.0.1:3100') : origin;}
export function operator(){return {name:process.env.OPERATOR_NAME || 'Horalix d.o.o.',address:process.env.OPERATOR_ADDRESS || 'Maglajska 1, Sarajevo, Bosnia and Herzegovina',support:process.env.SUPPORT_EMAIL || 'kerim@horalix.com'};}
