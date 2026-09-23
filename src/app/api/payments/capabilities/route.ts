import { paymentCapabilities } from '@/features/payments/provider';

export function GET() {
  return Response.json({
    version: 1,
    mode: 'bank_instructions',
    preparation: { currency: 'BAM', minAmountMinor: 100, maxAmountMinor: 10_000 },
    ...paymentCapabilities,
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
