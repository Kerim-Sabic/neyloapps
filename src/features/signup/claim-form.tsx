'use client';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { ArrowRight,Check,LockKeyhole } from 'lucide-react';
import { z } from 'zod';
import { accountSchema,handleSchema,pendingSchema,type Account,type Campaign,type Invitation } from '@/lib/domain';
import { request,RequestError,okSchema } from '@/lib/client';
import { VerificationCode } from './verification-code';

type Phase={kind:'details'}|{kind:'code';expiresAt:string}|{kind:'recover'};
type Props={handle:string;setHandle:(value:string)=>void;onHeld:(held:boolean)=>void;onFocus:(focused:boolean)=>void;onComplete:(account:Account)=>void;campaign:Campaign|null;ready:boolean;invitation?:Invitation;initialEmail?:string;source:string;campaignTag:string};
const startResult=z.discriminatedUnion('kind',[z.object({kind:z.literal('code'),handle:z.string(),expiresAt:z.string(),termsVersion:z.string()}),z.object({kind:z.literal('complete'),account:accountSchema})]);
export function ClaimForm({handle,setHandle,onHeld,onFocus,onComplete,campaign,ready,invitation,initialEmail='',source,campaignTag}:Props){
  const [email,setEmail]=useState(initialEmail),[code,setCode]=useState(''),[accepted,setAccepted]=useState(false),[phase,setPhase]=useState<Phase>({kind:'details'});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[availability,setAvailability]=useState(''),[cooldown,setCooldown]=useState(0);
  const timeout=useRef<ReturnType<typeof setTimeout>|null>(null),sequence=useRef(0),key=useRef('');const codeInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{key.current=crypto.randomUUID();return()=>{if(timeout.current)clearTimeout(timeout.current);};},[]);
  useEffect(()=>{if(cooldown<=0)return;const timer=setTimeout(()=>setCooldown(cooldown-1),1000);return()=>clearTimeout(timer);},[cooldown]);
  useEffect(()=>{if(phase.kind==='code')codeInput.current?.focus();},[phase.kind]);
  useEffect(()=>{
    if(!ready)return;let active=true;
    request('signup/pending',z.object({pending:pendingSchema.nullable()})).then(({pending})=>{
      if(!active||!pending||pending.finalized)return;setEmail(pending.email);setHandle(pending.handle);setAccepted(pending.termsVersion===campaign?.version);
      if(pending.termsVersion!==campaign?.version){setPhase({kind:'details'});onHeld(false);return;}
      if(Date.parse(pending.expiresAt)>Date.now()){setPhase({kind:'code',expiresAt:pending.expiresAt});onHeld(true);}else setPhase({kind:'recover'});
    }).catch(()=>{});return()=>{active=false;};
  },[ready,setHandle,onHeld,campaign?.version]);
  function changeHandle(value:string){
    const normalized=value.replace(/^@/,'').toLowerCase();setHandle(normalized);setAvailability('');const version=++sequence.current;
    if(timeout.current)clearTimeout(timeout.current);const parsed=handleSchema.safeParse(normalized);if(!parsed.success||!ready)return;
    timeout.current=setTimeout(async()=>{try{const result=await request(`handle?handle=${encodeURIComponent(parsed.data)}`,z.object({available:z.boolean()}));if(version===sequence.current)setAvailability(result.available?'Available to claim':'Already held or reserved');}catch{if(version===sequence.current)setAvailability('Availability will be checked when you claim.');}},400);
  }
  function showError(err:unknown){
    setError(err instanceof Error?err.message:'Connection interrupted. Please retry.');
    if(err instanceof RequestError&&err.code==='TERMS_CHANGED'){setPhase({kind:'details'});setAccepted(false);onHeld(false);setCode('');}
    if(err instanceof RequestError && err.code==='HOLD_EXPIRED'){setPhase({kind:'recover'});onHeld(false);setCode('');}
  }
  async function submit(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try{
      if(phase.kind==='code'){const result=await request('signup/verify',z.object({account:accountSchema}),{code,key:key.current});onComplete(result.account);return;}
      const result=await request('signup/start',startResult,{handle,email,accepted,termsVersion:campaign?.version,invitation:invitation?.code,source,campaignTag,offerDisplayed:false});
      if(result.kind==='complete'){onComplete(result.account);return;}setPhase({kind:'code',expiresAt:result.expiresAt});onHeld(true);setCooldown(60);
    }catch(err){
      showError(err);
      if(phase.kind!=='code'&&err instanceof RequestError&&(err.code==='EMAIL_UNAVAILABLE'||err.code==='RATE_LIMITED')){
        const recovered=await request('signup/pending',z.object({pending:pendingSchema.nullable()})).catch(()=>null);
        const pending=recovered?.pending;
        if(pending&&!pending.finalized&&Date.parse(pending.expiresAt)>Date.now()){
          setPhase({kind:'code',expiresAt:pending.expiresAt});onHeld(true);
          setCooldown(pending.lastOtpAt?Math.max(0,Math.ceil((Date.parse(pending.lastOtpAt)+60000-Date.now())/1000)):0);
        }
      }
    }finally{setBusy(false);}
  }
  async function resend(){setBusy(true);setError('');try{await request('signup/resend',okSchema,{});setCooldown(60);}catch(err){showError(err);}finally{setBusy(false);}}
  async function resume(){setBusy(true);setError('');try{const account=await request('signup/finalize',accountSchema,{key:key.current});onComplete(account);}catch(err){showError(err);}finally{setBusy(false);}}
  return <form className="claim-form" onSubmit={submit} onFocusCapture={()=>onFocus(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))onFocus(false);}} aria-label="Join the NEYLO waitlist">
    {!ready&&<div className="notice" role="status"><span className="status-dot"/>Preview · Reservations open soon. You can try your handle below.</div>}
    {phase.kind==='code'?<div className="verification-fields"><div className="verification-title"><span className="step-mark"><LockKeyhole size={18}/></span><h2>One last step.</h2><p>Enter the six-digit code sent to<br/><strong>{email}</strong></p></div><div className="otp-label"><label htmlFor="code">Verification code</label><span>6 digits</span></div><VerificationCode inputRef={codeInput} id="code" value={code} onChange={setCode} describedBy="code-help form-error" invalid={Boolean(error)} busy={busy}/><p id="code-help" className="otp-help">You can paste the whole code.</p><p className="hold-note">Your handle is held for 15 minutes. Verify your email to join the waitlist.</p></div>:
    <><div className="field"><label htmlFor="handle">Your handle</label><div className="input-wrap"><span className="input-prefix" aria-hidden="true">@</span><input id="handle" name="handle" value={handle} onChange={e=>changeHandle(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} minLength={3} pattern="[a-zA-Z0-9_]{3,20}" placeholder="yourname" required aria-describedby="handle-help form-error"/><span className="availability-mark" aria-hidden="true">{availability==='Available to claim'&&<Check size={17}/>}</span></div><p id="handle-help" className="field-help" aria-live="polite">{availability||'3–20 letters, numbers, or underscores.'}</p></div><div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" value={email} readOnly={Boolean(initialEmail)||phase.kind==='recover'} onChange={e=>setEmail(e.target.value)} required aria-describedby="form-error"/></div>
    <label className="checkbox-row"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} required disabled={!ready}/><span>I agree to the <Link href="/terms" target="_blank">terms</Link> and <Link href="/privacy" target="_blank">privacy notice</Link>{campaign?.region?`, and confirm I’m ${campaign.minimumAge} or older`:''}.</span></label></>}
    <p id="form-error" className="form-error" role="alert">{error}</p>
    <button className="button primary" type="submit" disabled={busy||!ready} aria-busy={busy}>{busy?'One moment…':phase.kind==='code'?'Verify & join the waitlist':phase.kind==='recover'?'Finish joining the waitlist':ready?'Join the waitlist':'Reservations open soon'}{!busy&&<ArrowRight size={18} aria-hidden="true"/>}</button>
    {phase.kind==='code'?<div className="code-actions"><button className="text-button" type="button" disabled={busy||cooldown>0} onClick={resend}>{cooldown>0?`Resend code in ${cooldown}s`:'Send a new code'}</button><button className="text-button" type="button" disabled={busy} onClick={resume}>Already verified? Finish account</button></div>:<p className="form-note"><LockKeyhole size={13} aria-hidden="true"/>No password. Verify your email to secure your place.</p>}
  </form>;
}
