'use client';
import { motion,useMotionValue,useSpring } from 'motion/react';
import { ArrowRight,AtSign,Check,ChevronRight,Layers3,Route,ShieldCheck } from 'lucide-react';
import { useMemo,useState } from 'react';
import { calculateQuotes,money,parseAmount,rankQuotes } from '@/features/demo/quote';
import type { Preference } from '@/features/demo/config';

export function AddressCore({reduced}:{reduced:boolean}){
  const x=useMotionValue(0),y=useMotionValue(0),rx=useSpring(x,{stiffness:90,damping:24}),ry=useSpring(y,{stiffness:90,damping:24});
  return <div className="pitch-core-stage" aria-label="A personal address above connected payment layers" role="img" onPointerMove={e=>{if(reduced||e.pointerType!=='mouse')return;const b=e.currentTarget.getBoundingClientRect();x.set((e.clientY-b.top-b.height/2)/b.height*-10);y.set((e.clientX-b.left-b.width/2)/b.width*12);}} onPointerLeave={()=>{x.set(0);y.set(0);}}>
    <div className="pitch-orbit pitch-orbit-one"/><div className="pitch-orbit pitch-orbit-two"/>
    <span className="pitch-coordinate coord-one">IDENTITY / 01</span><span className="pitch-coordinate coord-two">INTENT → ARRIVAL</span>
    <motion.div className="pitch-core-camera" style={{rotateX:reduced?0:rx,rotateY:reduced?0:ry}}>
      <div className="pitch-core-float"><div className="pitch-core-stack">
        <div className="pitch-core-plane plane-bottom"><span>PAYMENT RAILS</span><i/><i/><i/></div>
        <div className="pitch-core-plane plane-middle"><span>ROUTING INTELLIGENCE</span><Route size={74} strokeWidth={.65}/></div>
        <div className="pitch-core-plane plane-top"><div className="pitch-core-face"><AtSign strokeWidth={1.15}/><span>neylo</span><small>ONE ADDRESS</small></div></div>
      </div></div>
      <div className="pitch-address-caption"><span className="pitch-tiny-dot"/>@yourname<ChevronRight size={16}/></div>
    </motion.div>
    <div className="pitch-core-shadow"/>
  </div>;
}

export function AddressLayers(){
  const [layer,setLayer]=useState(0);
  const descriptions=[['Identity','One personal address.','A stable @handle with a persistent account. The person stays recognizable across the journey.'],['Decision','Choose the right path.','Compare eligible routes by total fee and delivery estimate, then apply the sender’s preference.'],['Journey','Keep the whole story.','One transfer identity connects the chosen route, progress and receipt.']];
  return <div className="pitch-layer-explainer"><div className="pitch-layer-visual" aria-hidden="true">{[2,1,0].map(i=><div key={i} className={`pitch-layer-slab slab-${i} ${layer===i?'is-selected':''}`}><span>{i===0?<AtSign/>:i===1?<Route/>:<Layers3/>}</span><b>{descriptions[i]?.[0]}</b><small>0{i+1}</small></div>)}</div>
    <div className="pitch-layer-tabs" role="tablist" aria-label="Product layers">{descriptions.map((item,i)=><button key={item[0]} id={`layer-tab-${i}`} role="tab" aria-controls="layer-description" aria-selected={layer===i} tabIndex={layer===i?0:-1} onClick={()=>setLayer(i)} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=(i+(e.key==='ArrowRight'?1:2))%3;setLayer(next);document.getElementById(`layer-tab-${next}`)?.focus();}}}>0{i+1}<span>{item[0]}</span></button>)}</div>
    <div id="layer-description" role="tabpanel" aria-labelledby={`layer-tab-${layer}`} className="pitch-layer-description"><h3>{descriptions[layer]?.[1]}</h3><p>{descriptions[layer]?.[2]}</p></div>
  </div>;
}

export function RoutingProof(){
  const [amount,setAmount]=useState('100'),[preference,setPreference]=useState<Preference>('cost');
  const parsed=parseAmount(amount);
  const quotes=useMemo(()=>{const p=parseAmount(amount);return p.ok?calculateQuotes('anna',p.minor,0):[];},[amount]);
  const selected=rankQuotes(quotes,preference)[0];
  const error=!parsed.ok?parsed.error:!selected?'Enter at least 5 USDC for this route.':'';
  return <div className="pitch-route-proof"><div className="pitch-proof-top"><span><span className="pitch-tiny-dot"/>ROUTING WORKBENCH</span><span>USDC → EUR</span></div>
    <div className="pitch-proof-amount"><label htmlFor="pitch-amount">You send · fee included</label><div><input id="pitch-amount" inputMode="decimal" autoComplete="off" value={amount} maxLength={12} aria-invalid={!!error} aria-describedby="pitch-amount-error" onChange={e=>setAmount(e.target.value)}/><span>USDC</span></div><p id="pitch-amount-error" className={error?'pitch-error':'pitch-sr-only'}>{error||'Up to two decimal places; minimum 5, maximum 10,000 USDC.'}</p></div>
    <div className="pitch-preferences" aria-label="Routing preference"><button aria-pressed={preference==='cost'} onClick={()=>setPreference('cost')}>Lowest cost</button><button aria-pressed={preference==='speed'} onClick={()=>setPreference('speed')}>Fastest</button></div>
    <div className="pitch-proof-result" aria-live="polite"><span>@anna receives</span><strong>{selected?money(selected.receivedMinor,'EUR'):'—'}</strong><div><span>Total fee <b>{selected?money(selected.feeMinor,'USDC'):'—'}</b></span><span>Estimated delivery <b>{selected?.route.eta??'—'}</b></span></div></div>
    <div className="pitch-proof-route" aria-label={selected?.route.nodes.map(n=>n.name).join(' to ')??'No route'}>{['Wallet','Settlement','FX','EUR rail','Anna'].map((n,i)=><span key={n}><i>{i===4?<Check size={12}/>:i+1}</i><small>{n}</small>{i<4&&<b/>}</span>)}</div>
    <p className="pitch-proof-caption">Calculated by NEYLO’s routing engine. Configured fee, FX and time assumptions; financial execution is simulated.</p>
  </div>;
}

export function ConnectedPreview(){
  const quote=calculateQuotes('kesh',4000,0)[0];
  if(!quote)return null;
  return <div className="pitch-pair-visual" aria-label="Nadin and Kerim share one connected journey"><div className="pitch-person-panel panel-sender"><div className="pitch-person-top"><span>N</span><b>@nadin</b><small>Sender</small></div><p>Make their day.</p><div className="pitch-person-amount">You send<strong>{quote.sentMinor/100}<span> KM</span></strong></div><div className="pitch-preview-button">Send to @kerim <ArrowRight size={16}/></div><small className="pitch-preview-label">Product example</small></div>
    <div className="pitch-pair-bridge" aria-hidden="true"><span/><ArrowRight/></div>
    <div className="pitch-person-panel panel-recipient"><div className="pitch-person-top"><span>K</span><b>@kerim</b><small>Recipient</small></div><p>Good things arrive.</p><div className="pitch-person-amount">Recipient gets<strong>{(quote.receivedMinor/100).toFixed(2)}<span> KM</span></strong></div><div className="pitch-arrival-label"><ShieldCheck size={18}/>One shared receipt</div><small className="pitch-preview-label">{money(quote.feeMinor,'BAM')} fee included</small></div></div>;
}
