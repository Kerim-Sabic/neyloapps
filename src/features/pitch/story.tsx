'use client';
import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, AtSign, Check, Landmark, MessageCircle, Route } from 'lucide-react';
import { SOURCES } from './content';

const ease = [.22, 1, .36, 1] as const;

export function FrictionStory() {
  const [simple, setSimple] = useState(false);
  return <div className="pitch-friction-story">
    <div className="pitch-pain-copy"><span className="pitch-big-quote">“Send me your details?”</span><p>A small favor becomes a bank name, an account number, a fee comparison and a follow-up.</p><div className="pitch-switch" role="group" aria-label="Compare the payment experience"><button aria-pressed={!simple} onClick={() => setSimple(false)}>The familiar flow</button><button aria-pressed={simple} onClick={() => setSimple(true)}>With NEYLO <ArrowRight size={16}/></button></div><span className="pitch-quiet-caption">Same intent. Less work for the person.</span></div>
    <div className="pitch-conversation" data-simple={simple} aria-live="polite">
      <div className="pitch-conversation-person"><span>K</span><div><strong>Kerim</strong><small>{simple ? '@kerim · one personal address' : 'You want to send Kerim 10 KM'}</small></div><MessageCircle size={24}/></div>
      <div className="pitch-conversation-body">
        <motion.div className="pitch-chat-bubble" animate={{ x: simple ? 0 : 12 }} transition={{ duration: .4, ease }}>{simple ? 'Send to @kerim' : 'Which bank should I send it to?'}</motion.div>
        <motion.div className="pitch-chat-bubble is-answer" animate={{ x: simple ? 0 : -8 }} transition={{ duration: .4, ease, delay: .04 }}>{simple ? <><span>You send</span><strong>10.00 KM</strong><small>9.90 KM arrives · 0.10 KM fee</small></> : 'I’ll find my account number.'}</motion.div>
        <motion.div className="pitch-chat-bubble is-last" animate={{ x: simple ? 0 : 12 }} transition={{ duration: .4, ease, delay: .08 }}>{simple ? <><Route size={20}/>One route. One clear journey.</> : 'How much will arrive—and when?'}</motion.div>
      </div>
    </div>
  </div>;
}

export function ModernizationTimeline() {
  const events = [
    { date: '20 JUL 2026', title: 'Instant rails arrive.', detail: 'IPS BiH launches. Participating banks can send around the clock.', source: SOURCES.ips, icon: <Route/> },
    { date: 'JUL 2026', title: 'The rules evolve.', detail: 'Financial-law reforms are adopted. PSD2 alignment opens a new direction.', source: SOURCES.reform, icon: <Landmark/> },
    { date: '06 AUG 2026', title: 'Europe moves closer.', detail: 'BiH formally applies to SEPA. Admission and bank onboarding come next.', source: SOURCES.sepa, icon: <ArrowUpRight/> },
  ];
  return <div className="pitch-timing"><div className="pitch-milestones">{events.map((event, i) => <motion.article key={event.date} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .3 }} transition={{ duration: .55, delay: i * .1, ease }}><div className="pitch-milestone-line"><span>{event.icon}</span><i/></div><time>{event.date}</time><h3>{event.title}</h3><p>{event.detail}</p><a className="pitch-source" href={event.source.url} target="_blank" rel="noopener noreferrer">Central bank source <ArrowUpRight size={14}/></a></motion.article>)}</div><div className="pitch-timing-thesis"><AtSign size={34}/><p>The infrastructure is arriving.<br/><strong>The human experience is the opening.</strong></p><a className="pitch-source" href={SOURCES.psd2.url} target="_blank" rel="noopener noreferrer">PSD2 reform text <ArrowUpRight size={14}/></a></div></div>;
}

export const HORIZONS = [
  { year: '1', date: '2027', title: 'Prove one useful corridor.', summary: 'Connect. Reconcile. Earn repeat use.', steps: ['An authorized provider path for a focused pilot.', 'Clear support, reconciliation and failure recovery.', 'Measure repeat sends, actual costs and recipient activation.'], gate: 'Expand after repeat use and viable unit economics.' },
  { year: '5', date: '2031', title: 'Become the everyday address.', summary: 'Regional reach. Business utility.', steps: ['Expand eligible routes across the region and euro area.', 'Bring requests, collections and payouts into one workflow.', 'Offer integrations for businesses and other applications.'], gate: 'Each market requires provider access and an approved operating model.' },
  { year: '10', date: '2036', title: 'Make identity portable.', summary: 'One address, across institutions.', steps: ['An address that can move with people and businesses.', 'Route a payment intent across connected institutions.', 'Become an experience layer other products can build upon.'], gate: 'A long-term ambition earned through trust, integrations and adoption.' },
] as const;

export function Roadmap() {
  const [selected, setSelected] = useState(0), horizon = HORIZONS[selected]!;
  return <div className="pitch-roadmap">
    <div className="pitch-horizons" role="tablist" aria-label="NEYLO roadmap horizons">{HORIZONS.map((item, i) => <button key={item.year} id={`horizon-${item.year}`} role="tab" aria-selected={selected === i} aria-controls="horizon-detail" tabIndex={selected === i ? 0 : -1} onClick={() => setSelected(i)} onKeyDown={e => { const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!step) return; e.preventDefault(); const next = (i + step + HORIZONS.length) % HORIZONS.length; setSelected(next); document.getElementById(`horizon-${HORIZONS[next]!.year}`)?.focus(); }}><span>YEAR <b>{item.year}</b><small>{item.date}</small></span><strong>{item.summary}</strong>{selected === i && <motion.i layoutId="roadmap-selection" transition={{ duration: .35, ease }}/>}</button>)}</div>
    <div id="horizon-detail" role="tabpanel" aria-labelledby={`horizon-${horizon.year}`} className="pitch-horizon-detail"><div><span className="pitch-eyebrow">THE AMBITION / YEAR {horizon.year}</span><h3>{horizon.title}</h3><p>{horizon.gate}</p></div><ul>{horizon.steps.map((step, i) => <li key={i}><Check size={20}/>{step}</li>)}</ul></div>
  </div>;
}
