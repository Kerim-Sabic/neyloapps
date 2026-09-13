'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, Copy, Landmark, Pause, Play, RotateCcw, Search, Settings2, SlidersHorizontal, Volume2, VolumeX, Wallet, X } from 'lucide-react';
import { CONTACTS, contact, PREFERENCES, type Preference, type RecipientId } from './config';
import { currentTransfer, selectedQuote, type Action } from './machine';
import { calculateQuotes, money, rankQuotes, selectionReason, type Quote } from './quote';
import { BottomSheet } from './bottom-sheet';
import { RouteJourney } from './route-journey';
import { useDemo } from './use-demo';
import './demo.css';

export function DemoApp() {
  const app = useDemo();
  const { state, manual } = app;
  const systemReduced = useReducedMotion();
  const reduced = app.reduced || Boolean(systemReduced);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const quote = selectedQuote(state), transfer = currentTransfer(state);
  const person = state.recipient ? contact(state.recipient) : null;
  const phase = state.flow.phase;
  const isEditing = !transfer && phase !== 'reviewing';
  const options = quote ? calculateQuotes(quote.route.recipient, quote.sentMinor, quote.createdAt) : [];
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  useEffect(() => {
    const area = scrollArea.current; if (!area) return;
    if (phase === 'idle' || phase === 'composing') area.scrollTop = 0;
    if (phase !== 'simulating' && phase !== 'completed') return;
    let frame = 0;
    const until = performance.now() + (phase === 'simulating' && state.expanded && !reduced ? 650 : 0);
    const followLayout = () => {
      const target = area.querySelector(phase === 'completed' ? '.demo-transfer-status' : '.demo-journey');
      if (target) area.scrollTo({ top: target.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop - 12, behavior: 'instant' });
      if (performance.now() < until) frame = requestAnimationFrame(followLayout);
    };
    frame = requestAnimationFrame(followLayout);
    return () => cancelAnimationFrame(frame);
  }, [phase, state.expanded, reduced]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => document.querySelector<HTMLElement>('.neylo-demo')?.style.setProperty('--demo-viewport-height', `${viewport?.height ?? innerHeight}px`);
    viewport?.addEventListener('resize', resize); resize();
    return () => viewport?.removeEventListener('resize', resize);
  }, []);
  const action = (event: Action) => { setCopied(false); if (event.type === 'SELECT' || event.type === 'RESET' || event.type === 'BACK') setSearch(''); manual(event); };
  function scenario(recipient: RecipientId) { app.reset(); setSearch(''); action({ type: 'SELECT', recipient }); }
  async function copyReference() {
    manual(); if (!transfer) return;
    try { await navigator.clipboard.writeText(`NEY-${transfer.id.toUpperCase()}`); setCopied(true); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2500); }
    catch { setCopied(false); }
  }

  return <MotionConfig reducedMotion={reduced ? 'always' : 'user'} transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}>
    <main id="main" className="neylo-demo" data-neylo-demo data-reduced={reduced}>
      <div className="demo-stage-brand"><Link href="/" aria-label="NEYLO home">neylo<span>®</span></Link><span>ONE ADDRESS. EVERY JOURNEY.</span></div>
      <div className="demo-stage">
        <aside className="demo-editorial" aria-label="NEYLO introduction"><p className="demo-kicker">MONEY, WITH DIRECTION.</p><h1>Across banks.<br/>Beyond borders.<br/><span>Simply yours.</span></h1><p>From a name to an arrival.<br/>One considered route.</p><div className="demo-editorial-line"/><span className="demo-editorial-note">DESIGNED AROUND PEOPLE</span></aside>
        <div className="demo-device"><div className="demo-device-edge" aria-hidden="true"/><div className="demo-phone">
          <header className="demo-app-header"><button className="demo-wordmark" onClick={() => { app.reset(); setSearch(''); }} aria-label="NEYLO app home">neylo<span>®</span></button><span className="demo-profile"><span>N</span>@noomy</span></header>
          <div className="demo-app-scroll" ref={scrollArea}>
            {!app.storageAvailable && <p className="demo-error" role="status">Saving is unavailable in this browser. Keep this tab open to retain your journey.</p>}
            {state.recipient ? <div className="demo-context"><button className="demo-text-button" onClick={() => action({ type: 'BACK' })} disabled={phase === 'simulating' || phase === 'paused'}><ArrowLeft size={16}/>{phase === 'reviewing' ? 'Route' : phase === 'completed' ? 'Home' : 'People'}</button><span>{phase === 'reviewing' ? 'REVIEW' : transfer ? 'YOUR TRANSFER' : 'SEND MONEY'}</span></div> : <div className="demo-welcome"><p>Good to see you, Noomy</p><h2>Where to next?</h2><p>A name is all you need.</p></div>}
            <motion.section layout="position" className="demo-composer" aria-label="Transfer composer" data-phase={phase}>
              {!person ? <><label className="demo-search"><Search size={19}/><input aria-label="Search people" placeholder="Search a name or @handle" value={search} onChange={event => { manual(); setSearch(event.target.value); }}/></label><div className="demo-section-label">YOUR PEOPLE <span>02</span></div><div className="demo-contacts">{CONTACTS.filter(item => `${item.handle} ${item.name} ${item.bank} ${item.country}`.toLowerCase().includes(search.toLowerCase())).map(item => <button className="demo-contact" key={item.id} onClick={() => action({ type: 'SELECT', recipient: item.id })}><span className={`demo-avatar is-${item.id}`}>{item.initials}</span><span><strong>{item.handle}</strong><small>{item.bank} · {item.country}</small></span><ChevronRight size={19}/></button>)}{!CONTACTS.some(item => `${item.handle} ${item.name} ${item.bank} ${item.country}`.toLowerCase().includes(search.toLowerCase())) && <p className="demo-empty">No matches. Try Anna or Kesh.</p>}</div><HomeSources/><RecentReceipts app={app}/></> : <>
                <motion.div layout="position" className="demo-selected-person"><span className={`demo-avatar is-${person.id}`}>{person.initials}</span><div><span>Sending to</span><strong>{person.handle}</strong><small>{person.bank} · {person.country}</small></div>{isEditing && <button className="demo-icon-button" onClick={() => action({ type: 'RESET' })} aria-label="Change recipient"><X size={18}/></button>}</motion.div>
                <motion.div layout="position" className={`demo-amount ${transfer ? 'is-resolved' : ''}`}><label htmlFor="demo-amount">You send <span>· total, including fee</span></label><div className="demo-amount-line"><input id="demo-amount" inputMode="decimal" type="text" autoComplete="off" spellCheck={false} aria-describedby={'error' in state.flow ? 'demo-amount-error' : 'demo-amount-hint'} aria-invalid={phase === 'validation_error'} value={state.amount} readOnly={!isEditing} onChange={event => action({ type: 'AMOUNT', amount: event.target.value })} onKeyDown={event => { if (event.key === 'Enter' && isEditing) action({ type: 'QUOTE', now: Date.now() }); }}/><span>{person.currency === 'BAM' ? 'KM' : person.currency}</span></div><span id="demo-amount-hint" className="demo-sr-only">Enter up to two decimal places. Maximum 10,000.</span></motion.div>
                <div className="demo-source"><span className="demo-source-icon">{person.id === 'anna' ? <Wallet size={20}/> : <Landmark size={20}/>}</span><label htmlFor="demo-source">Demo source<select id="demo-source" value={person.source} disabled={!isEditing} onChange={() => manual()}><option>{person.source}</option></select></label><span className="demo-source-currency">{person.id === 'anna' ? 'USDC' : 'BAM'}</span></div>
                {'error' in state.flow && <p className="demo-error" id="demo-amount-error" role="alert">{state.flow.error}</p>}
                {quote && <motion.section layout="position" className="demo-quote" aria-label="Route recommendation"><div className="demo-receive"><span><ArrowDown size={15}/> {person.handle} gets</span><strong data-testid="recipient-amount">{money(quote.receivedMinor, quote.destinationCurrency)}</strong></div><div className="demo-quote-meta"><span>Total fee<strong>{money(quote.feeMinor, quote.sourceCurrency)}</strong></span><span>Estimated delivery<strong>{quote.route.eta}</strong></span></div>{!transfer && <div className="demo-recommendation"><div><span className="demo-preference"><Check size={14}/>{PREFERENCES[state.preference]}</span><p>{selectionReason(options, quote)}</p></div>{phase !== 'reviewing' && <button className="demo-text-button" onClick={app.openSheet}><SlidersHorizontal size={16}/>Advanced</button>}</div>}{quote.sourceCurrency !== quote.destinationCurrency && <p className="demo-fx">1 USDC = 0.92 EUR · fee deducted before conversion</p>}</motion.section>}
                {quote && <RouteJourney nodes={quote.route.nodes} transfer={transfer} expanded={state.expanded} onToggle={() => action({ type: 'EXPAND' })} reduced={reduced}/>}
                {phase === 'reviewing' && quote && <div className="demo-review-note"><Check size={16}/><span>{quote.route.name}<small>Ready when you are.</small></span></div>}
                {transfer && <motion.section layout="position" className={`demo-transfer-status ${phase === 'completed' ? 'is-completed' : ''}`} aria-live="polite"><span className="demo-status-symbol">{phase === 'completed' ? <Check size={23}/> : phase === 'paused' ? <Pause size={20}/> : phase === 'simulation_failed' || phase === 'cancelled' ? <X size={22}/> : <ArrowUpRight size={22}/>}</span><div><h2>{phase === 'completed' ? 'Journey complete' : phase === 'paused' ? 'Journey paused' : phase === 'simulation_failed' ? 'Journey interrupted' : phase === 'cancelled' ? 'Journey cancelled' : 'Following your route'}</h2><p>{phase === 'completed' ? 'Every step, in one place.' : phase === 'paused' ? 'Resume from exactly where you left off.' : phase === 'simulation_failed' ? 'The next step could not continue. Start a new journey to try again.' : phase === 'cancelled' ? 'You can start again whenever you’re ready.' : 'Follow each step as the route unfolds.'}</p></div></motion.section>}
                {phase === 'completed' && transfer && <div className="demo-receipt"><div className="demo-receipt-amount"><span>To {person.handle}</span><strong>{money(transfer.quote.receivedMinor, transfer.quote.destinationCurrency)}</strong></div><dl><div><dt>You sent</dt><dd>{money(transfer.quote.sentMinor, transfer.quote.sourceCurrency)}</dd></div><div><dt>Fee included</dt><dd>{money(transfer.quote.feeMinor, transfer.quote.sourceCurrency)}</dd></div><div><dt>Source</dt><dd>{person.source}</dd></div><div><dt>Route</dt><dd>{transfer.quote.route.name}</dd></div><div><dt>Reference</dt><dd className="demo-reference">NEY-{transfer.id.toUpperCase()}</dd></div></dl><button className="demo-text-button" onClick={copyReference}>{copied ? <Check size={16}/> : <Copy size={16}/>}<span aria-live="polite">{copied ? 'Reference copied' : 'Copy reference'}</span></button></div>}
              </>}
            </motion.section>
            {person && <div className="demo-actions"><PrimaryAction app={app}/>{phase === 'simulating' && <button className="demo-secondary" onClick={() => action({ type: 'PAUSE' })}><Pause size={16}/>Pause</button>}{phase === 'paused' && <div className="demo-pause-actions"><button className="demo-text-button" onClick={() => action({ type: 'CANCEL' })}>Cancel journey</button><button className="demo-text-button" onClick={app.reset}>Restart journey</button></div>}</div>}
            <div className="demo-app-foot"><span>One address for money.</span><button className="demo-icon-button" aria-label="Presenter controls" aria-expanded={app.presenter} onClick={app.togglePresenter}><Settings2 size={18}/></button></div>
          </div>
          {app.presenter && <Presenter app={app} onScenario={scenario}/>}
          <BottomSheet open={app.sheet} title="Choose your route" onClose={app.closeSheet}>{quote && <><p className="demo-sheet-intro">Choose what matters for this journey.</p><div className="demo-route-options" role="radiogroup" aria-label="Routing preference">{(['cost', 'speed', ...(person?.id === 'kesh' ? ['bank' as const] : [])] as const).map(preference => <RouteOption key={preference} preference={preference} options={options} checked={state.preference === preference} onSelect={() => action({ type: 'PREFERENCE', preference, now: Date.now() })}/>)}</div><button className="demo-primary" onClick={app.closeSheet}>Apply route<Check size={18}/></button></>}</BottomSheet>
        </div></div>
        <div className="demo-stage-caption"><span>NEYLO / PRODUCT EXPERIENCE</span><button onClick={app.togglePresenter}><Settings2 size={15}/>Presenter mode</button></div>
      </div>
    </main>
  </MotionConfig>;
}

