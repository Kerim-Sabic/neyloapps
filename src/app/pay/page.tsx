import type { Metadata } from 'next';
import { PaymentWorkspace } from '@/features/payments/payment-workspace';

export const metadata: Metadata = {
  title: 'Prepare a bank payment',
  description: 'Prepare clear BAM payment instructions. Authorize the payment separately in your bank app.',
  alternates: { canonical: '/pay' },
  robots: { index: false, follow: false },
};

export default function PayPage() {
  return <PaymentWorkspace />;
}
