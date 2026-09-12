import { redirect } from 'next/navigation';
import { optionalUser } from '@/core/supabase';
import { operator } from '@/core/config';
import { accountFor } from '@/features/account/service';
import { AccountView } from '@/features/account/account-view';
import { LoadLanding } from '@/features/signup/load-landing';
export const metadata={title:'My account',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function Account(){const user=await optionalUser();if(!user)redirect('/signin');const account=await accountFor(user.id);return account?<AccountView initial={account} support={operator().support}/>:<LoadLanding/>;}