function PrimaryAction({ app }: { app: ReturnType<typeof useDemo> }) {
  const { state, manual } = app; const phase = state.flow.phase;
  if (phase === 'simulating') return null;
  const label = phase === 'quoting' ? 'Review transfer' : phase === 'reviewing' ? 'Confirm transfer' : phase === 'paused' ? 'Resume journey' : phase === 'completed' ? 'Send another' : phase === 'simulation_failed' || phase === 'cancelled' ? 'Start again' : 'Find a route';
  function run() {
    if (phase === 'quoting') manual({ type: 'REVIEW', now: Date.now() });
    else if (phase === 'reviewing') manual({ type: 'CONFIRM', now: Date.now(), id: crypto.randomUUID(), fail: app.failure });
    else if (phase === 'paused') manual({ type: 'RESUME' });
    else if (phase === 'completed' || phase === 'simulation_failed' || phase === 'cancelled') app.reset();
    else manual({ type: 'QUOTE', now: Date.now() });
  }
  return <button className="demo-primary" disabled={!app.ready} onClick={run}>{label}<ArrowRight size={19}/></button>;
}

function HomeSources() { return <section className="demo-home-sources" aria-label="Funding sources"><div className="demo-section-label">START FROM <span>DEMO SOURCES</span></div><div><Landmark size={20}/><span>Intesa<small>Local currency · KM</small></span><span className="demo-source-tag">BANK</span></div><div><Wallet size={20}/><span>USDC wallet<small>Digital dollar · USDC</small></span><span className="demo-source-tag">WALLET</span></div></section>; }

