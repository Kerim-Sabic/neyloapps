import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { authConfig,authConfigured } from './config';
import { AppError } from '@/lib/errors';
import type { Database } from '@/lib/database.generated';

export function database(){const c=authConfig();return createClient<Database>(c.url,c.secret,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function authClient(){
  const c=authConfig(); const jar=await cookies();
  return createServerClient<Database>(c.url,c.publishable,{
    cookieOptions:{httpOnly:true,secure:process.env.APP_STAGE!=='development',sameSite:'lax',path:'/'},
    cookies:{getAll:()=>jar.getAll(),setAll:values=>{try{for(const {name,value,options} of values)jar.set(name,value,options);}catch{/* Server components are read-only; proxy refreshes the session. */}}},
  });
}
export async function optionalUser(){if(!authConfigured())return null;const c=await authClient();const {data,error}=await c.auth.getUser();return error?null:data.user;}
export async function requireUser(){const user=await optionalUser();if(!user?.email_confirmed_at || !user.email)throw new AppError('UNAUTHENTICATED',401);return user;}
