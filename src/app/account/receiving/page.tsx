import { redirect } from 'next/navigation';
import { optionalUser } from '@/core/supabase';
import { accountFor } from '@/features/account/service';
import { ReceivingSettings } from '@/features/payments/receiving-settings';
export const metadata={title:'Receiving account',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function ReceivingPage(){const user=await optionalUser();if(!user)redirect('/signin');const account=await accountFor(user.id);if(!account)redirect('/account');return <ReceivingSettings handle={account.handle}/>;}
