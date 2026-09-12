'use client';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { ArrowRight,LockKeyhole } from 'lucide-react';
import { z } from 'zod';
import { request,okSchema } from '@/lib/client';
import { VerificationCode } from './verification-code';
export function SigninForm({configured,next="/account"}:{configured:boolean;next?:string}){
  const [phase,setPhase]=useState<'email'|'code'>('email'),[email,setEmail]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const codeInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(phase==='code')codeInput.current?.focus();},[phase]);
  async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{if(phase==='email'){await request('auth/signin',okSchema,{email});setPhase('code');}else{await request('auth/verify',z.object({complete:z.boolean()}),{email,code});window.location.assign(next);}}catch(e){setError(e instanceof Error?e.message:'Connection interrupted. Retry safely.');}finally{setBusy(false);}}
  return <main className="auth-page" id="main">
    <div className="auth-symbol"><LockKeyhole size={25}/></div>
    <p className="eyebrow">{phase==='code'?'CHECK YOUR EMAIL':'GOOD TO SEE YOU AGAIN'}</p>
    <h1>{phase==='code'?'Check your inbox.':'Your name is waiting.'}</h1>
    <p>{phase==='code'?<>If an account exists for <strong className="verification-email">{email}</strong>, we’ve sent a six-digit sign-in code.</>:'Sign in with your verified email to return to your NEYLO account.'}</p>
    <form onSubmit={submit}>
      {phase==='email'?<div className="field"><label htmlFor="signin-email">Email</label><input id="signin-email" type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div>:
        <div className="field"><div className="otp-label"><label htmlFor="signin-code">Verification code</label><span>6 digits</span></div><VerificationCode inputRef={codeInput} id="signin-code" value={code} onChange={setCode} describedBy="signin-code-help signin-error" invalid={Boolean(error)} busy={busy}/><p className="otp-help" id="signin-code-help">You can paste the whole code.</p></div>}
      <p id="signin-error" role="alert" className="form-error">{error}</p>
      <button className="button primary" disabled={!configured||busy}>{busy?'One moment…':phase==='email'?'Send sign-in code':'Verify & sign in'}<ArrowRight size={18}/></button>
      {!configured&&<p className="notice">Sign-in is being configured. Please check back soon.</p>}
      {phase==='code'&&<button type="button" className="text-button" onClick={()=>{setPhase('email');setCode('');setError('');}}>Change email or request a new code</button>}
    </form><p className="small-copy">New here? <Link href="/">Reserve your @handle</Link></p>
  </main>;
}
