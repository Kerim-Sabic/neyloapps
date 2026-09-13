import { z } from 'zod';
import { initialState, selectedQuote, type DemoState } from './machine';
import { calculateQuotes } from './quote';
import { advanceTransfer, beginTransfer, type Transfer } from './simulation';

export const STORAGE_KEY = 'neylo:demo:v1';
const savedTransfer = z.object({ id: z.string().min(1).max(80), recipient: z.enum(['anna', 'kesh']), sent: z.number().int().positive(), route: z.string(), startedAt: z.number().nonnegative(), elapsed: z.number().nonnegative(), status: z.enum(['running', 'paused', 'completed', 'cancelled', 'failed']), fail: z.boolean() });
const snapshotSchema = z.object({ version: z.literal(1), recipient: z.enum(['anna', 'kesh']).nullable(), amount: z.string().max(20), preference: z.enum(['cost', 'speed', 'bank']), expanded: z.boolean(), quoteAt: z.number().nullable(), phase: z.string(), transfer: savedTransfer.nullable(), receipts: z.array(savedTransfer).max(20) });

function compact(transfer: Transfer) { return { id: transfer.id, recipient: transfer.quote.route.recipient, sent: transfer.quote.sentMinor, route: transfer.quote.route.id, startedAt: transfer.startedAt, elapsed: transfer.elapsed, status: transfer.status, fail: transfer.failAtNode !== null }; }
function restoreTransfer(saved: z.infer<typeof savedTransfer>): Transfer | null {
  const quote = calculateQuotes(saved.recipient, saved.sent, saved.startedAt).find(q => q.route.id === saved.route);
  if (!quote) return null;
  const rebuilt = advanceTransfer(beginTransfer(saved.id, quote, saved.startedAt, saved.fail), saved.elapsed);
  if (saved.status === 'completed' && rebuilt.status !== 'completed') return null;
  return { ...rebuilt, status: rebuilt.status === 'completed' ? 'completed' : saved.status === 'running' || saved.status === 'paused' ? 'paused' : saved.status };
}
export function encodeSnapshot(state: DemoState): string {
  return JSON.stringify({ version: 1, recipient: state.recipient, amount: state.amount, preference: state.preference, expanded: state.expanded, phase: state.flow.phase,
    quoteAt: selectedQuote(state)?.createdAt ?? null, transfer: 'transfer' in state.flow ? compact(state.flow.transfer) : null, receipts: state.receipts.map(compact) });
}
export function decodeSnapshot(raw: string | null, now: number): DemoState {
  if (!raw) return initialState;
  try {
    const saved = snapshotSchema.parse(JSON.parse(raw));
    const receipts = saved.receipts.flatMap(item => { const t = restoreTransfer(item); return t?.status === 'completed' ? [t] : []; });
    const state: DemoState = { ...initialState, recipient: saved.recipient, amount: saved.amount, preference: saved.preference, expanded: saved.expanded, receipts, flow: saved.recipient ? { phase: 'composing' } : { phase: 'idle' } };
    const transfer = saved.transfer ? restoreTransfer(saved.transfer) : null;
    if (transfer) {
      const phases = { completed: 'completed', paused: 'paused', running: 'paused', cancelled: 'cancelled', failed: 'simulation_failed' } as const;
      return { ...state, flow: { phase: phases[transfer.status], transfer } };
    }
    if (saved.quoteAt && saved.recipient && (saved.phase === 'quoting' || saved.phase === 'reviewing')) {
      const amount = /^\d+(?:[.,]\d{1,2})?$/.test(saved.amount) ? Math.round(Number(saved.amount.replace(',', '.')) * 100) : 0;
      const quotes = calculateQuotes(saved.recipient, amount, saved.quoteAt);
      const quote = quotes.sort((a, b) => saved.preference === 'speed' ? a.route.etaSeconds - b.route.etaSeconds : a.feeMinor - b.feeMinor)[0];
      if (quote) state.flow = now >= quote.expiresAt ? { phase: 'quote_expired', error: 'Your quote expired. Find a fresh route to continue.' } : { phase: saved.phase, quote };
    }
    return state;
  } catch { return initialState; }
}