function RecentReceipts({ app }: { app: ReturnType<typeof useDemo> }) {
  if (!app.state.receipts.length) return <div className="demo-home-note"><span className="demo-home-orbit"><ArrowUpRight size={26}/></span><h3>Closer than you think.</h3><p>Choose a person. We’ll find the route.</p></div>;
  return <section className="demo-recent"><div className="demo-section-label">RECENT JOURNEYS</div>{app.state.receipts.slice(0, 3).map(receipt => <button key={receipt.id} onClick={() => app.manual({ type: 'RECEIPT', id: receipt.id })}><span><strong>@{receipt.quote.route.recipient}</strong><small>{receipt.quote.route.name}</small></span><strong>{money(receipt.quote.receivedMinor, receipt.quote.destinationCurrency)}</strong><ChevronRight size={17}/></button>)}</section>;
}

function RouteOption({ preference, options, checked, onSelect }: { preference: Preference; options: Quote[]; checked: boolean; onSelect: () => void }) {
  const quote = rankQuotes(options, preference)[0]; if (!quote) return null;
  return <label className={`demo-route-option ${checked ? 'is-selected' : ''}`}><input type="radio" name="route-preference" value={preference} checked={checked} onChange={onSelect}/><span><strong>{PREFERENCES[preference]}</strong><small>{quote.route.name}</small><span className="demo-option-amount">{money(quote.receivedMinor, quote.destinationCurrency)} <small>arrives</small></span><span className="demo-option-meta">{money(quote.feeMinor, quote.sourceCurrency)} fee <span>·</span> {quote.route.eta}</span></span><span className="demo-radio-mark" aria-hidden="true">{checked && <Check size={14}/>}</span></label>;
}

