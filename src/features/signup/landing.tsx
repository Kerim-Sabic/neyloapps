'use client';
import { useCallback,useState } from 'react';
import { useRouter } from 'next/navigation';
import { IdentityCard } from '@/features/card/identity-card';
import { ClaimForm } from './claim-form';
import { AccountView } from '@/features/account/account-view';
import type { Account,Campaign,Invitation } from '@/lib/domain';

export function Landing({campaign,ready,invitation,initialEmail,source='direct',campaignTag='',support}:{campaign:Campaign|null;ready:boolean;invitation?:Invitation;initialEmail?:string;source?:string;campaignTag?:string;support:string|null}){
  const router=useRouter();
  const [handle,setHandle]=useState(''),[held,setHeld]=useState(false),[focused,setFocused]=useState(false),[completed,setCompleted]=useState<Account|null>(null);
  const onHeld=useCallback((value:boolean)=>setHeld(value),[]);
  function complete(account:Account){setCompleted(account);router.replace('/account');router.refresh();window.scrollTo({top:0,behavior:'instant'});}
  if(completed)return <AccountView initial={completed} support={support} justReserved/>;
  return <main id="main" className="landing"><section className={`hero ${focused?'form-focused':''}`}>
    <div className="hero-card"><IdentityCard handle={handle} state={held?'held':'preview'} variant="waitlist" quiet={focused||held}/></div>
    <div className="hero-copy">{invitation&&<p className="invitation-note">An invitation from <strong>@{invitation.handle}</strong></p>}
      <h1>Your name.<br/><span>Your money address.</span></h1><p className="hero-description">We’re building a simpler way to send and receive money.<br className="desktop-break"/> Join the waitlist and reserve your @handle.</p>
    </div>
    <ClaimForm handle={handle} setHandle={setHandle} onHeld={onHeld} onFocus={setFocused} onComplete={complete} campaign={campaign} ready={ready} invitation={invitation} initialEmail={initialEmail} source={source} campaignTag={campaignTag}/>
  </section>
  <section className="faq waitlist-faq" aria-label="Questions, answered"><details><summary>What happens when I join?</summary><p>Choose your handle and verify your email. Your NEYLO identity is then reserved in your account, ready for what comes next.</p></details><details><summary>Can I send money with NEYLO today?</summary><p>Not yet. NEYLO is in early access. Joining reserves your identity before launch; financial services will have their own availability and eligibility requirements.</p></details><details><summary>Can I invite someone?</summary><p>Yes. Once your account is complete, you can share your personal invitation link or QR code so your people can join you on the waitlist.</p></details></section>
  </main>;
}
