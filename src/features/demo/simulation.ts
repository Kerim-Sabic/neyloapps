import type { Quote } from './quote';

export const NODE_DURATION = 1_600;
export const CONNECTOR_DURATION = 650;
export type ExecutionStatus = 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type TransferEvent = { sequence: number; at: number; kind: 'node_started' | 'node_completed' | 'connector_started' | 'connector_completed' | 'completed' | 'interrupted'; nodeId: string };
export type Transfer = { id: string; quote: Quote; startedAt: number; elapsed: number; status: ExecutionStatus; failAtNode: number | null; events: TransferEvent[] };

export function schedule(quote: Quote): TransferEvent[] {
  const events: Omit<TransferEvent, 'sequence'>[] = [];
  quote.route.nodes.forEach((node, index) => {
    const start = index * (NODE_DURATION + CONNECTOR_DURATION);
    events.push({ at: start, kind: 'node_started', nodeId: node.id });
    events.push({ at: start + NODE_DURATION, kind: 'node_completed', nodeId: node.id });
    if (index < quote.route.nodes.length - 1) {
      events.push({ at: start + NODE_DURATION, kind: 'connector_started', nodeId: node.id });
      events.push({ at: start + NODE_DURATION + CONNECTOR_DURATION, kind: 'connector_completed', nodeId: node.id });
    } else events.push({ at: start + NODE_DURATION, kind: 'completed', nodeId: node.id });
  });
  return events.map((event, sequence) => ({ ...event, sequence }));
}

export function duration(quote: Quote) { return quote.route.nodes.length * NODE_DURATION + (quote.route.nodes.length - 1) * CONNECTOR_DURATION; }

export function beginTransfer(id: string, quote: Quote, startedAt: number, fail: boolean): Transfer {
  return { id, quote, startedAt, elapsed: 0, status: 'running', failAtNode: fail ? 1 : null, events: schedule(quote).filter(e => e.at === 0) };
}

export function advanceTransfer(transfer: Transfer, delta: number): Transfer {
  if (transfer.status !== 'running' || !Number.isFinite(delta) || delta <= 0) return transfer;
  const failAt = transfer.failAtNode === null ? Infinity : transfer.failAtNode * (NODE_DURATION + CONNECTOR_DURATION) + NODE_DURATION / 2;
  const elapsed = Math.min(transfer.elapsed + delta, duration(transfer.quote), failAt);
  const events = schedule(transfer.quote).filter(event => event.at <= elapsed);
  if (elapsed === failAt) {
    const node = transfer.quote.route.nodes[transfer.failAtNode ?? 0];
    events.push({ sequence: events.length, at: elapsed, kind: 'interrupted', nodeId: node?.id ?? 'sender' });
    return { ...transfer, elapsed, events, status: 'failed' };
  }
  return { ...transfer, elapsed, events, status: elapsed === duration(transfer.quote) ? 'completed' : 'running' };
}

export function nodeState(transfer: Transfer | null, index: number): 'upcoming' | 'active' | 'complete' | 'interrupted' {
  if (!transfer) return 'upcoming';
  const start = index * (NODE_DURATION + CONNECTOR_DURATION);
  if (transfer.elapsed >= start + NODE_DURATION) return 'complete';
  if (transfer.elapsed < start) return 'upcoming';
  if (transfer.status === 'failed' || transfer.status === 'cancelled') return 'interrupted';
  return 'active';
}

export function connectorProgress(transfer: Transfer | null, index: number) {
  if (!transfer) return 0;
  const start = index * (NODE_DURATION + CONNECTOR_DURATION) + NODE_DURATION;
  return Math.max(0, Math.min(1, (transfer.elapsed - start) / CONNECTOR_DURATION));
}

// A single cancellable clock drives the adapter; time hidden or paused never counts.
export function subscribeClock(onTick: (delta: number) => void, speed: number) {
  let previous = performance.now();
  const timer = setInterval(() => { const now = performance.now(); onTick(Math.min(250, now - previous) * speed); previous = now; }, 80);
  return () => clearInterval(timer);
}
