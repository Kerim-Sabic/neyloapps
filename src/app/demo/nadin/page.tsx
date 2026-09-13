import type { Metadata } from 'next';
import { SharedDemoApp } from '@/features/demo/shared/shared-app';
export const metadata:Metadata={title:'Nadin · NEYLO product experience',robots:{index:false,follow:false},referrer:'no-referrer',alternates:{canonical:'/demo/nadin'}};
export default function NadinDemo(){return <SharedDemoApp person="nadin"/>;}
