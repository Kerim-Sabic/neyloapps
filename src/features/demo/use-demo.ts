'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { currentTransfer, demoReducer, initialState, selectedQuote, type Action } from './machine';
import { guidedAction, type GuidedStep } from './presenter';
import { subscribeClock } from './simulation';
import { decodeSnapshot, encodeSnapshot, STORAGE_KEY } from './storage';

export function useDemo() {
  const [state, setState] = useState(initialState);
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [presenter, setPresenter] = useState(false);
  const [guided, setGuided] = useState(false);
  const [step, setStep] = useState<GuidedStep>('recipient');
  const [speed, setSpeed] = useState(1);
  const [failure, setFailure] = useState(false);
  const [sound, setSound] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const stateRef = useRef(state);
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef<string | null>(null);
  const dispatch = useCallback((action: Action) => setState(previous => demoReducer(previous, action)), []);

  useEffect(() => { try { setState(decodeSnapshot(localStorage.getItem(STORAGE_KEY), Date.now())); } catch { setStorageAvailable(false); } setReady(true); }, []);
  useEffect(() => { stateRef.current = state; if (!ready) return; try { localStorage.setItem(STORAGE_KEY, encodeSnapshot(state)); } catch { setStorageAvailable(false); } }, [state, ready]);

  const transfer = currentTransfer(state);
  useEffect(() => {
    if (!ready || transfer?.status !== 'running') return;
    const id = transfer.id;
    return subscribeClock(delta => dispatch({ type: 'TICK', id, delta }), speed);
  }, [ready, transfer?.id, transfer?.status, speed, dispatch]);

  const quote = selectedQuote(state);
  useEffect(() => { if (!quote) setSheet(false); }, [quote]);
  useEffect(() => {
    if (!quote || (state.flow.phase !== 'quoting' && state.flow.phase !== 'reviewing')) return;
    const timer = setTimeout(() => dispatch({ type: 'EXPIRE', now: Date.now() }), Math.max(0, quote.expiresAt - Date.now()) + 10);
    return () => clearTimeout(timer);
  }, [quote, state.flow.phase, dispatch]);

  useEffect(() => {
    const hide = () => { if (document.hidden) { dispatch({ type: 'PAUSE' }); setGuided(false); } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [dispatch]);

  useEffect(() => {
    if (!guided || step === 'done') return;
    const timer = setTimeout(() => {
      const effect = guidedAction(step, stateRef.current, Date.now(), crypto.randomUUID(), failure);
      if (effect.action) dispatch(effect.action);
      if (effect.sheet !== undefined) setSheet(effect.sheet);
      setStep(effect.next);
    }, (step === 'arrival' ? 200 : step === 'fastest' || step === 'close' ? 1600 : 1100) / speed);
    return () => clearTimeout(timer);
  }, [guided, step, speed, failure, dispatch, state.flow.phase]);
  useEffect(() => { if (step === 'done') setGuided(false); }, [step]);

  useEffect(() => {
    if (!transfer || transfer.status !== 'completed') return;
    // A restored receipt never sounds: only a completion in this mounted session.
    if (sound && sounded.current === transfer.id && audio.current) {
      const context = audio.current; const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.frequency.setValueAtTime(660, context.currentTime); gain.gain.setValueAtTime(0.045, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.35);
    }
    sounded.current = null;
  }, [transfer?.status, transfer?.id, sound]);
  useEffect(() => { if (transfer?.status === 'running') sounded.current = transfer.id; }, [transfer?.status, transfer?.id]);
  useEffect(() => () => { void audio.current?.close(); }, []);

  function manual(action?: Action) {
    if (guided) { setGuided(false); dispatch({ type: 'PAUSE' }); }
    if (action) dispatch(action);
  }
  function reset() { setGuided(false); setStep('recipient'); setSheet(false); dispatch({ type: 'RESET' }); }
  function play() {
    if (guided) { setGuided(false); dispatch({ type: 'PAUSE' }); return; }
    if (state.flow.phase === 'paused') { dispatch({ type: 'RESUME' }); setStep('arrival'); }
    else if (state.flow.phase === 'simulating') setStep('arrival');
    else if (state.recipient === 'anna' && state.flow.phase === 'reviewing') setStep('confirm');
    else if (state.recipient === 'anna' && state.flow.phase === 'quoting') setStep('advanced');
    else { dispatch({ type: 'RESET' }); setStep('recipient'); }
    setPresenter(false); setGuided(true);
  }
  function toggleSound() {
    manual();
    if (!sound) { audio.current ??= new AudioContext(); void audio.current.resume(); }
    setSound(!sound);
  }
  return { state, ready, sheet, presenter, guided, speed, failure, sound, reduced, storageAvailable, manual, reset, play, toggleSound,
    openSheet: () => { manual(); setSheet(true); }, closeSheet: () => { manual(); setSheet(false); },
    togglePresenter: () => { manual(); setPresenter(!presenter); },
    changeSpeed: (value: number) => { manual(); setSpeed(value); },
    changeFailure: (value: boolean) => { manual(); setFailure(value); },
    changeReduced: (value: boolean) => { manual(); setReduced(value); },
  };
}
