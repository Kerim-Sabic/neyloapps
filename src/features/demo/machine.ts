import { contact, type Preference, type RecipientId } from './config';
import { calculateQuotes, parseAmount, rankQuotes, type Quote } from './quote';
import { advanceTransfer, beginTransfer, type Transfer } from './simulation';

type Flow =
  | { phase: 'idle' | 'composing' }
  | { phase: 'validation_error' | 'no_route' | 'quote_expired'; error: string }
  | { phase: 'quoting' | 'reviewing'; quote: Quote }
  | { phase: 'simulating' | 'paused' | 'completed' | 'cancelled' | 'simulation_failed'; transfer: Transfer };
export type DemoState = { recipient: RecipientId | null; amount: string; preference: Preference; expanded: boolean; receipts: Transfer[]; flow: Flow };
export type Action =
  | { type: 'SELECT'; recipient: RecipientId }
  | { type: 'AMOUNT'; amount: string }
  | { type: 'QUOTE'; now: number }
  | { type: 'PREFERENCE'; preference: Preference; now: number }
  | { type: 'REVIEW'; now: number }
  | { type: 'CONFIRM'; now: number; id: string; fail: boolean }
  | { type: 'TICK'; id: string; delta: number }
  | { type: 'EXPIRE'; now: number }
  | { type: 'PAUSE' | 'RESUME' | 'CANCEL' | 'BACK' | 'RESET' | 'EXPAND' }
  | { type: 'RECEIPT'; id: string };
export const initialState: DemoState = { recipient: null, amount: '', preference: 'cost', expanded: false, receipts: [], flow: { phase: 'idle' } };
export function selectedQuote(state: DemoState): Quote | null { return 'quote' in state.flow ? state.flow.quote : 'transfer' in state.flow ? state.flow.transfer.quote : null; }
export function currentTransfer(state: DemoState): Transfer | null { return 'transfer' in state.flow ? state.flow.transfer : null; }

function quoteFlow(state: DemoState, now: number): Flow {
  const parsed = parseAmount(state.amount);
  if (!parsed.ok) return { phase: 'validation_error', error: parsed.error };
  if (!state.recipient) return { phase: 'composing' };
  const quote = rankQuotes(calculateQuotes(state.recipient, parsed.minor, now), state.preference)[0];
  if (!quote) return { phase: 'no_route', error: `No route for this amount. Try ${state.recipient === 'kesh' ? '1 KM' : '5 USDC'} or more, up to 10,000.` };
  return { phase: 'quoting', quote };
}

function transferFlow(transfer: Transfer): Flow {
  const phase = { running: 'simulating', paused: 'paused', completed: 'completed', failed: 'simulation_failed', cancelled: 'cancelled' } as const;
  return { phase: phase[transfer.status], transfer };
}

export function demoReducer(state: DemoState, action: Action): DemoState {
  const flow = state.flow;
  switch (action.type) {
    case 'RESET': return { ...initialState, receipts: state.receipts };
    case 'SELECT': return { ...state, recipient: action.recipient, amount: contact(action.recipient).defaultAmount, preference: 'cost', expanded: false, flow: { phase: 'composing' } };
    case 'AMOUNT': return 'transfer' in flow ? state : { ...state, amount: action.amount.slice(0, 20), flow: { phase: 'composing' } };
    case 'QUOTE': return 'transfer' in flow ? state : { ...state, flow: quoteFlow(state, action.now) };
    case 'PREFERENCE': {
      if ('transfer' in flow) return state;
      const next = { ...state, preference: action.preference };
      return { ...next, flow: quoteFlow(next, action.now) };
    }
    case 'REVIEW': return flow.phase !== 'quoting' ? state : { ...state, flow: action.now >= flow.quote.expiresAt ? { phase: 'quote_expired', error: 'Your quote expired. Find a fresh route to continue.' } : { phase: 'reviewing', quote: flow.quote } };
    case 'CONFIRM': {
      if (flow.phase !== 'reviewing') return state;
      if (action.now >= flow.quote.expiresAt) return { ...state, flow: { phase: 'quote_expired', error: 'Your quote expired. Find a fresh route to continue.' } };
      return { ...state, flow: transferFlow(beginTransfer(action.id, flow.quote, action.now, action.fail)) };
    }
    case 'TICK': {
      if (flow.phase !== 'simulating' || flow.transfer.id !== action.id) return state;
      const transfer = advanceTransfer(flow.transfer, action.delta);
      return { ...state, flow: transferFlow(transfer), receipts: transfer.status === 'completed' && !state.receipts.some(r => r.id === transfer.id) ? [transfer, ...state.receipts].slice(0, 20) : state.receipts };
    }
    case 'PAUSE': return flow.phase === 'simulating' ? { ...state, flow: transferFlow({ ...flow.transfer, status: 'paused' }) } : state;
    case 'RESUME': return flow.phase === 'paused' ? { ...state, flow: transferFlow({ ...flow.transfer, status: 'running' }) } : state;
    case 'CANCEL': return flow.phase === 'simulating' || flow.phase === 'paused' ? { ...state, flow: transferFlow({ ...flow.transfer, status: 'cancelled' }) } : state;
    case 'EXPIRE': return (flow.phase === 'quoting' || flow.phase === 'reviewing') && action.now >= flow.quote.expiresAt ? { ...state, flow: { phase: 'quote_expired', error: 'Your quote expired. Find a fresh route to continue.' } } : state;
    case 'EXPAND': return { ...state, expanded: !state.expanded };
    case 'BACK': {
      if (flow.phase === 'simulating' || flow.phase === 'paused') return state;
      if (flow.phase === 'reviewing') return { ...state, flow: { phase: 'quoting', quote: flow.quote } };
      if (flow.phase === 'quoting') return { ...state, flow: { phase: 'composing' } };
      return { ...initialState, receipts: state.receipts };
    }
    case 'RECEIPT': {
      const receipt = state.receipts.find(r => r.id === action.id);
      return receipt ? { ...state, recipient: receipt.quote.route.recipient, amount: String(receipt.quote.sentMinor / 100), expanded: false, flow: { phase: 'completed', transfer: receipt } } : state;
    }
  }
}
