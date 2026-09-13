import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authConfigured,operator } from '@/core/config';
import { database } from '@/core/supabase';
import { rpcResult } from '@/core/rpc';
import { campaignSchema } from '@/lib/domain';
import { waitlistTerms,privacyNotice } from './policy';
export async function PolicyPage({privacy=false,version}:{privacy?:boolean;version?:string}){
  const campaign=authConfigured()?await rpcResult(database().rpc('neylo_campaign'),campaignSchema).catch(()=>null):null;
  const historical=version&&version!==campaign?.version;
  const selected=historical?await rpcResult(database().rpc('neylo_policy',{p_version:version}),campaignSchema.pick({version:true,terms:true,privacy:true,publishedAt:true}).nullable()):campaign;
  if(historical&&!selected)notFound();
  const approved=Boolean(selected?.publishedAt)&&process.env.TERMS_APPROVED==='true';
  const text=approved&&selected?(privacy?selected.privacy:selected.terms):(privacy?privacyNotice:waitlistTerms);
  const contact=operator();
  return <main id="main" className="legal-page"><p className="eyebrow">NEYLO · EARLY ACCESS</p><h1>{privacy?'Privacy notice':historical?'Historical campaign terms':'Waitlist terms'}</h1>{historical&&<p className="notice">This is a previously published version. <Link href="/terms">Read the current waitlist terms.</Link></p>}{!approved&&<p className="notice">Draft for operator review. Public enrollment remains paused.</p>}<pre>{text}</pre><h2>Contact the operator</h2><address>{contact.name}<br/>{contact.address}</address>{contact.support?<p><a href={`mailto:${contact.support}`}>{contact.support}</a></p>:<p>The monitored support inbox is awaiting operator confirmation.</p>}<p><Link href="/">Return to NEYLO</Link></p></main>;
}
