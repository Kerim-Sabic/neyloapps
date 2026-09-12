import { redirect } from 'next/navigation';
import { optionalUser } from '@/core/supabase';
import { getRegisteredAccounts } from '@/features/admin/service';
import { RegisteredAccountsView } from '@/features/admin/registered-accounts';
import { AppError } from '@/lib/errors';
export const metadata={title:'Registered accounts',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function Page(){
  if(!await optionalUser())redirect('/signin?next=/admin/accounts');
  try{return <RegisteredAccountsView initial={await getRegisteredAccounts({})}/>;}
  catch(error){if(error instanceof AppError&&error.code==='FORBIDDEN')return <main id="main" className="auth-page"><p className="eyebrow">PRIVATE ACCESS</p><h1>Operator access required.</h1><p>Registered account contact details are available only to authorized operators.</p></main>;throw error;}
}
