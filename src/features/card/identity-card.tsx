'use client';
import { useRef } from 'react';
import { motion,useReducedMotion,useMotionValue,useSpring,useTransform } from 'motion/react';
import type { MotionStyle,MotionValue } from 'motion/react';
import { formatCredit } from '@/lib/domain';

type CardProps={handle:string;state:'preview'|'held'|'reserved';totalMinor?:number;offerAvailable?:boolean;quiet?:boolean};
export function IdentityCard({handle,state,totalMinor=0,offerAvailable=true,quiet=false}:CardProps){
  const reduced=useReducedMotion();const frame=useRef<number|null>(null);
  const x=useMotionValue(0),y=useMotionValue(0);const rotateX=useSpring(x,{stiffness:300,damping:32}),rotateY=useSpring(y,{stiffness:300,damping:32});
  const lightX=useTransform(rotateY,[-7,7],['25%','75%']);const lightY=useTransform(rotateX,[-5,5],['70%','30%']);
  const title=handle||'yourname';const still=Boolean(reduced||quiet);
  const materialStyle:MotionStyle & {'--light-x':MotionValue<string>;'--light-y':MotionValue<string>}={rotateX:still?0:rotateX,rotateY:still?0:rotateY,'--light-x':lightX,'--light-y':lightY};
  function reset(){if(frame.current!==null)cancelAnimationFrame(frame.current);x.set(0);y.set(0);}
  function pointerMove(event:React.PointerEvent<HTMLDivElement>){
    if(still||event.pointerType!=='mouse'||!matchMedia('(pointer:fine)').matches||document.hidden)return;
    const rect=event.currentTarget.getBoundingClientRect();const dx=(event.clientX-rect.left)/rect.width-.5,dy=(event.clientY-rect.top)/rect.height-.5;
    if(frame.current!==null)cancelAnimationFrame(frame.current);
    frame.current=requestAnimationFrame(()=>{x.set(-dy*8);y.set(dx*12);});
  }
  return <div className={`card-stage ${quiet?'card-quiet':''}`} onPointerMove={pointerMove} onPointerLeave={reset}>
    <div className="card-reveal">
      <motion.section className={`identity-card card-${state}`} aria-label={`NEYLO early-access identity card, ${state==='reserved'?'handle reserved':state==='held'?'held while you verify':'preview'}`}
        style={materialStyle}>
        <div className="card-material" aria-hidden="true"><svg className="card-lines" viewBox="0 0 720 410" preserveAspectRatio="none"><defs><linearGradient id="line-light" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#7598ff" stopOpacity=".04"/><stop offset=".5" stopColor="#91c0f2" stopOpacity=".22"/><stop offset="1" stopColor="#91c0f2" stopOpacity=".02"/></linearGradient></defs>{Array.from({length:18},(_,i)=><path key={i} d={`M ${210+i*13} 480 L ${490+i*13} -50 M ${-110+i*13} 480 L ${170+i*13} -50`} stroke="url(#line-light)" strokeWidth=".7"/>)}</svg><div className="card-grain"/><div className="card-light"/></div>
        <div className="card-top"><span className="card-wordmark">neylo<span className="brand-dot" aria-hidden="true">•</span></span><span className="eyebrow">EARLY ACCESS</span></div>
        <div className="card-identity"><span className={`card-handle ${title.length>14?'handle-long':title.length>10?'handle-medium':''}`}>@{title}</span><span className="card-subtitle">{state==='reserved'?'Handle reserved':'Your money address'}</span></div>
        <div className="card-bottom"><div><span className="card-label">{state==='reserved'?'Launch credit reserved':offerAvailable?'Welcome offer':'Early-access identity'}</span><motion.span key={state==='reserved'?totalMinor:'preview'} className="card-credit" initial={{opacity:.65}} animate={{opacity:1}} transition={{duration:reduced?0:.25}}>{state==='reserved'?formatCredit(totalMinor):offerAvailable?'100 KM':'neylo.xyz'}</motion.span></div><div className="card-signature"><span className="card-status"><span className="status-dot"/>{state==='reserved'?'Reserved':state==='held'?'Held while you verify':'Preview'}</span><span className="card-domain">neylo.xyz</span></div></div>
      </motion.section>
    </div>
  </div>;
}
