import { contact, MAX_AMOUNT_MINOR, QUOTE_LIFETIME_MS, ROUTES, type Currency, type Preference, type RecipientId, type RouteFixture } from './config';

export type Quote = {
  route: RouteFixture; sentMinor: number; feeMinor: number; receivedMinor: number;
  sourceCurrency: Currency; destinationCurrency: Currency; createdAt: number; expiresAt: number;
};
export type AmountResult = { ok: true; minor: number } | { ok: false; error: string };

export function parseAmount(raw: string): AmountResult {
  const value = raw.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return { ok: false, error: 'Enter an amount with up to two decimal places.' };
  const [whole = '0', fraction = ''] = value.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor > MAX_AMOUNT_MINOR) return { ok: false, error: 'The maximum amount is 10,000.' };
  if (minor <= 0) return { ok: false, error: 'Enter an amount greater than zero.' };
  return { ok: true, minor };
}

export function calculateQuotes(recipient: RecipientId, sentMinor: number, now: number): Quote[] {
  if (!Number.isSafeInteger(sentMinor)) return [];
  return ROUTES.filter(route => route.recipient === recipient && sentMinor >= route.minMinor && sentMinor <= route.maxMinor)
    .flatMap(route => {
      const feeMinor = route.fixedFee + Math.ceil(sentMinor * route.feeBps / 10_000);
      if (feeMinor >= sentMinor) return [];
      const receivedMinor = Math.floor(((sentMinor - feeMinor) * route.fxNumerator + route.fxDenominator / 2) / route.fxDenominator);
      return [{ route, sentMinor, feeMinor, receivedMinor, sourceCurrency: contact(recipient).currency,
        destinationCurrency: recipient === 'kesh' ? 'BAM' as const : 'EUR' as const, createdAt: now, expiresAt: now + QUOTE_LIFETIME_MS }];
    });
}

export function rankQuotes(quotes: readonly Quote[], preference: Preference): Quote[] {
  return quotes.filter(q => preference !== 'bank' || q.route.bankOnly).slice().sort((a, b) =>
    preference === 'speed' ? a.route.etaSeconds - b.route.etaSeconds || a.feeMinor - b.feeMinor : a.feeMinor - b.feeMinor || a.route.etaSeconds - b.route.etaSeconds);
}

export function selectionReason(quotes: readonly Quote[], selected: Quote): string {
  if (rankQuotes(quotes, 'cost')[0]?.route.id === selected.route.id && rankQuotes(quotes, 'speed')[0]?.route.id === selected.route.id) return 'Best for cost and speed';
  if (rankQuotes(quotes, 'cost')[0]?.route.id === selected.route.id) return 'A lower fee. More arrives.';
  return 'A shorter path to arrival.';
}

export function money(minor: number, currency: Currency) {
  return `${(minor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency === 'BAM' ? 'KM' : currency === 'EUR' ? 'EUR' : 'USDC'}`;
}
