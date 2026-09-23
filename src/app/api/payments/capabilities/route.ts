import { bankCountries, currencyCodes, currencies } from '@/features/payments/international';
import { paymentCapabilities } from '@/features/payments/provider';

export function GET() {
  return Response.json({
    version: 2,
    mode: 'bank_instructions',
    preparation: { defaultCurrency:'BAM',bankCountries,currencies:currencyCodes.map(code=>({code,minorDigits:currencies[code].digits})),minMajorUnits:1,maxMajorUnits:100,fxQuotes:false,formatSupportOnly:true },
    ...paymentCapabilities,
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
