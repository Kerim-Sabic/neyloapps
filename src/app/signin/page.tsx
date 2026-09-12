import { SigninForm } from '@/features/signup/signin-form';
import { authConfigured } from '@/core/config';
export const metadata={title:'Sign in',robots:{index:false,follow:false}};
export default async function Signin({searchParams}:{searchParams:Promise<{next?:string}>}){
  const {next}=await searchParams;
  const destination=next&&['/account','/admin/validation','/admin/operations','/admin/accounts','/judge'].includes(next)?next:'/account';
  return <SigninForm configured={authConfigured()} next={destination}/>;
}
