'use client';
import { useEffect,useMemo,useRef,useState } from 'react';
import Link from 'next/link';
import { MotionConfig,motion,useReducedMotion } from 'motion/react';
import { ArrowDownLeft,ArrowLeft,ArrowRight,ArrowUpRight,Check,ChevronRight,Copy,History,Home,Landmark,Link2,Plus,RefreshCw,UserRound,Wifi,X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BottomSheet } from '../bottom-sheet';
import { RouteJourney } from '../route-journey';
import { money,parseAmount } from '../quote';
import { PEOPLE,otherPerson,pairQuote,projectTransfer,type Person,type SharedTransfer } from './domain';
import { useRoom } from './use-room';
import '../demo.css';
import './shared.css';

export function SharedDemoApp({person}:{person:Person}){
  const app=useRoom(person),me=PEOPLE[person],other=otherPerson(person),peer=PEOPLE[other];
  const reduced=Boolean(useReducedMotion());
  const [composing,setComposing]=useState(false),[amount,setAmount]=useState('10'),[selected,setSelected]=useState<string|null>(null),[expanded,setExpanded]=useState(false),[sheet,setSheet]=useState<'pair'|'profile'|null>(null),[copied,setCopied]=useState(false),[validation,setValidation]=useState('');
  const scroll=useRef<HTMLDivElement>(null),lastTransfer=useRef<string|null>(null),root=useRef<HTMLElement>(null);
  const records=app.data?.room.transfers??[],latest=records.at(-1),record=records.find(t=>t.id===selected)??null;
  const incoming=record?.recipient===person,complete=Boolean(record&&record.completedAt!==null);
  const quote=useMemo(()=>{const parsed=parseAmount(amount);return parsed.ok?pairQuote(parsed.minor,person,Date.now()):null;},[amount,person]);
  const sent=records.filter(t=>t.sender===person&&t.completedAt!==null).reduce((n,t)=>n+t.sentMinor,0),received=records.filter(t=>t.recipient===person&&t.completedAt!==null).reduce((n,t)=>n+t.receivedMinor,0);
  const pairedUrl=app.token&&typeof location!=='undefined'?`${location.origin}/demo/${other}#room=${app.token}`:'';
  useEffect(()=>{
    if(!latest||lastTransfer.current===latest.id)return;
    lastTransfer.current=latest.id;setSelected(latest.id);setComposing(false);setExpanded(false);
    scroll.current?.scrollTo({top:0,behavior:'instant'});
  },[latest?.id]);
  useEffect(()=>{const viewport=window.visualViewport;const sync=()=>root.current?.style.setProperty('--demo-viewport-height',`${viewport?.height??innerHeight}px`);viewport?.addEventListener('resize',sync);sync();return()=>viewport?.removeEventListener('resize',sync);},[]);
  function home(){setSelected(null);setComposing(false);setValidation('');scroll.current?.scrollTo({top:0,behavior:reduced?'instant':'smooth'});}
  async function compose(){if(!app.token){const token=await app.create();if(!token)return;setSheet('pair');}setSelected(null);setComposing(true);setValidation('');scroll.current?.scrollTo({top:0,behavior:'instant'});}
  async function send(){const parsed=parseAmount(amount);if(!quote){setValidation(parsed.ok?'Enter at least 1 KM.':parsed.error);return;}const saved=await app.send(amount);if(saved){setSelected(saved.id);setComposing(false);setExpanded(true);}}
  async function copy(text:string){try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setCopied(false);}}
  const status=record?complete?incoming?'Money received':'Transfer sent':incoming?'An arrival is on its way':'On its way':composing?'Make their day.':`Hello, ${me.name}.`;

  return <MotionConfig reducedMotion="user" transition={{duration:reduced?0:.42,ease:[.22,1,.36,1]}}><main id="main" ref={root} className="neylo-demo shared-demo" data-neylo-demo data-reduced={reduced}>
    <div className="demo-stage-brand"><Link href="/app/demo" aria-label="NEYLO product experience">neylo<span>®</span></Link><span>A NAME. A ROUTE. AN ARRIVAL.</span></div>
    <div className="demo-stage"><aside className="demo-editorial"><p className="demo-kicker">ONE ADDRESS FOR MONEY</p><h1>{person==='nadin'?<>A little closer.<br/>With every<br/><span>send.</span></>:<>Good things.<br/>Finding their<br/><span>way to you.</span></>}</h1><p>{person==='nadin'?'From your address to theirs.':'An arrival worth opening.'}<br/>Every detail, connected.</p><div className="demo-editorial-line"/><button className="demo-text-button" onClick={()=>{setCopied(false);setSheet('pair');}}><Link2 size={16}/>Pair the other screen</button><Link className="shared-back-link" href="/app/demo"><ArrowLeft size={14}/>Explore routing</Link></aside>
    <div className="demo-device"><div className="demo-device-edge" aria-hidden="true"/><div className="demo-phone">
      <header className="demo-app-header"><button className="demo-wordmark" aria-label="NEYLO app home" onClick={home}>neylo<span>®</span></button><button className="shared-profile" onClick={()=>setSheet('profile')} aria-label={`${me.name}'s profile`}><span className={`shared-avatar is-${person}`}>{me.initials}</span><span>{me.handle}</span></button></header>
      <div className="demo-app-scroll shared-scroll" ref={scroll}>
        <div className="shared-connection"><span className={app.connected?'is-connected':''}/>{app.connected?'Connected':app.token?'Connecting…':'Your personal address'}<button onClick={()=>{setCopied(false);setSheet('pair');}} aria-label="Pair another screen"><Link2 size={15}/></button></div>
        {(composing||record)&&<button className="demo-text-button shared-back" onClick={home}><ArrowLeft size={16}/>Overview</button>}
        <motion.div layout="position" className="shared-heading"><p className="demo-kicker">{record?incoming?'INCOMING TRANSFER':'OUTGOING TRANSFER':composing?'SEND TO A NAME':'YOUR EVERYDAY, CONNECTED'}</p><h1>{status}</h1>{!record&&!composing&&<p>One address. More possibilities.</p>}</motion.div>
        {app.error&&<div className="demo-error" role="alert">{app.error}<button className="demo-text-button" onClick={()=>app.refresh()}><RefreshCw size={15}/>Reconnect</button></div>}
        {!composing&&!record&&<><div className="shared-totals"><div><span><ArrowDownLeft size={15}/>Received</span><strong>{money(received,'BAM')}</strong></div><div><span><ArrowUpRight size={15}/>Sent</span><strong>{money(sent,'BAM')}</strong></div></div><div className="demo-section-label">YOUR PEOPLE<span>ONE ADDRESS AWAY</span></div></>}
        <motion.section layout="position" className={`shared-payment ${composing||record?'is-open':''}`} aria-label="Transfer details">
          <div className="shared-person"><span className={`shared-avatar is-${other}`}>{peer.initials}</span><div><span>{record?incoming?'From':'To':composing?'Sending to':'Send to'}</span><strong>{peer.handle}</strong><small>{peer.name} · {peer.source}</small></div>{!composing&&!record&&<button className="shared-person-send" aria-label={`Send to ${peer.handle}`} disabled={app.busy||!!latest&&latest.completedAt===null} onClick={compose}><ArrowUpRight size={23}/></button>}</div>
          {(composing||record)&&<motion.div layout="position" className={`shared-money ${record&&complete?'has-arrived':''}`}><span>{record?incoming?'You receive':'You send':'You send · fee included'}</span>{composing?<div className="shared-money-input"><input aria-label="Amount to send" inputMode="decimal" autoComplete="off" spellCheck={false} value={amount} maxLength={12} aria-invalid={!!validation} aria-describedby="shared-amount-error" onChange={e=>{setAmount(e.target.value);setValidation('');}} onKeyDown={e=>{if(e.key==='Enter')void send();}}/><span>KM</span></div>:<strong>{money(incoming?record!.receivedMinor:record!.sentMinor,'BAM')}</strong>}<p id="shared-amount-error" className={validation?'shared-input-error':'demo-sr-only'}>{validation||'Use up to two decimal places. Minimum 1 KM, maximum 10,000 KM.'}</p></motion.div>}
          {composing&&<><div className="shared-funding"><Landmark size={21}/><div><span>Demo source</span><strong>{me.source}</strong></div><span>KM</span></div><dl className="shared-summary"><div><dt>{peer.handle} receives</dt><dd>{quote?money(quote.receivedMinor,'BAM'):'—'}</dd></div><div><dt>Fee included</dt><dd>{quote?money(quote.feeMinor,'BAM'):'—'}</dd></div><div><dt>Route</dt><dd>Direct bank route</dd></div></dl></>}
          {record&&<SharedJourney record={record} snapshot={app.data} expanded={expanded} onToggle={()=>setExpanded(value=>!value)} reduced={reduced}/>}
          {record&&<div className={`shared-arrival ${complete?'is-complete':''}`} role="status"><span>{complete?<Check size={19}/>:<ArrowRight size={19}/>}</span><div><strong>{complete?incoming?`From ${peer.handle}, with NEYLO.`:`Delivered to ${peer.handle}.`:'Following the route'}</strong><p>{complete?'Your receipt is ready below.':'Both pages follow the same journey.'}</p></div></div>}
          {record&&complete&&<motion.div className="shared-receipt" initial={reduced?false:{opacity:0,y:8}} animate={{opacity:1,y:0}}><dl className="shared-summary"><div><dt>Sent by {PEOPLE[record.sender].handle}</dt><dd>{money(record.sentMinor,'BAM')}</dd></div><div><dt>Fee included</dt><dd>{money(record.feeMinor,'BAM')}</dd></div><div><dt>Recipient gets</dt><dd>{money(record.receivedMinor,'BAM')}</dd></div><div><dt>Arrived</dt><dd>{new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(record.completedAt!)}</dd></div></dl><button className="shared-reference" onClick={()=>copy(`NEY-${record.id}`)}><span>NEY-{record.id.slice(0,8).toUpperCase()}</span>{copied?<Check size={15}/>:<Copy size={15}/>}<span className="demo-sr-only">Copy transfer reference</span></button></motion.div>}
        </motion.section>
        {composing&&<div className="demo-actions"><button className="demo-primary" disabled={app.busy||!app.connected} onClick={send}>{app.busy?'Confirming…':`Send to ${peer.handle}`}<ArrowRight size={19}/></button><p className="shared-action-note">You send a total of {quote?money(quote.sentMinor,'BAM'):'—'}.</p></div>}
        {record&&complete&&<div className="demo-actions"><button className="demo-primary" onClick={compose}>{incoming?'Send back':'Send another'}<ArrowUpRight size={19}/></button></div>}
        {!composing&&!record&&<><section id="shared-activity" className="shared-activity"><div className="demo-section-label">ACTIVITY<span>{records.length?String(records.length).padStart(2,'0'):'ALL IN ONE PLACE'}</span></div>{records.length?[...records].reverse().map(item=><button key={item.id} onClick={()=>{setSelected(item.id);setExpanded(false);scroll.current?.scrollTo({top:0,behavior:reduced?'instant':'smooth'});}}><span className={`shared-activity-icon ${item.recipient===person?'is-incoming':''}`}>{item.recipient===person?<ArrowDownLeft size={20}/>:<ArrowUpRight size={20}/>}</span><span><strong>{item.recipient===person?'From':'To'} {peer.handle}</strong><small>{item.completedAt===null?'On its way':new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(item.completedAt)}</small></span><strong>{item.recipient===person?'+':'−'}{money(item.recipient===person?item.receivedMinor:item.sentMinor,'BAM')}</strong><ChevronRight size={15}/></button>):<div className="shared-empty"><span><ArrowDownLeft size={24}/></span><h2>A new kind of connection.</h2><p>Your sends and arrivals will appear here.</p></div>}</section>{!app.token&&<button className="demo-secondary shared-connect-button" disabled={app.busy||!app.ready} onClick={async()=>{if(await app.create())setSheet('pair');}}><Link2 size={17}/>{app.busy?'Connecting…':'Connect the two pages'}</button>}</>}
        <div className="shared-bottom-space"/>
      </div>
      <nav className="shared-nav" aria-label="Application navigation"><button className={!composing&&!record?'is-selected':''} onClick={home}><Home size={21}/><span>Home</span></button><button onClick={()=>{home();requestAnimationFrame(()=>document.getElementById('shared-activity')?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'}));}}><History size={21}/><span>Activity</span></button><button onClick={()=>setSheet('profile')}><UserRound size={21}/><span>Profile</span></button></nav>
      <BottomSheet closeLabel="Close panel" kicker={sheet==='profile'?'YOUR PERSONAL ADDRESS':'CONNECTED EXPERIENCE'} open={sheet!==null} title={sheet==='profile'?'Your NEYLO address':'Two pages. One journey.'} onClose={()=>setSheet(null)}>{sheet==='profile'?<div className="shared-profile-sheet"><span className={`shared-avatar is-${person}`}>{me.initials}</span><h3>{me.handle}</h3><p>{me.name}</p><dl className="shared-summary"><div><dt>Email</dt><dd>{me.email}</dd></div><div><dt>Address</dt><dd>{me.handle}</dd></div></dl><button className="demo-secondary" onClick={()=>{setCopied(false);setSheet('pair');}}><Link2 size={16}/>Pair another screen</button></div>:<><p className="demo-sheet-intro">Open {peer.name}’s page on the other device using this link. Both pages will share this session.</p>{pairedUrl?<><div className="shared-qr"><QRCodeSVG value={pairedUrl} size={168} level="M" marginSize={4} bgColor="#ffffff" fgColor="#07101e" title={`Open ${peer.name}'s paired page`}/></div><a className="demo-primary shared-pair-link" href={pairedUrl} target="_blank" rel="noopener noreferrer">Open {peer.handle}<ArrowUpRight size={18}/></a><button className="demo-secondary" onClick={()=>copy(pairedUrl)}>{copied?<Check size={17}/>:<Copy size={17}/>}<span role="status">{copied?'Pairing link copied':'Copy pairing link'}</span></button><p className="shared-session-note">Keep this link with the people using this session. Sessions are available for 24 hours.</p></>:null}<button className="demo-text-button" disabled={app.busy} onClick={async()=>{await app.create();lastTransfer.current=null;home();setCopied(false);}}><Plus size={16}/>{app.busy?'Connecting…':app.token?'Start a new paired session':'Start a paired session'}</button></>}</BottomSheet>
    </div></div><div className="demo-stage-caption"><span>{me.handle.toUpperCase()} / PERSONAL ADDRESS</span><button onClick={()=>setSheet('pair')}><Link2 size={15}/>Pair screens</button></div></div>
  </main></MotionConfig>;
}

function SharedJourney({record,snapshot,expanded,onToggle,reduced}:{record:SharedTransfer;snapshot:ReturnType<typeof useRoom>['data'];expanded:boolean;onToggle:()=>void;reduced:boolean}){
  const [clock,setClock]=useState(0);
  useEffect(()=>{if(record.completedAt!==null)return;const timer=setInterval(()=>{if(!document.hidden)setClock(performance.now());},80);return()=>clearInterval(timer);},[record.id,record.completedAt]);
  const now=snapshot?snapshot.serverNow+Math.max(0,clock-snapshot.receivedAt):record.startedAt;
  const transfer=projectTransfer(record,now);
  const nodes=useMemo(()=>transfer.quote.route.nodes,[record.id]);
  return <RouteJourney nodes={nodes} transfer={transfer} expanded={expanded} onToggle={onToggle} reduced={reduced}/>;
}
