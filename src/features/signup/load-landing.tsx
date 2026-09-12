import { Landing } from './landing';
import { rpcResult } from '@/core/rpc';
import { database,optionalUser } from '@/core/supabase';
import { authConfigured,enrollmentReady,operator } from '@/core/config';
import { campaignSchema,type Invitation,sourceSchema } from '@/lib/domain';
export async function LoadLanding({source='direct',campaignTag='',invitation}:{source?:string;campaignTag?:string;invitation?:Invitation}){
  const user=await optionalUser();const campaign=authConfigured()?await rpcResult(database().rpc('neylo_campaign'),campaignSchema).catch(()=>null):null;
  const parsed=sourceSchema.safeParse(source);
  return <Landing campaign={campaign} ready={enrollmentReady()&&Boolean(campaign?.open)} invitation={invitation} initialEmail={user?.email} source={parsed.success?parsed.data:'direct'} campaignTag={/^[a-zA-Z0-9_-]{0,80}$/.test(campaignTag)?campaignTag:''} support={operator().support}/>;
}
