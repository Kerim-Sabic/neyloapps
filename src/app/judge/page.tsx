import { LoadDashboard } from '@/features/admin/load-dashboard';
export const metadata={title:'Judge Mode',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default function Judge(){return <LoadDashboard judge/>;}
