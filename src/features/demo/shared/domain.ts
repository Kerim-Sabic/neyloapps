import { z } from 'zod';
import { calculateQuotes, parseAmount, type Quote } from '../quote';
import { advanceTransfer, beginTransfer, duration } from '../simulation';

export const PEOPLE = {
  nadin: { name:'Nadin', handle:'@nadin', initials:'N', email:'nadin.khatib@example.com', source:'Intesa' },
  kerim: { name:'Kerim', handle:'@kerim', initials:'K', email:'kerim@example.com', source:'Raiffeisen' },
} as const;
export type Person = keyof typeof PEOPLE;
export const otherPerson = (person:Person):Person => person==='nadin'?'kerim':'nadin';
export const ARRIVAL_MS=15_000;
export const MAX_ROOM_TRANSFERS=200;
export const ROOM_LIFETIME_MS=24*60*60*1000;
export const ROOM_KEY='neylo:demo:pair:v1';
export const tokenSchema=z.string().regex(/^[a-f0-9]{48}$/);
export const sendSchema=z.object({key:z.uuid(),sender:z.enum(['nadin','kerim']),amount:z.string().max(20)}).strict();
export const sharedTransferSchema=z.object({id:z.uuid(),key:z.uuid(),sender:z.enum(['nadin','kerim']),recipient:z.enum(['nadin','kerim']),sentMinor:z.number().int().min(100).max(1_000_000),feeMinor:z.number().int().nonnegative(),receivedMinor:z.number().int().positive(),startedAt:z.number(),arrivesAt:z.number(),completedAt:z.number().nullable()});
export type SharedTransfer=z.infer<typeof sharedTransferSchema>;
export const roomSchema=z.object({version:z.literal(1),createdAt:z.number(),expiresAt:z.number(),revision:z.number().int(),transfers:z.array(sharedTransferSchema).max(MAX_ROOM_TRANSFERS)});
export type Room=z.infer<typeof roomSchema>;
export const snapshotSchema=z.object({room:roomSchema,serverNow:z.number()});
export type Snapshot=z.infer<typeof snapshotSchema>;
export class RoomError extends Error { constructor(public code:string,public status=409){super(code);} }

export function newRoom(now:number):Room {return {version:1,createdAt:now,expiresAt:now+ROOM_LIFETIME_MS,revision:0,transfers:[]};}
export function advanceRoom(room:Room,now:number):Room {
  if(now>=room.expiresAt)throw new RoomError('SESSION_EXPIRED',410);
  let changed=false;
  const transfers=room.transfers.map(t=>{if(t.completedAt===null&&now>=t.arrivesAt){changed=true;return {...t,completedAt:t.arrivesAt};}return t;});
  return changed?{...room,transfers,revision:room.revision+1}:room;
}
export function sendInRoom(room:Room,input:unknown,now:number,id:string):Room {
  const data=sendSchema.parse(input),amount=parseAmount(data.amount);
  if(!amount.ok)throw new RoomError(amount.error,400);
  const prior=room.transfers.find(t=>t.key===data.key);
  if(prior){if(prior.sender!==data.sender||prior.sentMinor!==amount.minor)throw new RoomError('IDEMPOTENCY_CONFLICT');return room;}
  const current=advanceRoom(room,now);
  if(current.transfers.some(t=>t.completedAt===null))throw new RoomError('TRANSFER_IN_PROGRESS');
  if(current.transfers.length>=MAX_ROOM_TRANSFERS)throw new RoomError('SESSION_FULL');
  const quote=calculateQuotes('kesh',amount.minor,now)[0];
  if(!quote)throw new RoomError('Enter an amount between 1 and 10,000 KM.',400);
  return {...current,revision:current.revision+1,transfers:[...current.transfers,{id,key:data.key,sender:data.sender,recipient:otherPerson(data.sender),sentMinor:quote.sentMinor,feeMinor:quote.feeMinor,receivedMinor:quote.receivedMinor,startedAt:now,arrivesAt:now+ARRIVAL_MS,completedAt:null}]};
}

export function pairQuote(sentMinor:number,sender:Person,now:number,stored?:SharedTransfer):Quote|null {
  const quote=calculateQuotes('kesh',sentMinor,now)[0];if(!quote)return null;
  const recipient=otherPerson(sender);
  return {...quote,...(stored?{feeMinor:stored.feeMinor,receivedMinor:stored.receivedMinor}:{}),route:{...quote.route,nodes:[
    {id:'sender',name:PEOPLE[sender].source,detail:`${PEOPLE[sender].handle} · source`,initials:PEOPLE[sender].initials},
    {id:'routing',name:'Local transfer route',detail:'NEYLO routing',initials:'N'},
    {id:'recipient',name:PEOPLE[recipient].source,detail:`${PEOPLE[recipient].handle} · destination`,initials:PEOPLE[recipient].initials},
  ]}};
}
export function projectTransfer(record:SharedTransfer,now:number){
  const quote=pairQuote(record.sentMinor,record.sender,record.startedAt,record)!;
  // Client interpolation may reach the destination, but cannot declare arrival.
  // Only the canonical room record can release the final completion event.
  const elapsed=record.completedAt!==null?duration(quote):Math.min(duration(quote)-1,Math.max(0,(now-record.startedAt)/ARRIVAL_MS*duration(quote)));
  return advanceTransfer(beginTransfer(record.id,quote,record.startedAt,false),elapsed);
}
