import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTACTS, QUOTE_LIFETIME_MS } from '../../src/features/demo/config';
import { calculateQuotes, money, parseAmount, rankQuotes, selectionReason } from '../../src/features/demo/quote';
import { currentTransfer, demoReducer, initialState, selectedQuote, type DemoState } from '../../src/features/demo/machine';
import { advanceTransfer, beginTransfer, connectorProgress, duration, nodeState, schedule } from '../../src/features/demo/simulation';
import { decodeSnapshot, encodeSnapshot, STORAGE_KEY } from '../../src/features/demo/storage';
import { connectorGeometry } from '../../src/features/demo/route-geometry';
import { guidedAction, type GuidedStep } from '../../src/features/demo/presenter';

const now = 1_800_000_000_000;
function review(recipient: 'anna' | 'kesh' = 'anna') {
  let state = demoReducer(initialState, { type: 'SELECT', recipient });
  state = demoReducer(state, { type: 'QUOTE', now });
  return demoReducer(state, { type: 'REVIEW', now });
}
function confirmed() { return demoReducer(review(), { type: 'CONFIRM', now, id: 'transfer-a', fail: false }); }

test('Demo amounts parse decimal keyboard/paste strings without float arithmetic', () => {
  for (const [raw, minor] of [['100', 10000], [' 200.05 ', 20005], ['10,42', 1042], ['0.01', 1], ['0005', 500]] as const) assert.deepEqual(parseAmount(raw), { ok: true, minor });
  for (const raw of ['', '0', '-1', '+1', '1e2', 'NaN', 'Infinity', '1.005', '1,000.00', '10000.01', '1..0']) assert.equal(parseAmount(raw).ok, false, raw);
});
test('Local routing has one eligible option and truly wins both objectives', () => {
  const quotes = calculateQuotes('kesh', 1000, now); assert.equal(quotes.length, 1);
  const q = quotes[0]; assert.ok(q); assert.equal(q.feeMinor, 10); assert.equal(q.receivedMinor, 990);
  for (const preference of ['cost', 'speed', 'bank'] as const) assert.equal(rankQuotes(quotes, preference)[0]?.route.id, q.route.id);
  assert.equal(selectionReason(quotes, q), 'Best for cost and speed');
});
test('International fixtures calculate distinct fee/time tradeoffs at 100 and 200 USDC', () => {
  const q100 = calculateQuotes('anna', 10000, now), q200 = calculateQuotes('anna', 20000, now);
  assert.deepEqual(q100.map(q => [q.feeMinor, q.receivedMinor]), [[80, 9126], [175, 9039]]);
  assert.deepEqual(q200.map(q => [q.feeMinor, q.receivedMinor]), [[120, 18290], [255, 18165]]);
  assert.equal(rankQuotes(q100, 'speed')[0]?.route.id, 'eur-express');
  assert.equal(rankQuotes(q100, 'cost')[0]?.route.id, 'eur-economy');
  assert.equal(rankQuotes(q100, 'bank').length, 0);
});
test('All accepted amounts obey fee ceiling and destination half-up policy', () => {
  for (let sent = 500; sent <= 1_000_000; sent += 137) {
    for (const q of calculateQuotes('anna', sent, now)) {
      assert.equal(q.feeMinor, q.route.fixedFee + Math.ceil(sent * q.route.feeBps / 10000));
      const exact = BigInt(sent - q.feeMinor) * 92n;
      assert.equal(q.receivedMinor, Number((exact + 50n) / 100n));
      assert.equal(money(q.receivedMinor, 'EUR').endsWith(' EUR'), true);
    }
  }
});
test('Changing contacts resets valid sources, defaults and preferences', () => {
  let state = demoReducer(review(), { type: 'PREFERENCE', preference: 'speed', now });
  state = demoReducer(state, { type: 'SELECT', recipient: 'kesh' });
  assert.equal(state.amount, '10'); assert.equal(state.preference, 'cost'); assert.equal(selectedQuote(state), null);
  assert.equal(CONTACTS.find(c => c.id === state.recipient)?.source, 'Intesa');
});
test('Editing amount invalidates the previous quote and recalculates', () => {
  let state = demoReducer(review(), { type: 'AMOUNT', amount: '200' });
  assert.equal(selectedQuote(state), null); state = demoReducer(state, { type: 'QUOTE', now });
  assert.equal(selectedQuote(state)?.receivedMinor, 18290);
});
test('Validation, no route and quote expiry are explicit recoverable states', () => {
  let state = demoReducer(review(), { type: 'AMOUNT', amount: '-10' });
  state = demoReducer(state, { type: 'QUOTE', now }); assert.equal(state.flow.phase, 'validation_error');
  state = demoReducer(state, { type: 'AMOUNT', amount: '1' }); state = demoReducer(state, { type: 'QUOTE', now }); assert.equal(state.flow.phase, 'no_route');
  state = demoReducer(review(), { type: 'CONFIRM', now: now + QUOTE_LIFETIME_MS, id: 'expired', fail: false });
  assert.equal(state.flow.phase, 'quote_expired'); assert.equal(currentTransfer(state), null);
  state = demoReducer(state, { type: 'QUOTE', now: now + QUOTE_LIFETIME_MS }); assert.equal(state.flow.phase, 'quoting');
});
test('Confirmation deduplicates repeated clicks and stale ticks cannot affect a newer journey', () => {
  const one = confirmed(); const two = demoReducer(one, { type: 'CONFIRM', now, id: 'transfer-b', fail: false }); assert.equal(one, two);
  const reset = demoReducer(two, { type: 'RESET' }); assert.equal(demoReducer(reset, { type: 'TICK', id: 'transfer-a', delta: 90000 }), reset);
  const newer = demoReducer(review(), { type: 'CONFIRM', now, id: 'newer', fail: false }); assert.equal(demoReducer(newer, { type: 'TICK', id: 'transfer-a', delta: 90000 }), newer);
});
test('Ordered events only complete nodes after work and activate the next after its connector arrives', () => {
  const q = selectedQuote(review()); assert.ok(q);
  const t = beginTransfer('ordered', q, now, false);
  const active = advanceTransfer(t, 1599); assert.equal(nodeState(active, 0), 'active'); assert.equal(connectorProgress(active, 0), 0);
  const between = advanceTransfer(active, 325); assert.equal(nodeState(between, 0), 'complete'); assert.equal(nodeState(between, 1), 'upcoming'); assert.ok(connectorProgress(between, 0) > 0 && connectorProgress(between, 0) < 1);
  const next = advanceTransfer(between, 326); assert.equal(nodeState(next, 1), 'active'); assert.equal(connectorProgress(next, 0), 1);
  const done = advanceTransfer(next, 100000); assert.equal(done.status, 'completed'); assert.deepEqual(done.events, schedule(q));
  assert.equal(new Set(done.events.map(e => e.sequence)).size, done.events.length);
});
test('Pause freezes execution, resume continues, cancellation remains terminal', () => {
  let state = demoReducer(confirmed(), { type: 'TICK', id: 'transfer-a', delta: 1400 });
  state = demoReducer(state, { type: 'PAUSE' }); const paused = state;
  assert.equal(demoReducer(state, { type: 'TICK', id: 'transfer-a', delta: 100000 }), paused);
  state = demoReducer(state, { type: 'RESUME' }); state = demoReducer(state, { type: 'TICK', id: 'transfer-a', delta: 200 }); assert.equal(currentTransfer(state)?.elapsed, 1600);
  state = demoReducer(state, { type: 'CANCEL' }); assert.equal(state.flow.phase, 'cancelled'); assert.equal(demoReducer(state, { type: 'RESUME' }), state);
});
test('Failure emits an interruption and never a receipt or completion', () => {
  let state = demoReducer(review(), { type: 'CONFIRM', now, id: 'failure', fail: true });
  state = demoReducer(state, { type: 'TICK', id: 'failure', delta: 100000 });
  assert.equal(state.flow.phase, 'simulation_failed'); assert.equal(state.receipts.length, 0);
  assert.equal(currentTransfer(state)?.events.at(-1)?.kind, 'interrupted'); assert.equal(currentTransfer(state)?.events.some(e => e.kind === 'completed'), false);
});
test('Expanding throughout execution preserves identity and progress; receipts remain exact and unique', () => {
  let state = confirmed(); const q = selectedQuote(state);
  for (let i = 0; i < 150; i++) { state = demoReducer(state, { type: 'EXPAND' }); state = demoReducer(state, { type: 'TICK', id: 'transfer-a', delta: 100 }); assert.equal(selectedQuote(state), q); }
  assert.equal(state.flow.phase, 'completed'); assert.equal(state.receipts.length, 1);
  assert.deepEqual(state.receipts[0]?.quote, q); const t = currentTransfer(state); assert.ok(t); assert.equal(t.elapsed, duration(t.quote));
  state = demoReducer(state, { type: 'TICK', id: 'transfer-a', delta: 10000 }); assert.equal(state.receipts.length, 1);
});
test('Arrival folds the same route into the receipt and permits expansion without replay', () => {
  let state=demoReducer(confirmed(),{type:'EXPAND'});assert.equal(state.expanded,true);
  state=demoReducer(state,{type:'TICK',id:'transfer-a',delta:100000});
  assert.equal(state.flow.phase,'completed');assert.equal(state.expanded,false);
  const transfer=currentTransfer(state);
  state=demoReducer(state,{type:'EXPAND'});assert.equal(state.expanded,true);assert.equal(currentTransfer(state),transfer);
  assert.equal(demoReducer(state,{type:'TICK',id:'transfer-a',delta:100000}),state);assert.equal(state.receipts.length,1);
});

