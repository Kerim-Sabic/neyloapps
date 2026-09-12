import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const config=z.object({url:z.url(),key:z.string().min(10)}).parse({url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY});
const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
const {error}=await client.rpc('neylo_bootstrap_owner',{p_email:'kerim@horalix.com'});
if(error)throw new Error('Owner bootstrap failed. Confirm the intended project and that kerim@horalix.com has completed provider email verification.');
console.log('Verified owner granted operator access. No identity or promotional grant was created.');
