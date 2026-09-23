import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { z } from 'zod';

// Local contract simulator only. Never imported by the application or deployed Worker.
// The partner owns cash; this is a shadow control ledger, not a Neylo wallet.
const intent = z.object({ recipient: z.literal('@bob'), amountMinor: z.number().int().min(1).max(10_000), currency: z.literal('BAM') }).strict();
const event = z.object({ id: z.string().uuid(), transferId: z.string().uuid(), reference: z.string(),
  type: z.enum(['funding_settled', 'recipient_credited', 'payout_failed', 'refund_settled']),
  amountMinor: z.number().int().positive(), currency: z.literal('BAM'), recipient: z.literal('@bob') }).strict();
export type BankEvent = z.infer<typeof event>;
export type Transfer = { id: string; sender: string; recipient: string; amount_minor: number; currency: 'BAM'; state: string; key: string; fingerprint: string };
export class SandboxError extends Error { constructor(public code: string, public status = 409) { super(code); } }
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const sign = (body: string, timestamp: string, secret: string) => createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

export class PaymentSandbox {
  readonly db: PGlite;
  constructor(path?: string, mode = 'simulation') {
    if (mode !== 'simulation') throw new SandboxError('LIVE_MODE_NOT_IMPLEMENTED', 403);
    this.db = new PGlite(path);
  }
  async init() {
    await this.db.exec(`
      create schema if not exists sandbox;
      create table if not exists sandbox.transfers (
        id uuid primary key, sender text not null check(sender='alice'), recipient text not null check(recipient='@bob'),
        amount_minor integer not null check(amount_minor between 1 and 10000), currency text not null check(currency='BAM'),
        state text not null check(state in ('awaiting_funding','payout_pending','payout_unknown','completed','refund_pending','refunded')),
        key text not null, fingerprint text not null, unique(sender,key));
      create table if not exists sandbox.outbox (
        transfer_id uuid references sandbox.transfers(id), kind text check(kind in ('payout','refund')),
        state text not null default 'pending' check(state in ('pending','unknown','done')), primary key(transfer_id,kind));
      create table if not exists sandbox.inbox (id uuid primary key, fingerprint text not null);
      create table if not exists sandbox.journals (
        id text primary key, transfer_id uuid references sandbox.transfers(id),
        debit text not null, credit text not null, amount_minor integer not null check(amount_minor>0),
        currency text not null check(currency='BAM'), check(debit<>credit), created_at timestamptz default now());
      create table if not exists sandbox.audit (
        id bigint generated always as identity primary key, transfer_id uuid references sandbox.transfers(id),
        action text not null, created_at timestamptz not null default now());
      -- Independent simulated provider outcomes survive application acknowledgement loss.
      create table if not exists sandbox.provider_operations (
        reference text primary key, event jsonb not null, cash_delta integer not null);
      create or replace function sandbox.immutable() returns trigger language plpgsql as $$
        begin raise exception 'IMMUTABLE'; end $$;
      drop trigger if exists immutable_journal on sandbox.journals;
      create trigger immutable_journal before update or delete on sandbox.journals for each row execute function sandbox.immutable();
      drop trigger if exists immutable_audit on sandbox.audit;
      create trigger immutable_audit before update or delete on sandbox.audit for each row execute function sandbox.immutable();
    `);
  }
  async create(sender: string, key: string, input: unknown) {
    if (sender !== 'alice') throw new SandboxError('UNAUTHENTICATED', 401);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new SandboxError('INVALID_KEY', 400);
    const data = intent.parse(input), fingerprint = hash(JSON.stringify(data));
    return this.db.transaction(async tx => {
      const old = (await tx.query<Transfer>('select * from sandbox.transfers where sender=$1 and key=$2', [sender,key])).rows[0];
      if (old) { if (old.fingerprint !== fingerprint) throw new SandboxError('IDEMPOTENCY_CONFLICT'); return old; }
      const id = randomUUID();
      const row = (await tx.query<Transfer>(`insert into sandbox.transfers values($1,$2,$3,$4,$5,'awaiting_funding',$6,$7) returning *`,
        [id,sender,data.recipient,data.amountMinor,data.currency,key,fingerprint])).rows[0]!;
      await this.audit(tx,id,'intent_created'); return row;
    });
  }
  async get(id: string, actor = 'alice') {
    const row = (await this.db.query<Transfer>('select * from sandbox.transfers where id=$1', [z.string().uuid().parse(id)])).rows[0];
    if (!row || ![row.sender,row.recipient.slice(1)].includes(actor)) throw new SandboxError('NOT_FOUND',404);
    return row;
  }
  private audit(tx: Transaction,id: string,action: string) { return tx.query('insert into sandbox.audit(transfer_id,action) values($1,$2)',[id,action]); }
  private journal(tx: Transaction,t: Transfer,kind: string,incoming: boolean) {
    return tx.query('insert into sandbox.journals(id,transfer_id,debit,credit,amount_minor,currency) values($1,$2,$3,$4,$5,$6)',
      [`${t.id}:${kind}`,t.id,incoming?'partner_cash':`payable:${t.id}`,incoming?`payable:${t.id}`:'partner_cash',t.amount_minor,t.currency]);
  }
  async webhook(raw: string,timestamp: string,signature: string,secret: string,now = Date.now()) {
    if (secret.length < 32 || !/^\d{13}$/.test(timestamp) || Math.abs(now-Number(timestamp)) > 300_000 || !/^[a-f0-9]{64}$/.test(signature)
      || !timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(sign(raw,timestamp,secret),'hex'))) throw new SandboxError('INVALID_SIGNATURE',401);
    const e = event.parse(JSON.parse(raw)), fingerprint = hash(raw);
    return this.db.transaction(async tx => {
      const prior = (await tx.query<{fingerprint:string}>('select fingerprint from sandbox.inbox where id=$1',[e.id])).rows[0];
      if (prior) { if(prior.fingerprint!==fingerprint) throw new SandboxError('EVENT_CONFLICT'); return {duplicate:true}; }
      const t = (await tx.query<Transfer>('select * from sandbox.transfers where id=$1 for update',[e.transferId])).rows[0];
      if (!t) throw new SandboxError('UNKNOWN_TRANSFER',404);
      if (e.amountMinor!==t.amount_minor || e.currency!==t.currency || e.recipient!==t.recipient) throw new SandboxError('EVENT_MISMATCH');
      const kind = e.type==='funding_settled'?'funding':e.type==='refund_settled'?'refund':'payout';
      if (e.reference!==`${t.id}:${kind}`) throw new SandboxError('REFERENCE_MISMATCH');
      let next: string;
      if (e.type==='funding_settled' && t.state==='awaiting_funding') {
        await this.journal(tx,t,'funding',true); next='payout_pending';
        await tx.query("insert into sandbox.outbox(transfer_id,kind) values($1,'payout')",[t.id]);
      } else if (e.type==='recipient_credited' && ['payout_pending','payout_unknown'].includes(t.state)) {
        await this.journal(tx,t,'payout',false); next='completed';
      } else if (e.type==='payout_failed' && ['payout_pending','payout_unknown'].includes(t.state)) {
        next='refund_pending'; await tx.query("insert into sandbox.outbox(transfer_id,kind) values($1,'refund')",[t.id]);
      } else if (e.type==='refund_settled' && t.state==='refund_pending') {
        await this.journal(tx,t,'refund',false); next='refunded';
      } else throw new SandboxError('INVALID_TRANSITION');
      await tx.query('insert into sandbox.inbox values($1,$2)',[e.id,fingerprint]);
      await tx.query('update sandbox.transfers set state=$2 where id=$1',[t.id,next]);
      if (kind!=='funding') await tx.query("update sandbox.outbox set state='done' where transfer_id=$1 and kind=$2",[t.id,kind]);
      await this.audit(tx,t.id,e.type); return {duplicate:false,state:next};
    });
  }
  // No HTTP destination or credentials can be supplied: this cannot move real money.
  async simulateProvider(id: string,kind: 'funding'|'payout'|'refund',fail = false): Promise<BankEvent> {
    return this.db.transaction(async tx => {
      const ref=`${id}:${kind}`;
      const old=(await tx.query<{event:BankEvent}>('select event from sandbox.provider_operations where reference=$1',[ref])).rows[0];
      if(old) return old.event;
      const t=(await tx.query<Transfer>('select * from sandbox.transfers where id=$1',[id])).rows[0];
      if(!t) throw new SandboxError('NOT_FOUND',404);
      if ((kind==='funding' && t.state!=='awaiting_funding') || (kind==='payout' && !['payout_pending','payout_unknown'].includes(t.state)) || (kind==='refund' && t.state!=='refund_pending')) throw new SandboxError('PROVIDER_PRECONDITION');
      const e:BankEvent={id:randomUUID(),transferId:id,reference:ref,amountMinor:t.amount_minor,currency:'BAM',recipient:'@bob',
        type:kind==='funding'?'funding_settled':kind==='refund'?'refund_settled':fail?'payout_failed':'recipient_credited'};
      await tx.query('insert into sandbox.provider_operations values($1,$2,$3)',[ref,JSON.stringify(e),kind==='funding'?t.amount_minor:fail?0:-t.amount_minor]);
      return e;
    });
  }
  async dispatch(id: string,secret: string,options: {fail?:boolean;loseResponse?:boolean} = {}) {
    const t=await this.get(id), kind=t.state==='refund_pending'?'refund':'payout';
    if (!['payout_pending','payout_unknown','refund_pending'].includes(t.state)) throw new SandboxError('NO_WORK');
    const e=await this.simulateProvider(id,kind,options.fail);
    if(options.loseResponse) {
      await this.db.transaction(async tx=>{
        await tx.query("update sandbox.outbox set state='unknown' where transfer_id=$1 and kind=$2 and state<>'done'",[id,kind]);
        await tx.query("update sandbox.transfers set state='payout_unknown' where id=$1 and state='payout_pending'",[id]);
        await this.audit(tx,id,'provider_acknowledgement_lost');
      });
      return {state:'unknown'};
    }
    // Re-dispatch queries the same persistent provider reference; never creates a new movement.
    const raw=JSON.stringify(e),timestamp=String(Date.now());
    return this.webhook(raw,timestamp,sign(raw,timestamp,secret),secret);
  }
  async reconcile() {
    const cash=(await this.db.query<{value:number}>("select coalesce(sum(case when debit='partner_cash' then amount_minor else -amount_minor end),0)::integer value from sandbox.journals")).rows[0]!.value;
    const partner=(await this.db.query<{value:number}>('select coalesce(sum(cash_delta),0)::integer value from sandbox.provider_operations')).rows[0]!.value;
    const pending=(await this.db.query<{value:number}>("select coalesce(sum(amount_minor),0)::integer value from sandbox.transfers where state in ('payout_pending','payout_unknown','refund_pending')")).rows[0]!.value;
    return {currency:'BAM',cashMinor:cash,partnerCashMinor:partner,pendingMinor:pending,differenceMinor:cash-partner,matched:cash===partner&&cash===pending};
  }
}
