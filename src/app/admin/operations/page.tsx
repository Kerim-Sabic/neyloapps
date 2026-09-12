import { redirect } from 'next/navigation';
import { adminRole } from '@/features/admin/service';
import { Operations } from '@/features/admin/operations';
import { optionalUser } from '@/core/supabase';
export const metadata={title:'Operations',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function Page(){if(!await optionalUser())redirect('/signin?next=/admin/operations');const {role}=await adminRole();if(role!=='operator')redirect('/judge');return <Operations/>;}
