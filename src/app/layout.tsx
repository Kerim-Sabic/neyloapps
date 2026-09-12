import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Footer } from '@/shared/footer';
import { Header } from '@/shared/header';
import { optionalUser } from '@/core/supabase';
import './globals.css';
export const metadata:Metadata={metadataBase:new URL('https://neylo.xyz'),title:{default:'neylo · One address for money.',template:'%s · neylo'},description:'Reserve your NEYLO @handle before launch. An early-access identity with promotional launch fee credits for eligible founding accounts.',alternates:{canonical:'https://neylo.xyz'},openGraph:{title:'Your name. Your money address.',description:'Reserve your NEYLO identity before launch.',url:'https://neylo.xyz',siteName:'neylo',type:'website'},robots:{index:true,follow:true}};
export default async function RootLayout({children}:{children:React.ReactNode}){const user=await optionalUser();return <html lang="en" className={GeistSans.variable}><body><a className="skip-link" href="#main">Skip to content</a><Header signedIn={Boolean(user)}/>{children}<Footer/></body></html>;}
