import type { Metadata } from 'next';
import { SharedDemoApp } from '@/features/demo/shared/shared-app';
export const metadata:Metadata={title:'Kerim · NEYLO product experience',robots:{index:false,follow:false},referrer:'no-referrer',alternates:{canonical:'/demo/kerim'}};
export default function KerimDemo(){return <SharedDemoApp person="kerim"/>;}
