import type { Metadata } from 'next';
import { Pitch } from '@/features/pitch/pitch';
export const metadata:Metadata={title:'NEYLO — One address for money',description:'The NEYLO pitch: a personal money address, an intelligent routing engine, and a connected product experience.',alternates:{canonical:'/pitch'},openGraph:{title:'NEYLO — One address for money',description:'A name. A route. An arrival.',url:'https://neylo.xyz/pitch'},robots:{index:false,follow:false}};
export default function PitchPage(){return <Pitch/>;}
