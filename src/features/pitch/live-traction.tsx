'use client';
import useSWR from 'swr';
import { RefreshCw,ArrowUpRight } from 'lucide-react';
import { useEffect,useState } from 'react';
import { metricsAreStale,pitchMetricsSchema,type PitchMetrics } from './metrics';

async function fetchMetrics(url:string){
  const response=await fetch(url,{credentials:'omit',cache:'no-store'});
  if(!response.ok)throw new Error('Live count unavailable');
  return pitchMetricsSchema.parse(await response.json());
}
export function usePitchMetrics(){
  const query=useSWR<PitchMetrics>('/api/pitch/metrics',fetchMetrics,{refreshInterval:30_000,refreshWhenHidden:false,revalidateOnFocus:true,errorRetryInterval:15_000,errorRetryCount:3,dedupingInterval:10_000});
  const [clock,setClock]=useState(0);
  useEffect(()=>{setClock(Date.now());const interval=setInterval(()=>setClock(Date.now()),15_000);return()=>clearInterval(interval);},[]);
  return {...query,stale:Boolean(query.data&&(query.error||metricsAreStale(query.data.asOf,clock)))};
}
export type LiveMetrics=ReturnType<typeof usePitchMetrics>;
export function LiveBadge({live}:{live:LiveMetrics}){
  return <a className={`pitch-live-badge ${live.stale?'is-stale':''}`} href="#traction"><span className="pitch-tiny-dot"/>{live.data?<><b>{live.data.registered.toLocaleString('en-GB')}</b> registered participants</>:live.error?'Traction temporarily unavailable':'Connecting to signup data'}<ArrowUpRight size={14}/></a>;
}
export function LiveTraction({live}:{live:LiveMetrics}){
  const data=live.data;
  return <div className="pitch-traction"><div className="pitch-traction-primary"><div className="pitch-metric-status"><span className="pitch-tiny-dot"/>{live.stale?'LAST SUCCESSFUL SNAPSHOT':data?'PRODUCTION DATABASE':'CONNECTING'}<button aria-label="Refresh registration count" disabled={live.isValidating} onClick={()=>void live.mutate()}><RefreshCw size={16} className={live.isValidating?'is-refreshing':''}/></button></div>
    <strong className="pitch-traction-count" aria-live="polite">{data?data.registered.toLocaleString('en-GB'):'—'}</strong><h3>registered participants</h3><p>Completed accounts with finalized identities.<br/>Staff, tests and incomplete attempts excluded.</p>
    <div className="pitch-traction-dots" aria-hidden="true">{data&&Array.from({length:Math.min(data.registered,200)},(_,i)=><i key={i} className={i<data.neyloVerified?'is-native':i<data.neyloVerified+data.imported?'is-import':'is-other'}/>)}</div>
    <p className="pitch-data-time" role="status">{data?`${live.stale?'Update interrupted · last read':'Last read'} ${new Date(data.asOf).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'UTC'})} UTC · refreshes every 30s`:live.error?'Could not load the production count. Use Refresh to try again.':'Reading completed signup records…'}</p>
  </div><div className="pitch-traction-detail"><h3>The signal, with its context.</h3><dl className="pitch-provenance"><div><dt><i className="native-dot"/>Verified through NEYLO</dt><dd>{data?.neyloVerified??'—'}</dd></div><div><dt><i className="import-dot"/>Owner-attested imports</dt><dd>{data?.imported??'—'}</dd></div>{Boolean(data?.otherVerified)&&<div><dt>Other verified records</dt><dd>{data?.otherVerified}</dd></div>}</dl>
    <p className="pitch-provenance-note">Imported participants were confirmed by the operator as previously verified. They did not complete a NEYLO email-code signup. These are registrations, not active users or payment volume.</p>
    <div className="pitch-small-metrics"><div><strong>{data?.qualifiedReferrals??'—'}</strong><span>Qualified referrals</span></div><div><strong>{data?.pilotInterest??'—'}</strong><span>Opted into pilot interest</span></div><div><strong>{data?.founding??'—'}</strong><span>Founding participants</span></div><div><strong>{data?.founderAssisted??'—'}</strong><span>Founder-assisted</span></div></div>
    <details className="pitch-data-details"><summary>How the count is calculated</summary><p>Counted from completed profiles joined to provider-managed verified identities. Independent and founder-assisted participants are included; other cohorts are excluded. Import audit records determine verification provenance. The presentation never writes signup, referral or credit records.</p><p>Campaign source: {data?Object.entries(data.sources).map(([source,count])=>`${source} ${count}`).join(' · '):'—'}. Invitation source does not mean a referral qualified.</p></details>
  </div></div>;
}
