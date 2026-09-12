import { createServerClient } from '@supabase/ssr';
import { NextResponse,type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.generated';

export async function proxy(request:NextRequest){
  let response=NextResponse.next({request});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(url&&key){
    const auth=createServerClient<Database>(url,key,{cookieOptions:{httpOnly:true,secure:process.env.APP_STAGE!=='development',sameSite:'lax',path:'/'},cookies:{
      getAll:()=>request.cookies.getAll(),
      setAll:values=>{for(const {name,value} of values)request.cookies.set(name,value);response=NextResponse.next({request});for(const {name,value,options} of values)response.cookies.set(name,value,options);}
    }});
    await auth.auth.getClaims();
  }
  response.headers.set('Cache-Control','private, no-store, max-age=0');
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|icon.svg|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)']};
