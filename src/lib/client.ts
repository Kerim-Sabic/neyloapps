import { z } from 'zod';
import { errorSchema } from './domain';
export class RequestError extends Error{constructor(public code:string,message:string){super(message);}}
export async function request<T>(path:string,schema:z.ZodType<T>,body?:unknown):Promise<T>{
  const response=await fetch(`/api/${path}`,{method:body===undefined?'GET':'POST',cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data:unknown=await response.json();
  if(!response.ok){const error=errorSchema.safeParse(data);throw new RequestError(error.success?error.data.error.code:'NETWORK',error.success?error.data.error.message:'Connection interrupted. Retry safely.');}
  return schema.parse(data);
}
export const okSchema=z.object({ok:z.literal(true)});
