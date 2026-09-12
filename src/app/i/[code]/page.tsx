import { notFound } from 'next/navigation';
import { LoadLanding } from '@/features/signup/load-landing';
import { database } from '@/core/supabase';
import { authConfigured } from '@/core/config';
import { rpcResult } from '@/core/rpc';
import { invitationCodeSchema,invitationSchema } from '@/lib/domain';
export const metadata={robots:{index:false,follow:false},alternates:{canonical:'https://neylo.xyz'}};
export const dynamic='force-dynamic';
export default async function Invitation({params}:{params:Promise<{code:string}>}){const code=invitationCodeSchema.safeParse((await params).code);if(!code.success||!authConfigured())notFound();const invitation=await rpcResult(database().rpc('neylo_invitation',{p_code:code.data}),invitationSchema.nullable());if(!invitation)notFound();return <LoadLanding invitation={invitation} source="invitation"/>;}
