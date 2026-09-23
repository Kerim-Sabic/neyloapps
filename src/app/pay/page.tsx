import type { Metadata } from 'next';
import { PaymentWorkspace } from '@/features/payments/payment-workspace';

export const metadata: Metadata = {
  title: 'Prepare a bank payment',
  description: 'Prepare payment instructions by username, with account-specific countries and currencies. Authorize the payment separately in your bank app.',
  alternates: { canonical: '/pay' },
  robots: { index: false, follow: false },
};

export default function PayPage() {
  return <PaymentWorkspace />;
}
