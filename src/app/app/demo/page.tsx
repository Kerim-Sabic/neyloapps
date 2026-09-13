import type { Metadata } from 'next';
import { DemoApp } from '@/features/demo/demo-app';

export const metadata: Metadata = { title: 'Product experience', description: 'Explore the NEYLO product experience.', alternates: { canonical: 'https://neylo.xyz/app/demo' }, robots: { index: false, follow: false } };
export default function DemoPage() { return <DemoApp/>; }
