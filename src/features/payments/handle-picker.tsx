'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { Landmark, Search } from 'lucide-react';
import { request, RequestError } from '@/lib/client';
import { handleLookupSchema, recipientSchema, type HandleRecipient } from './receiving-domain';

export const previewRecipient: HandleRecipient = {handle:'nadin',accountName:'Example Recipient',bankName:'Example bank',last4:'8494',version:'31b811bf-54ba-4b86-a9e4-bd8e06275471',verification:'self_declared',currency:'BAM',bankCountry:'BA'};
export const previewRecipients:Record<string,HandleRecipient>={nadin:previewRecipient,alex:{...previewRecipient,handle:'alex',accountName:'Example Euro Recipient',bankName:'Example German bank',last4:'3000',currency:'EUR',bankCountry:'DE'},maya:{...previewRecipient,handle:'maya',accountName:'Example Sterling Recipient',bankName:'Example UK bank',last4:'6819',currency:'GBP',bankCountry:'GB'}};
export function HandlePicker({selected,onSelect,preview=false}:{selected:HandleRecipient|null;onSelect:(value:HandleRecipient|null)=>void;preview?:boolean}) {
  const [handle,setHandle]=useState(selected?.handle??''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const sequence=useRef(0);
  useEffect(()=>()=>{sequence.current++;},[]);
  async function find(){const input=handleLookupSchema.safeParse({handle});if(!input.success){setError('Enter an exact username using 3–20 letters, numbers or underscores.');return;}const current=++sequence.current;setBusy(true);setError('');onSelect(null);try{const result=preview?{recipient:previewRecipients[input.data.handle]??null}:await request('payments/recipient',z.object({recipient:recipientSchema.nullable()}),input.data);if(current!==sequence.current)return;if(!result.recipient)setError('No receiving account is available for that username. Ask them to enable it in their account.');onSelect(result.recipient);}catch(e){if(current===sequence.current)setError(e instanceof RequestError?e.message:'Could not find the recipient.');}finally{if(current===sequence.current)setBusy(false);}}
  return <div className="pay-fields"><label htmlFor="pay-handle">Recipient’s username<div className="pay-handle-field"><span aria-hidden="true">@</span><input id="pay-handle" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={21} placeholder={preview?'Try nadin, alex or maya':'their_username'} value={handle} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void find();}}} onChange={e=>{sequence.current++;setBusy(false);setHandle(e.target.value.replace(/^@/,''));setError('');onSelect(null);}}/></div></label>
    <button type="button" className="pay-secondary pay-full" disabled={busy} onClick={find}><Search size={16}/>{busy?'Finding recipient…':'Find recipient'}</button>
    {error&&<p className="pay-error" role="alert">{error} {!preview&&<Link href="/signin?next=/pay">Sign in</Link>}</p>}
    {selected&&<div className="pay-found"><div className="pay-person"><span className="pay-avatar">{selected.accountName.slice(0,1)}</span><div><strong>@{selected.handle}</strong><p>{selected.accountName}</p></div></div><details className="pay-faq"><summary>Receiving route · {selected.currency} bank account</summary><p><Landmark size={14}/> {selected.bankName} · ending {selected.last4}</p><p>Details supplied by the recipient. Ownership is not bank-verified. We fill the bank instructions after your review. You still authorize separately in your bank.</p></details></div>}
    <p className="pay-field-help">No account numbers to type. Signed-in users can find accounts whose owners have enabled username lookup.</p><Link className="pay-support" href="/account/receiving">Set up your own receiving account →</Link>
  </div>;
}
