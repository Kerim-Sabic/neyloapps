import { LoadLanding } from '@/features/signup/load-landing';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const query=await searchParams;return <LoadLanding source={query.utm_source} campaignTag={query.utm_campaign}/>;}
