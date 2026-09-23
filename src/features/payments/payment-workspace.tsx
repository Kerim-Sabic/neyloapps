'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronRight, Copy, Download, FileText, Landmark, LockKeyhole, ShieldCheck, UserRound, X } from 'lucide-react';
import { bam, createPlan, formattedIban, instructions, parseBam, reportSent, validBosnianIban, validName, validNote, type PaymentPlan, type PlanStatus } from './domain';
import './payments.css';
import { z } from 'zod';
import { request, RequestError } from '@/lib/client';
import { HandlePicker } from './handle-picker';
import { destinationSchema, type HandleRecipient } from './receiving-domain';

const STEPS = ['Recipient', 'Amount', 'Review', 'Your bank'] as const;
const initialForm = { name: '', iban: '', amount: '', note: '' };

export function PaymentWorkspace({preview=false}:{preview?:boolean}) {
  const [mode,setMode]=useState<'handle'|'manual'>('handle');
  const [recipient,setRecipient]=useState<HandleRecipient|null>(null);
  const [preparing,setPreparing]=useState(false);
  const prepareLock=useRef(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [verifiedByUser, setVerifiedByUser] = useState(false);
  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [status, setStatus] = useState<PlanStatus>('prepared');
  const [reportConfirm, setReportConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLParagraphElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copySequence = useRef(0);
  const reducedMotion = useReducedMotion();
  const amount = parseBam(form.amount);
  const recipientReady = mode==='handle' ? Boolean(recipient) : validName(form.name) && validBosnianIban(form.iban);
  const hasDraft = Boolean(form.name || form.iban || form.amount || form.note);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);
  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  function go(next: number) {
    setError(''); setNotice(''); setCopied(''); setResetConfirm(false);
    copySequence.current++;
    setStep(next);
  }
  function focusStep() {
    const title = heading.current;
    if (!title) return;
    title.focus({ preventScroll: true });
    if (title.getBoundingClientRect().top < 24) title.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' });
  }
  async function advance() {
    if(prepareLock.current)return;
    if (step === 0 && !recipientReady) {
      setError(mode==='handle'?'Find and select a recipient by username first.':'Enter the recipient’s full name and a valid Bosnian IBAN. Ask them for the account details directly.'); return;
    }
    if (step === 1 && (amount === null || !validNote(form.note))) {
      setError('Enter an amount from 1.00 to 100.00 BAM, with at most two decimal places, and a purpose of up to 100 characters.'); return;
    }
    if (step === 2) {
      if (!verifiedByUser) { setError('Confirm that you checked the recipient and bank details before preparing instructions.'); return; }
      try {
        prepareLock.current=true;setPreparing(true);
        let input=form;
        let bankName:string|undefined,bic:string|undefined;
        if(mode==='handle'&&recipient){
          const result=preview?{destination:{accountName:recipient.accountName,iban:'BA391290079401028494',bankName:recipient.bankName,bic:''}}:await request('payments/recipient/prepare',z.object({destination:destinationSchema}),{handle:recipient.handle,version:recipient.version});
          input={...form,name:result.destination.accountName,iban:result.destination.iban};
          bankName=result.destination.bankName;bic=result.destination.bic;
        }
        setPlan({...createPlan(input, crypto.randomUUID(), new Date().toISOString()),...(recipient&&mode==='handle'?{recipientHandle:recipient.handle,bankName,bic}:{})});
        setStatus('prepared'); setReportConfirm(false);
      } catch(e) { setError(e instanceof RequestError?e.message:'We could not prepare this payment. Look up the recipient again.'); return; }
      finally{prepareLock.current=false;setPreparing(false);}
    }
    go(step + 1);
  }
  function reset() {
    if(prepareLock.current)return;
    setRecipient(null);
    setForm(initialForm); setPlan(null); setStatus('prepared'); setVerifiedByUser(false);
    setReportConfirm(false); go(0);
  }
  async function copy(value: string, label: string) {
    const operation = ++copySequence.current;
    try {
      await navigator.clipboard.writeText(value);
      if (operation !== copySequence.current) return;
      setCopied(label); setNotice(`${label} copied. Check the pasted details in your bank app.`);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(''), 2500);
    } catch {
      if (operation === copySequence.current) setNotice('Copy is unavailable. Select the visible text or download the payment plan.');
    }
  }
  function download() {
    if (!plan) return;
    const url = URL.createObjectURL(new Blob([instructions(plan, status)], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `neylo-payment-plan-${plan.id}.txt`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Payment plan downloaded. It contains bank details; keep it private. It is not proof of payment.');
  }

  return <MotionConfig reducedMotion="user"><main id="main" className="payment-workspace">
    {preview&&<p className="pay-error" role="note">DESIGN PREVIEW · Example @nadin and bank details only. Do not send money to these details. No account is connected.</p>}
    <div className="pay-topline"><Link href="/account"><ArrowLeft size={15} aria-hidden="true"/>Your account</Link><span><span className="pay-status-dot"/>Bank payment planner</span></div>
    <header className="pay-intro"><p className="pay-eyebrow">A NAME. NOT A NUMBER.</p><h1>From you.<br/><span>To @someone.</span></h1><p>Choose a username. Their saved bank details fill the instructions for you.</p></header>
    <div className="pay-layout">
      <section className="pay-card" aria-label="Prepare a bank payment">
        <ol className="pay-progress" aria-label="Payment preparation steps">{STEPS.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} data-active={step === index} data-done={step > index}><span>{step > index ? <Check size={13} aria-hidden="true"/> : index + 1}</span><span>{label}</span></li>)}</ol>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div className="pay-step" key={step} initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -6 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }} onAnimationComplete={focusStep}>
            <div className="pay-step-heading"><span className="pay-step-icon" aria-hidden="true">{step === 0 ? <UserRound size={23}/> : step === 1 ? <span>KM</span> : step === 2 ? <ShieldCheck size={23}/> : <Landmark size={23}/>}</span><p className="pay-eyebrow">STEP {step + 1} OF 4</p>
              <h2 ref={heading} tabIndex={-1}>{['Who’s it for?', 'Make it the right amount.', 'One last look.', 'Finish in your bank app.'][step]}</h2>
              <p>{[mode==='handle'?'Just their username. We’ll take care of the details.':'Use the account details your recipient gave you.', 'Small everyday payments, thoughtfully prepared.', 'Confirm the person, the account and the amount.', 'Your instructions are ready. No money has been sent by Neylo.'][step]}</p>
            </div>
            <p className="pay-error" role="alert" ref={errorBox} tabIndex={-1} hidden={!error}>{error}</p>
            {step < 3 ? <form onSubmit={event => { event.preventDefault(); advance(); }} noValidate>
              {step===0&&mode==='handle'&&<HandlePicker preview={preview} selected={recipient} onSelect={value=>{setRecipient(value);setForm({...form,name:value?.accountName??'',iban:''});setVerifiedByUser(false);}}/>}
              {step === 0 && mode==='manual' && <div className="pay-fields">
                <label htmlFor="pay-name">Recipient’s full name<input id="pay-name" autoComplete="off" maxLength={100} value={form.name} placeholder="As shown on their bank account" onChange={e => { setForm({ ...form, name: e.target.value }); setVerifiedByUser(false); }} aria-describedby="recipient-help"/></label>
                <label htmlFor="pay-iban">Bosnian IBAN<input id="pay-iban" className="pay-iban-input" autoComplete="off" spellCheck={false} autoCapitalize="characters" maxLength={30} value={form.iban} placeholder="BA39 ···· ···· ···· ····" onChange={e => { setForm({ ...form, iban: e.target.value }); setVerifiedByUser(false); }} aria-describedby="recipient-help"/></label>
                <p id="recipient-help" className="pay-field-help">We check the account format and checksum only. Neylo cannot verify who owns this account.</p>
                <div className="pay-note"><LockKeyhole size={17} aria-hidden="true"/><p>Your entries stay on this page. We don’t upload or save these bank details. Clear the plan when you’re finished.</p></div>
              </div>}
              {step === 1 && <div className="pay-fields">
                <label htmlFor="pay-amount">Payment amount<div className="pay-amount-field"><input id="pay-amount" inputMode="decimal" autoComplete="off" maxLength={7} value={form.amount} placeholder="0.00" onChange={e => setForm({ ...form, amount: e.target.value })} aria-describedby="amount-help"/><span>BAM</span></div></label>
                <div className="pay-presets" aria-label="Suggested amounts">{[10, 25, 50, 100].map(value => <button key={value} type="button" aria-pressed={amount === value * 100} onClick={() => setForm({ ...form, amount: String(value) })}>{value} BAM</button>)}</div>
                <p id="amount-help" className="pay-field-help">Prepare 1–100 BAM. This is the payment amount, before any fees your bank may charge.</p>
                <label htmlFor="pay-note">Payment purpose <span className="pay-optional">Optional</span><input id="pay-note" autoComplete="off" maxLength={100} value={form.note} placeholder="For example, dinner on Friday" onChange={e => setForm({ ...form, note: e.target.value })}/></label>
              </div>}
              {step === 2 && <div className="pay-fields">
                <div className="pay-review-amount">{amount !== null ? bam(amount) : 'Check amount'}</div>
                <dl className="pay-details"><div><dt>{recipient?'Recipient':'Recipient, entered by you'}</dt><dd>{recipient?`@${recipient.handle}`:form.name}</dd></div>{!recipient&&<div><dt>IBAN</dt><dd className="pay-mono">{formattedIban(form.iban)}</dd></div>}{form.note && <div><dt>Purpose</dt><dd>{form.note}</dd></div>}<div><dt>Neylo planning fee</dt><dd>Free</dd></div><div><dt>Bank fees & arrival</dt><dd>Check in your bank app</dd></div><div><dt>Recipient net amount</dt><dd>Not confirmed; bank fees may apply</dd></div></dl>
                {recipient&&<details className="pay-faq"><summary>View receiving route</summary><p>{recipient.accountName} · {recipient.bankName} · account ending {recipient.last4}</p><p>Recipient-supplied, not bank-verified. Full instructions are filled automatically after you confirm.</p></details>}
                <label className="pay-confirm"><input type="checkbox" disabled={preparing} checked={verifiedByUser} onChange={e => setVerifiedByUser(e.target.checked)}/><span>{recipient?`I checked that @${recipient.handle} is the person I intend to pay. Their bank details are self-declared. Neylo will not send this payment.`:'I checked the recipient and account details through a trusted channel. I understand that Neylo will not send this payment.'}</span></label>
              </div>}
              <div className="pay-actions">{step > 0 && <button type="button" disabled={preparing} className="pay-back" onClick={() => go(step - 1)}><ArrowLeft size={17} aria-hidden="true"/>Back</button>}<button type="submit" disabled={preparing} className="pay-primary">{preparing?'Filling bank details…':step === 2 ? 'Prepare bank instructions' : step === 1 ? 'Review payment' : 'Continue'}<ArrowRight size={18} aria-hidden="true"/></button></div>
              {step===0&&!preview&&<button type="button" className="pay-text" onClick={()=>{setMode(mode==='handle'?'manual':'handle');setRecipient(null);setForm(initialForm);setError('');setVerifiedByUser(false);}}>{mode==='handle'?'Use bank details instead':'Use a username instead'}</button>}
              <p className="pay-action-help">{step === 2 ? 'Preparing instructions does not authorize a transfer.' : 'No money moves while you prepare.'}</p>
            </form> : plan && <div>
              <div className="pay-report" data-reported={status === 'reported_sent'}><FileText size={20} aria-hidden="true"/><div><strong>{preview?'Example instructions · do not send':status === 'reported_sent' ? 'You marked this as sent' : 'Prepared · not sent'}</strong><p>{status === 'reported_sent' ? 'This is your own record. Neylo has not confirmed the payment with your bank or the recipient.' : preview?'These are demonstration details, not a real recipient.':'Open your bank app separately and review its fees before authorizing.'}</p></div></div>
              <dl className="pay-copy-details">
                {[['Recipient name', plan.recipient.name], ...(plan.bankName?[['Bank',plan.bankName]]:[]),['IBAN', formattedIban(plan.recipient.iban)], ['Domestic account', plan.recipient.iban.slice(4)], ...(plan.bic?[['SWIFT / BIC',plan.bic]]:[]),['Amount (BAM)', (plan.amountMinor / 100).toFixed(2)], ...(plan.note ? [['Purpose', plan.note]] : [])].map(([label = '', value = '']) => <div key={label}><dt>{label}</dt><dd><span>{value}</span><button type="button" aria-label={`Copy ${label.toLowerCase()}`} onClick={() => copy(label === 'IBAN' ? plan.recipient.iban : value, label)}>{copied === label ? <Check size={16} aria-hidden="true"/> : <Copy size={16} aria-hidden="true"/>}</button></dd></div>)}
              </dl>
              <p className="pay-field-help">Use IBAN or the domestic account number as required by your bank. Confirm any additional fields with the recipient. This is not an instant-payment guarantee.</p>
              <div className="pay-bank-steps"><p><span>1</span>Enter these details in your bank’s payment form.</p><p><span>2</span>Review the recipient, fees and timing. Authorize there.</p><p><span>3</span>Keep the bank’s receipt and confirm arrival with your recipient.</p></div>
              <button type="button" className="pay-secondary pay-full" disabled={preview} onClick={download}><Download size={17} aria-hidden="true"/>Download payment plan</button>
              <p className="pay-action-help">Contains bank details. Not a payment receipt.</p>
              {status === 'prepared' ? <div className="pay-report-action"><label className="pay-confirm"><input type="checkbox" checked={reportConfirm} onChange={e => setReportConfirm(e.target.checked)}/><span>I have already authorized this payment in my bank app.</span></label><button type="button" className="pay-secondary pay-full" disabled={preview||!reportConfirm} onClick={() => { setStatus(reportSent(status)); setNotice('Marked as sent by you. Bank confirmation is unavailable.'); }}><CheckCheck size={17} aria-hidden="true"/>Mark as sent by me</button></div> : <button type="button" className="pay-text" onClick={() => { setStatus('prepared'); setReportConfirm(false); setNotice('Your personal status was reset. This does not cancel or reverse a bank payment.'); }}>Undo my status · does not cancel a transfer</button>}
              <p className="pay-duplicate-note">Already tried to pay? Check your bank’s history before sending again.</p>
            </div>}
          </motion.div>
        </AnimatePresence>
        <div className="pay-live-notice" role="status" aria-live="polite">{notice}</div>
      </section>
      <aside className="pay-aside" aria-label="Payment summary">
        <div className="pay-summary"><div className="pay-summary-top"><span className="pay-eyebrow">YOUR PAYMENT PLAN</span><span className="pay-outline-icon"><Landmark size={18} aria-hidden="true"/></span></div>
          <div className="pay-person"><span className="pay-avatar" aria-hidden="true">{form.name.trim().slice(0, 1).toUpperCase() || <UserRound size={26}/>}</span><div><strong>{recipient?`@${recipient.handle}`:form.name.trim() || 'Someone who matters'}</strong><p>{recipient ? `Account ending ${recipient.last4}` : form.iban ? `Account ending ${form.iban.replace(/\s/g, '').slice(-4)}` : 'Their bank. Their money.'}</p></div></div>
          <p className="pay-summary-amount">{amount !== null ? bam(amount) : '— BAM'}</p><p className="pay-summary-caption">{status === 'reported_sent' ? 'Reported sent · not bank-confirmed' : 'Prepared here. Authorized in your bank.'}</p>
          <div className="pay-rail"><span>Neylo plan</span><span className="pay-rail-line" aria-hidden="true"><ChevronRight size={15}/></span><span>Your bank</span></div>
          <p className="pay-summary-foot">Bank fees and recipient availability are confirmed by your bank, not by this planner.</p>
        </div>
        <div className="pay-assurance"><LockKeyhole size={18} aria-hidden="true"/><div><h3>Your name is the address.</h3><p>Recipients save their bank details once and choose whether to share them by username. This payment plan stays in page memory. No money is held by Neylo.</p></div></div>
        <details className="pay-faq"><summary>Why do I finish in my bank?</summary><p>Integrated transfers are not available yet. Neylo helps you prepare the details; your bank handles authorization and execution. We cannot check the account owner, bank balance, fees or payment status.</p></details>
        <Link className="pay-support" href="/support">Need a hand?<ArrowRight size={15} aria-hidden="true"/></Link>
        {hasDraft && <div className="pay-reset">{resetConfirm ? <div><p>Clear this plan? Unsaved details will be lost. This cannot cancel a bank payment.</p><div><button className="pay-text" onClick={reset}>Yes, clear plan</button><button className="pay-text" onClick={() => setResetConfirm(false)}>Keep plan</button></div></div> : <button className="pay-text" onClick={() => setResetConfirm(true)}><X size={14} aria-hidden="true"/>Clear & start again</button>}</div>}
      </aside>
    </div>
    <div className="pay-bottom"><span>BOSNIA & HERZEGOVINA · BAM</span><span>Thoughtful payments start with clear details.</span></div>
  </main></MotionConfig>;
}
