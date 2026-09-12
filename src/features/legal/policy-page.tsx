import Link from 'next/link';
import { authConfigured,operator } from '@/core/config';
import { database } from '@/core/supabase';
import { rpcResult } from '@/core/rpc';
import { campaignSchema } from '@/lib/domain';
import { campaignTerms,privacyNotice } from './policy';
export async function PolicyPage({privacy=false}:{privacy?:boolean}){
  const campaign=authConfigured()?await rpcResult(database().rpc('neylo_campaign'),campaignSchema).catch(()=>null):null;
  const approved=Boolean(campaign?.publishedAt)&&process.env.TERMS_APPROVED==='true';
  const text=approved&&campaign?(privacy?campaign.privacy:campaign.terms):(privacy?privacyNotice:campaignTerms);
  const contact=operator();
  return <main id="main" className="legal-page"><p className="eyebrow">NEYLO · EARLY ACCESS</p><h1>{privacy?'Privacy notice':'Campaign terms'}</h1>{!approved&&<p className="notice">Draft for operator review. Public enrollment remains paused.</p>}<pre>{text}</pre><h2>Contact the operator</h2><address>{contact.name}<br/>{contact.address}</address>{contact.support?<p><a href={`mailto:${contact.support}`}>{contact.support}</a></p>:<p>The monitored support inbox is awaiting operator confirmation.</p>}<p><Link href="/">Return to NEYLO</Link></p></main>;
}
