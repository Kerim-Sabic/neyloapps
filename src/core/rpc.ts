import 'server-only';
import { z } from 'zod';
import { databaseError } from '@/lib/errors';

export async function rpcResult<T>(operation:PromiseLike<{data:unknown;error:{message:string;code?:string}|null}>,schema:z.ZodType<T>):Promise<T>{
  const {data,error}=await operation;
  if(error)databaseError(error.message,error.code);
  return schema.parse(data);
}
export const voidResult=z.unknown().transform(()=>({ok:true as const}));