function Presenter({ app, onScenario }: { app: ReturnType<typeof useDemo>; onScenario: (recipient: RecipientId) => void }) {
  return <section className="demo-presenter" aria-label="Presenter controls"><header><span>PRESENTER</span><button className="demo-icon-button" onClick={app.togglePresenter} aria-label="Close presenter controls"><X size={17}/></button></header><div className="demo-presenter-scenarios"><button onClick={() => onScenario('kesh')}>Local scenario</button><button onClick={() => onScenario('anna')}>International scenario</button></div><div className="demo-playback"><button onClick={app.play}>{app.guided ? <Pause size={17}/> : <Play size={17}/>} {app.guided ? 'Pause guided demo' : 'Play guided demo'}</button><button onClick={app.reset} aria-label="Restart demo"><RotateCcw size={18}/></button><label>Speed<select aria-label="Playback speed" value={app.speed} onChange={event => app.changeSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label></div><div className="demo-presenter-options"><button onClick={app.toggleSound} aria-pressed={app.sound}>{app.sound ? <Volume2 size={16}/> : <VolumeX size={16}/>}Sound {app.sound ? 'on' : 'off'}</button><label><input type="checkbox" checked={app.failure} onChange={event => app.changeFailure(event.target.checked)}/> Interrupt next journey</label></div><label className="demo-reduce-control"><input type="checkbox" checked={app.reduced} onChange={event => app.changeReduced(event.target.checked)}/> Reduce motion</label><p>Playback speed controls the presentation, not the estimated delivery time.</p></section>;
}
