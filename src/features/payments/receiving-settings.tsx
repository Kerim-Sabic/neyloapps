'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { ArrowLeft, Landmark, ShieldCheck } from 'lucide-react';
import { request, RequestError } from '@/lib/client';
import { bankChoices, receivingForm, destinationInputSchema, destinationSchema, type ReceivingDestination } from './receiving-domain';
import './payments.css';
import { BankCountryField, CurrencyField, UnavailableFormat } from './route-fields';
import { isBankCountry, suggestedCurrency, type Currency } from './international';

const responseSchema = z.object({destination:destinationSchema.nullable()});
const empty = { accountName:'',iban:'',bankName:'',bic:'',discoverable:false,bankCountry:'BA',currency:'BAM' as Currency };
export function ReceivingSettings({handle}:{handle:string}) {
  const [data,setData]=useState(empty),[saved,setSaved]=useState<ReceivingDestination|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[remove,setRemove]=useState(false),[ready,setReady]=useState(false);
  async function load() {
    setLoading(true);setError('');
    try {const result=await request('account/receiving',responseSchema);setSaved(result.destination);setData(result.destination?receivingForm(result.destination):empty);setReady(true);}
    catch(e){setReady(false);setError(e instanceof RequestError?e.message:'Could not load your receiving account.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function save() {
    setError('');setMessage('');
    const parsed=destinationInputSchema.safeParse({...data,version:saved?.version??null});
    if(!parsed.success){setError(parsed.error.issues[0]?.message??'Check the account details.');return;}
    setBusy(true);
    try {const result=await request('account/receiving',responseSchema,parsed.data);setSaved(result.destination);setData(result.destination?receivingForm(result.destination):empty);setMessage(parsed.data.discoverable?`Linked to @${handle}. Ownership is self-declared, not bank-verified.`:'Saved privately. Other users cannot find this receiving route.');}
    catch(e){setError(e instanceof RequestError?e.message:'Could not save.');}finally{setBusy(false);}
  }
  async function removeAccount(){if(!saved)return;setBusy(true);setError('');try{await request('account/receiving/remove',responseSchema,{version:saved.version});setData(empty);setSaved(null);setRemove(false);setMessage('Receiving account removed. Your username is unchanged.');}catch(e){setError(e instanceof RequestError?e.message:'Could not remove.');}finally{setBusy(false);}}
  return <main id="main" className="payment-workspace receiving-page"><Link className="pay-support" href="/account"><ArrowLeft size={16}/>Your account</Link><header className="pay-intro"><p className="pay-eyebrow">YOUR NAME IS THE ADDRESS</p><h1>Your bank.<br/><span>Behind @{handle}.</span></h1><p>Add your receiving details once. Friends look you up by username.</p></header>
    <section className="pay-card pay-step"><div className="pay-step-heading"><span className="pay-step-icon"><Landmark size={22}/></span><h2>Where should money arrive?</h2><p>One personal receiving account, linked to your name. Start with Bosnia or choose another supported bank country.</p></div>
      {loading&&<p role="status">Loading your account…</p>}{error&&<p className="pay-error" role="alert">{error} <Link href="/signin">Sign in again</Link> or <button className="pay-text" onClick={load}>reload saved details</button>.</p>}
      {!loading&&<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||!ready} className="pay-settings-fields pay-fields">
        <BankCountryField value={data.bankCountry} onChange={bankCountry=>setData({...data,bankCountry,iban:'',bic:'',bankName:'',currency:isBankCountry(bankCountry)?suggestedCurrency(bankCountry):'BAM'})}/>
        {!isBankCountry(data.bankCountry)&&<UnavailableFormat/>}
        <CurrencyField value={data.currency} onChange={currency=>setData({...data,currency})}/>
        <p className="pay-field-help">Choose the currency this account accepts. A country default is only a suggestion; confirm it with your bank. Saving a currency does not enable conversion or transfers.</p>
        <label>Account holder’s full name<input value={data.accountName} maxLength={100} autoComplete="name" onChange={e=>setData({...data,accountName:e.target.value})}/></label>
        {data.bankCountry==='BA'?<label>Bank<select value={bankChoices.includes(data.bankName as typeof bankChoices[number])?data.bankName:data.bankName?'Other bank':''} onChange={e=>setData({...data,bankName:e.target.value})}><option value="">Choose your bank</option>{bankChoices.map(bank=><option key={bank}>{bank}</option>)}</select></label>:<label>Bank’s legal name<input value={data.bankName} maxLength={100} onChange={e=>setData({...data,bankName:e.target.value})}/></label>}
        {data.bankCountry==='BA'&&(data.bankName==='Other bank'||data.bankName&&!bankChoices.includes(data.bankName as typeof bankChoices[number]))&&<label>Bank’s legal name<input value={data.bankName==='Other bank'?'':data.bankName} maxLength={100} onChange={e=>setData({...data,bankName:e.target.value||'Other bank'})}/></label>}
        <label>IBAN<input value={data.iban} autoComplete="off" spellCheck={false} maxLength={50} placeholder="As provided by your bank" onChange={e=>setData({...data,iban:e.target.value})}/></label>
        <details className="pay-faq"><summary>Additional bank details</summary><label>SWIFT / BIC <span className="pay-optional">If provided by your bank</span><input value={data.bic} autoComplete="off" maxLength={11} placeholder="8 or 11 characters" onChange={e=>setData({...data,bic:e.target.value.toUpperCase()})}/></label><p>Copy this from your bank if provided. Your sending bank may require additional beneficiary or intermediary information for a cross-border transfer. These saved details are not a complete international payment order.</p></details>
        <label className="pay-confirm"><input type="checkbox" checked={data.discoverable} onChange={e=>setData({...data,discoverable:e.target.checked})}/><span>Allow signed-in Neylo users who know my exact @handle to see my account name, bank and masked account, and retrieve my full bank instructions when preparing a payment. I confirm this is my own receiving account.</span></label>
        <p className="pay-field-help">Your details are stored with your account. They are not published on an open profile. A valid IBAN does not verify account ownership. Saving or changing a destination requires a sign-in within the last 10 minutes.</p>
        <button className="pay-primary pay-full" type="submit" disabled={!isBankCountry(data.bankCountry)}>{busy?'Saving…':saved?'Update receiving account':`Link to @${handle}`}</button>
      </fieldset></form>}
      <p className="pay-live-notice" role="status">{message}</p>
      {saved&&(remove?<div className="pay-note"><p>Remove this receiving account? This stops new lookups but cannot revoke instructions someone already downloaded.</p><button className="pay-text" disabled={busy} onClick={removeAccount}>Remove account</button><button className="pay-text" onClick={()=>setRemove(false)}>Keep account</button></div>:<button className="pay-text" onClick={()=>setRemove(true)}>Remove receiving account</button>)}
    </section><div className="pay-assurance"><ShieldCheck size={20}/><p>This links instructions to your username. Neylo cannot yet verify bank ownership, debit your account or execute transfers.</p></div><Link className="pay-support" href="/pay">Prepare a payment →</Link>
  </main>;
}
