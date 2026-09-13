import type { Action, DemoState } from './machine';

export type GuidedStep = 'recipient' | 'amount' | 'quote' | 'advanced' | 'fastest' | 'close' | 'review' | 'confirm' | 'expand' | 'arrival' | 'done';
export type GuideEffect = { next: GuidedStep; action?: Action; sheet?: boolean };
// Each step checks current application state. The controller waits for the outcome
// before it advances; its one pending action is cancelled on any manual interaction.
export function guidedAction(step: GuidedStep, state: DemoState, now: number, id: string, fail: boolean): GuideEffect {
  switch (step) {
    case 'recipient': return { next: 'amount', action: { type: 'SELECT', recipient: 'anna' } };
    case 'amount': return { next: 'quote', action: { type: 'AMOUNT', amount: '100' } };
    case 'quote': return { next: 'advanced', action: { type: 'QUOTE', now } };
    case 'advanced': return state.flow.phase === 'quoting' ? { next: 'fastest', sheet: true } : { next: 'quote' };
    case 'fastest': return { next: 'close', action: { type: 'PREFERENCE', preference: 'speed', now } };
    case 'close': return { next: 'review', sheet: false };
    case 'review': return { next: 'confirm', action: { type: 'REVIEW', now } };
    case 'confirm': return state.flow.phase === 'reviewing' ? { next: 'expand', action: { type: 'CONFIRM', now, id, fail } } : { next: 'quote' };
    case 'expand': return { next: 'arrival', action: state.expanded ? undefined : { type: 'EXPAND' } };
    case 'arrival': return { next: state.flow.phase === 'completed' || state.flow.phase === 'simulation_failed' ? 'done' : 'arrival' };
    case 'done': return { next: 'done' };
  }
}
