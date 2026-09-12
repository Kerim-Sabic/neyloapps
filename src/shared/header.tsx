import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Brand } from './brand';
export function Header({signedIn=false}:{signedIn?:boolean}){return <header className="site-header"><Brand/><nav aria-label="Main navigation"><Link className="nav-link" href={signedIn?'/account':'/signin'}>{signedIn?'My account':'Sign in'}<ArrowUpRight size={16} aria-hidden="true"/></Link></nav></header>;}
