'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import useSWR from 'swr';
import { z } from 'zod';
import { parseAmount } from '../quote';
import { ROOM_KEY,snapshotSchema,tokenSchema,type Person,type Snapshot } from './domain';

type TimedSnapshot=Snapshot&{receivedAt:number};
const messages:Record<string,string>={SERVICE_UNAVAILABLE:'The connection is unavailable. Please retry shortly.',INVALID_INPUT:'Check the amount and try again.',SESSION_EXPIRED:'This session has ended. Start a new paired session.',SESSION_NOT_FOUND:'This session is unavailable. Check the pairing link or start a new session.',SESSION_REQUIRED:'Open the pairing link to connect these pages.',TRANSFER_IN_PROGRESS:'A transfer is already on its way. Follow its arrival first.',SESSION_FULL:'This session has reached its limit. Start a new paired session.',IDEMPOTENCY_CONFLICT:'This request has already been used. Refresh to see the saved transfer.'};
async function api(path:string,token:string,body?:unknown):Promise<TimedSnapshot&{token?:string}>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10_000);
  try{
    const response=await fetch(`/api/demo-room${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{'X-Neylo-Demo-Room':token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:controller.signal});
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('The connection was interrupted. Retry safely to check the same transfer.');
    const json:unknown=await response.json();
    if(!response.ok){const error=z.object({error:z.string()}).parse(json).error;throw new Error(messages[error]??error);}
    const parsed=snapshotSchema.extend({token:tokenSchema.optional()}).parse(json);
    return {...parsed,receivedAt:performance.now()};
  }catch(error){if(error instanceof Error&&error.name==='AbortError')throw new Error('The connection timed out. Retry safely with the same transfer.');throw error;}
  finally{clearTimeout(timeout);}
}
export function useRoom(person:Person){
  const [token,setToken]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[stage,setStage]=useState(true),[reconnect,setReconnect]=useState(0);
  const inFlight=useRef(false),generation=useRef(0);
  const {data,error,mutate}=useSWR(token?['shared-demo-room',token]:null,([,roomToken]:[string,string])=>api('',roomToken),{refreshInterval:(snapshot:TimedSnapshot|undefined)=>snapshot&&snapshot.serverNow+Math.max(0,performance.now()-snapshot.receivedAt)>=snapshot.room.expiresAt?0:snapshot?.room.transfers.some(t=>t.completedAt===null)?750:2000,refreshWhenHidden:false,revalidateOnFocus:true,dedupingInterval:400,shouldRetryOnError:false});
  useEffect(()=>{
    const restore=async()=>{
      const current=++generation.current;
      setReady(false);setNotice('');setToken('');
      const fragment=new URLSearchParams(location.hash.slice(1)).get('room');
      try{
        if(fragment!==null){setStage(false);setToken(tokenSchema.parse(fragment));}
        else{setStage(true);const next=await api('/stage','');if(current!==generation.current)return;setToken(tokenSchema.parse(next.token));}
      }catch(error){if(current===generation.current)setNotice(error instanceof z.ZodError?'This pairing link is invalid. Open the page without its pairing link to join the presentation.':error instanceof Error?error.message:'Could not connect. Please retry.');}
      finally{if(current===generation.current)setReady(true);}
    };
    void restore();window.addEventListener('hashchange',restore);
    return()=>{generation.current++;window.removeEventListener('hashchange',restore);};
  },[reconnect]);
  const create=useCallback(async()=>{
    if(inFlight.current)return null;inFlight.current=true;setBusy(true);setNotice('');const current=++generation.current;
    try{const next=await api('/create','',{});if(current!==generation.current)return null;const created=tokenSchema.parse(next.token);setStage(false);setToken(created);history.replaceState(null,'',`${location.pathname}#room=${created}`);try{localStorage.setItem(ROOM_KEY,created);}catch{}return created;}
    catch(e){if(current===generation.current)setNotice(e instanceof Error?e.message:'Could not connect. Please retry.');return null;}
    finally{inFlight.current=false;setBusy(false);}
  },[]);
  async function send(amount:string){
    if(inFlight.current||!token)return null;inFlight.current=true;setBusy(true);setNotice('');const current=generation.current;
    const key=`${ROOM_KEY}:pending:${token}:${person}`;
    let intent={key:crypto.randomUUID(),sender:person,amount};
    try{
      try{const saved=localStorage.getItem(key);if(saved)intent=z.object({key:z.uuid(),sender:z.literal(person),amount:z.string()}).parse(JSON.parse(saved));localStorage.setItem(key,JSON.stringify(intent));}catch{}
      const priorAmount=parseAmount(intent.amount),nextAmount=parseAmount(amount);
      if(intent.amount!==amount&&(!priorAmount.ok||!nextAmount.ok||priorAmount.minor!==nextAmount.minor))throw new Error(`Retry the previous ${intent.amount} KM transfer, or start a new paired session before changing the amount.`);
      const next=await api('/send',token,intent);if(current!==generation.current)return null;
      await mutate(next,{revalidate:false});try{localStorage.removeItem(key);}catch{}return next.room.transfers.find(t=>t.key===intent.key)??null;
    }catch(e){if(current===generation.current)setNotice(e instanceof Error?e.message:'Unable to send. Retry to check the same transfer.');return null;}
    finally{inFlight.current=false;setBusy(false);}
  }
  return {token,ready,busy,stage,data,connected:!!data&&!error,error:notice||(error instanceof Error?error.message:''),create,send,refresh:()=>token?mutate():setReconnect(value=>value+1)};
}
