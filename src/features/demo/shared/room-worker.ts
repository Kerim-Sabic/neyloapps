import { z } from 'zod';
import { advanceRoom,newRoom,RoomError,sendInRoom,tokenSchema,type Room } from './domain';

type Storage={get<T>(key:string):Promise<T|undefined>;put(key:string,value:unknown):Promise<void>;setAlarm(time:number):Promise<void>;deleteAll():Promise<void>};
type Context={storage:Storage;blockConcurrencyWhile<T>(fn:()=>Promise<T>):Promise<T>};
type Namespace={getByName(name:string):{fetch(request:Request):Promise<Response>}};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});

function failure(error:unknown){return json({error:error instanceof RoomError?error.code:error instanceof z.ZodError||error instanceof SyntaxError?'INVALID_INPUT':'SERVICE_UNAVAILABLE'},error instanceof RoomError?error.status:error instanceof z.ZodError||error instanceof SyntaxError?400:503);}

/** This namespace contains presentation activity only. No Supabase client,
 * real identity, acquisition event, promotional ledger or bank API is involved. */
export class DemoRoom {
  constructor(private ctx:Context){}
  async fetch(request:Request){
    try{
      const path=new URL(request.url).pathname;
      const body=request.method==='POST'?await request.json():null;
      return await this.ctx.blockConcurrencyWhile(async()=>{
        try{
        const now=Date.now(),store=this.ctx.storage;
        if(path==='/limit'){
          const saved=await store.get<{count:number;until:number}>('limit');
          const limit=saved&&saved.until>now?saved:{count:0,until:now+3_600_000};
          if(limit.count>=24)return json({error:'Please try creating a session later.'},429);
          await store.put('limit',{...limit,count:limit.count+1});await store.setAlarm(limit.until);return json({ok:true});
        }
        let room=await store.get<Room>('room');
        if(path==='/create'&&request.method==='POST'&&!room){room=newRoom(now);await store.put('room',room);await store.setAlarm(room.expiresAt);}
        if(!room)throw new RoomError('SESSION_NOT_FOUND',404);
        const current=advanceRoom(room,now);
        const next=path==='/send'&&request.method==='POST'?sendInRoom(current,body,now,crypto.randomUUID()):current;
        if(next!==room){await store.put('room',next);await store.setAlarm(next.transfers.find(t=>t.completedAt===null)?.arrivesAt??next.expiresAt);}
        return json({room:next,serverNow:now});
        }catch(error){return failure(error);}
      });
    }catch(error){return failure(error);}
  }
  async alarm(){
    await this.ctx.blockConcurrencyWhile(async()=>{
      const store=this.ctx.storage,room=await store.get<Room>('room'),now=Date.now();
      if(!room||now>=room.expiresAt){await store.deleteAll();return;}
      const next=advanceRoom(room,now);if(next!==room)await store.put('room',next);
      await store.setAlarm(next.transfers.find(t=>t.completedAt===null)?.arrivesAt??next.expiresAt);
    });
  }
}

export async function sharedDemoRequest(request:Request,env:Record<string,unknown>){
  const namespace=env.DEMO_ROOMS as Namespace|undefined;
  if(!namespace)return json({error:'Shared sessions are unavailable. Please retry shortly.'},503);
  const url=new URL(request.url),path=url.pathname.replace('/api/demo-room','')||'/';
  if(!['/','/create','/send'].includes(path)||!['GET','POST'].includes(request.method))return json({error:'NOT_FOUND'},404);
  if(request.method==='POST'){
    if(request.headers.get('origin')!==url.origin)return json({error:'INVALID_ORIGIN'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'INVALID_INPUT'},415);
  }
  let body:string|undefined;
  if(request.method==='POST'){
    const reader=request.body?.getReader();if(!reader)return json({error:'INVALID_INPUT'},400);
    let size=0;const chunks:Uint8Array[]=[];
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();return json({error:'INVALID_INPUT'},413);}chunks.push(value);}
    const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}body=new TextDecoder().decode(data);
  }
  if(path==='/create'&&body){try{z.object({}).strict().parse(JSON.parse(body));}catch{return json({error:'INVALID_INPUT'},400);}}
  if(path==='/create'){
    if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
    // Hash the transport-provided IP; it is never stored in the room or returned.
    const ip=request.headers.get('cf-connecting-ip')??'local';
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
    const rateKey=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
    const limited=await namespace.getByName(`rate:${rateKey}`).fetch(new Request('https://demo.internal/limit',{method:'POST',body:'{}'}));
    if(!limited.ok)return limited;
    await limited.text();
    const token=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
    const response=await namespace.getByName(`room:${token}`).fetch(new Request('https://demo.internal/create',{method:'POST',body:'{}'}));
    if(!response.ok)return response;
    return json({...await response.json() as object,token});
  }
  const parsed=tokenSchema.safeParse(request.headers.get('x-neylo-demo-room'));if(!parsed.success)return json({error:'SESSION_REQUIRED'},401);
  if(path==='/send'&&request.method!=='POST'||path==='/'&&request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
  return namespace.getByName(`room:${parsed.data}`).fetch(new Request(`https://demo.internal${path}`,{method:request.method,...(body?{body}:{})}));
}
