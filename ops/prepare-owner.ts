import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const env=JSON.parse(await readFile('.env.production.secrets.json','utf8'));
if(env.NEXT_PUBLIC_SUPABASE_URL!=='https://tfphopejudgbfrucdxsy.supabase.co')throw Error('Wrong project');
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const email='kerim@horalix.com';
const {data:existing,error:lookupError}=await admin.auth.admin.listUsers({perPage:1000});
if(lookupError)throw Error(lookupError.message);
if(!existing.users.some(user=>user.email===email)){
  const {error}=await admin.auth.admin.createUser({email,email_confirm:false});
  if(error)throw Error(error.message);
}
const {error:tagError}=await admin.from('participant_tags').upsert({email,cohort:'staff',reason:'Owner requested operator account; excluded from founding rewards and participant validation'}, {onConflict:'email'});
if(tagError)throw Error(tagError.message);
console.log('Owner identity prepared without marking email verified or completing enrollment. Staff exclusion recorded.');
