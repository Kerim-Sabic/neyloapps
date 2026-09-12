'use client';
import { useCallback,useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
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
  const hasOffer=campaign?campaign.remaining>0:true;
  return <main id="main" className="landing"><section className={`hero ${focused?'form-focused':''}`}>
    <div className="hero-card"><IdentityCard handle={handle} state={held?'held':'preview'} offerAvailable={hasOffer} quiet={focused||held}/></div>
    <div className="hero-copy">{invitation&&<p className="invitation-note">An invitation from <strong>@{invitation.handle}</strong>{invitation.mayEarn&&<span>They may receive 50 KM in launch fee credits when you complete an eligible signup.</span>}</p>}
      <h1>Your name.<br/><span>Your money address.</span></h1><p className="hero-description">We’re building a simpler way to send and receive money.<br className="desktop-break"/> Reserve your @handle before launch.</p>
      <p className="offer-line">{hasOffer?<>Get <strong>100 KM</strong> in NEYLO credits.</>:<>Your name is still yours to reserve.</>}</p>
    </div>
    <ClaimForm handle={handle} setHandle={setHandle} onHeld={onHeld} onFocus={setFocused} onComplete={complete} campaign={campaign} ready={ready} invitation={invitation} initialEmail={initialEmail} source={source} campaignTag={campaignTag}/>
    <p className="offer-terms">{hasOffer?'For the first 100 eligible verified founding accounts.':'All 100 founding credit places have been allocated.'}<br/>Promotional launch fee credits—not cash. Reserved for eligible NEYLO service fees when available. <Link href="/terms">Terms apply.</Link></p>
  </section>
  <section className="referral-intro" aria-labelledby="referral-heading"><p className="eyebrow">BETTER WITH YOUR PEOPLE</p><h2 id="referral-heading">Invite a friend.<br/>Get <span>50 KM</span> more.</h2><p>After you reserve your handle, share your personal invitation. A friend’s eligible verified signup earns you another 50 KM in launch fee credits.</p><p className="small-copy">For eligible founding accounts. First three qualifying friends.<br/>100 + 50 + 50 + 50 = <strong>250 KM maximum.</strong></p><a className="inline-link" href="#handle">Make a name for yourself <ArrowUpRight size={16}/></a></section>
  <section className="faq" aria-label="Questions, answered"><details><summary>What can I use the credits for?</summary><p>Eligible NEYLO service fees when the service becomes available. Credits are not cash, cannot be withdrawn or transferred, and cannot be spent today. Third-party bank, network, and FX charges are excluded unless the published terms say otherwise.</p></details><details><summary>Can I send money with NEYLO today?</summary><p>Not yet. This is early access. Your handle is a reservation within NEYLO and your card is an identity card. It is not an issued payment card or a functioning payment address.</p></details><details><summary>When does an invitation earn a reward?</summary><p>When an eligible new friend verifies their email and completes their account. Sharing, copying, or opening a link earns no credit. Eligible founding accounts can earn three referral awards. Verification confirms inbox access, not a unique person; eligibility checks and abuse review apply.</p></details></section>
  </main>;
}
