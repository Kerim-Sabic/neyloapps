import { PolicyPage } from '@/features/legal/policy-page';
export const metadata={title:'Waitlist terms',alternates:{canonical:'https://neylo.xyz/terms'}};
export default async function Terms({searchParams}:{searchParams:Promise<{version?:string}>}){const {version}=await searchParams;return <PolicyPage version={version}/>;}