test('Refresh pauses in-flight state and restores completed receipts without replay', () => {
  let state = demoReducer(confirmed(), { type: 'TICK', id: 'transfer-a', delta: 1700 });
  const restored = decodeSnapshot(encodeSnapshot(state), now + 60000); assert.equal(restored.flow.phase, 'paused'); assert.equal(currentTransfer(restored)?.elapsed, 1700);
  state = demoReducer(state, { type: 'TICK', id: 'transfer-a', delta: 100000 });
  const done = decodeSnapshot(encodeSnapshot(state), now + 60000); assert.equal(done.flow.phase, 'completed'); assert.equal(done.receipts.length, 1); assert.equal(currentTransfer(done)?.status, 'completed');
  assert.equal(STORAGE_KEY, 'neylo:demo:v1'); assert.equal(decodeSnapshot('{broken', now), initialState);
  assert.equal(decodeSnapshot('{"version":2}', now), initialState);
});
test('Connector geometry maintains exact eight-pixel gaps in horizontal, vertical and diagonal layouts', () => {
  for (const end of [{ x: 300, y: 22 }, { x: 22, y: 102 }, { x: 200, y: 200 }]) {
    const from = { x: 22, y: 22, radius: 22 }, to = { ...end, radius: 22 };
    const line = connectorGeometry(from, to); assert.ok(line);
    assert.ok(Math.abs(Math.hypot(line.x1 - from.x, line.y1 - from.y) - 30) < 0.00001);
    assert.ok(Math.abs(Math.hypot(line.x2 - to.x, line.y2 - to.y) - 30) < 0.00001);
  }
  assert.equal(connectorGeometry({ x: 0, y: 0, radius: 22 }, { x: 20, y: 0, radius: 22 }), null);
});
test('Guided playback uses the same actions, selects fastest, and finishes through adapter events', () => {
  let state: DemoState = initialState, step: GuidedStep = 'recipient', expandedDuringJourney = false; const sheets: boolean[] = [];
  for (let i = 0; i < 20 && step !== 'done'; i++) {
    const effect = guidedAction(step, state, now, 'guided', false);
    if (effect.action) state = demoReducer(state, effect.action);
    if (state.flow.phase === 'simulating' && state.expanded) expandedDuringJourney = true;
    if (effect.sheet !== undefined) sheets.push(effect.sheet);
    step = effect.next;
    if (step === 'arrival') state = demoReducer(state, { type: 'TICK', id: 'guided', delta: 100000 });
  }
  assert.equal(step, 'done'); assert.equal(state.flow.phase, 'completed'); assert.equal(expandedDuringJourney, true); assert.equal(state.expanded, false);
  assert.equal(selectedQuote(state)?.route.id, 'eur-express'); assert.deepEqual(sheets, [true, false]);
});
