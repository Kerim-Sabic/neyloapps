'use client';
import { useEffect,useId,useRef,useState } from 'react';
import { Pause,Play } from 'lucide-react';
import { motion,useReducedMotion,useMotionValue,useSpring,useTransform } from 'motion/react';
import type { MotionStyle,MotionValue } from 'motion/react';
import { useCreditDisplay } from '@/features/currency/provider';
import './identity-card.css';

type CardProps={handle:string;state:'preview'|'held'|'reserved';totalMinor?:number;offerAvailable?:boolean;quiet?:boolean;variant?:'credit'|'waitlist'};
export function IdentityCard({handle,state,totalMinor=0,offerAvailable=true,quiet=false,variant='credit'}:CardProps){
  const {credit}=useCreditDisplay();const amount=credit(state==='reserved'?totalMinor:10000);
  const reduced=useReducedMotion();const frame=useRef<number|null>(null),stage=useRef<HTMLDivElement>(null);
  const [paused,setPaused]=useState(false),[visible,setVisible]=useState(true);
  const lineId=useId();
  const x=useMotionValue(0),y=useMotionValue(0);const rotateX=useSpring(x,{stiffness:300,damping:32}),rotateY=useSpring(y,{stiffness:300,damping:32});
  const lightX=useTransform(rotateY,[-7,7],['25%','75%']);const lightY=useTransform(rotateX,[-5,5],['70%','30%']);
  const title=handle||'yourname';const still=Boolean(reduced||quiet||paused||!visible);
  const materialStyle:MotionStyle & {'--light-x':MotionValue<string>;'--light-y':MotionValue<string>}={rotateX:still?0:rotateX,rotateY:still?0:rotateY,'--light-x':lightX,'--light-y':lightY};
  function reset(){if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}x.set(0);y.set(0);}
  useEffect(()=>{
    let inView=true;
    const sync=()=>setVisible(inView&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{inView=Boolean(entry?.isIntersecting);sync();},{threshold:.1});
    if(stage.current)observer.observe(stage.current);
    document.addEventListener('visibilitychange',sync);sync();
    return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);if(frame.current!==null)cancelAnimationFrame(frame.current);};
  },[]);
  useEffect(()=>{if(still){if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}x.set(0);y.set(0);}},[still,x,y]);
  function pointerMove(event:React.PointerEvent<HTMLDivElement>){
    if(still||event.pointerType!=='mouse'||!matchMedia('(pointer:fine)').matches||document.hidden)return;
    const rect=stage.current?.getBoundingClientRect();if(!rect)return;
    const dx=Math.max(-.5,Math.min(.5,(event.clientX-rect.left)/rect.width-.5)),dy=Math.max(-.5,Math.min(.5,(event.clientY-rect.top)/rect.height-.5));
    if(frame.current!==null)cancelAnimationFrame(frame.current);
    frame.current=requestAnimationFrame(()=>{x.set(-dy*7);y.set(dx*10);frame.current=null;});
  }
  return <div ref={stage} className={`card-stage ${quiet?'card-quiet':''}`} data-animated={!still}>
    <div className="card-reveal" onPointerMove={pointerMove} onPointerLeave={reset} onPointerCancel={reset}>
      <div className="card-levitate">
      <motion.section className={`identity-card card-${state}`} aria-label={`NEYLO early-access identity card, ${state==='reserved'?'handle reserved':state==='held'?'held while you verify':'preview'}`}
        style={materialStyle}>
        <div className="card-material" aria-hidden="true"><svg className="card-lines" viewBox="0 0 720 410" preserveAspectRatio="none"><defs><linearGradient id={lineId} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#7598ff" stopOpacity=".02"/><stop offset=".5" stopColor="#b5d2ff" stopOpacity=".25"/><stop offset="1" stopColor="#91c0f2" stopOpacity=".02"/></linearGradient></defs>{Array.from({length:18},(_,i)=><path key={i} d={`M ${210+i*13} 480 L ${490+i*13} -50 M ${-110+i*13} 480 L ${170+i*13} -50`} stroke={`url(#${lineId})`} strokeWidth=".7"/>)}</svg><div className="card-grain"/><div className="card-light"/><div className="card-sheen"/></div>
        <div className="card-top"><span className="card-wordmark">neylo<span className="brand-dot" aria-hidden="true">•</span></span><span className="eyebrow">EARLY ACCESS</span></div>
        <div className="card-identity"><span className={`card-handle ${title.length>14?'handle-long':title.length>10?'handle-medium':''}`}>@{title}</span><span className="card-subtitle">{state==='reserved'?'Handle reserved':'Your money address'}</span></div>
        <div className="card-bottom"><div><span className="card-label">{variant==='waitlist'?'YOUR EARLY ACCESS':state==='reserved'?'Launch credit reserved':offerAvailable?'Welcome offer':'Early-access identity'}</span><motion.span key={state==='reserved'?totalMinor:'preview'} className={`card-credit ${variant==='waitlist'?'card-waitlist':''} ${amount.length>15?'credit-long':''}`} initial={{opacity:.65}} animate={{opacity:1}} transition={{duration:reduced?0:.25}}>{variant==='waitlist'?(state==='reserved'?'On the waitlist':state==='held'?'One step away':'Join the waitlist'):state==='reserved'||offerAvailable?amount:'neylo.xyz'}</motion.span></div><div className="card-signature"><span className="card-status"><span className="status-dot"/>{state==='reserved'?'Reserved':state==='held'?'Held while you verify':'Preview'}</span><span className="card-domain">neylo.xyz</span></div></div>
      </motion.section></div>
    </div>
    <button className="card-motion-toggle" type="button" aria-label={paused?'Resume card animation':'Pause card animation'} aria-pressed={paused} onClick={()=>{reset();setPaused(value=>!value);}}>{paused?<Play size={11} aria-hidden="true"/>:<Pause size={11} aria-hidden="true"/>}<span>{paused?'Resume motion':'Pause motion'}</span></button>
  </div>;
}
