import { publicPitchMetrics } from '@/features/pitch/service';

export const dynamic='force-dynamic';
export async function GET(){
  const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
  try{return Response.json(await publicPitchMetrics(),{headers});}
  catch{return Response.json({error:'Traction data is temporarily unavailable. Please retry.'},{status:503,headers});}
}
