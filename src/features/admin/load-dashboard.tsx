import { redirect } from 'next/navigation';
import { optionalUser } from '@/core/supabase';
import { adminRole,getMetrics } from './service';
import { Dashboard } from './dashboard';
import { AppError } from '@/lib/errors';
export async function LoadDashboard({judge=false}:{judge?:boolean}){if(!await optionalUser())redirect(`/signin?next=${judge?'/judge':'/admin/validation'}`);try{const {role}=await adminRole();const metrics=await getMetrics({});return <Dashboard initial={metrics} role={role} judge={judge}/>;}catch(e){if(e instanceof AppError&&e.code==='FORBIDDEN')return <main className="auth-page" id="main"><p className="eyebrow">PRIVATE ACCESS</p><h1>This space is private.</h1><p>Your account does not have operator or presenter access. Knowing this address does not grant access.</p></main>;throw e;}}
