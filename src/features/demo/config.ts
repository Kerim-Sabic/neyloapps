export type RecipientId = 'kesh' | 'anna';
export type Preference = 'cost' | 'speed' | 'bank';
export type Currency = 'BAM' | 'USDC' | 'EUR';
export type RouteNode = { id: string; name: string; detail: string; initials: string };
export type RouteFixture = {
  id: string; recipient: RecipientId; name: string; bankOnly: boolean;
  fixedFee: number; feeBps: number; fxNumerator: number; fxDenominator: number;
  etaSeconds: number; eta: string; minMinor: number; maxMinor: number;
  nodes: readonly RouteNode[];
};

export const CONTACTS = [
  { id: 'kesh', name: 'Kesh', handle: '@kesh', bank: 'Raiffeisen', country: 'Bosnia', currency: 'BAM', source: 'Intesa', defaultAmount: '10', initials: 'K' },
  { id: 'anna', name: 'Anna', handle: '@anna', bank: 'EUR bank destination', country: 'Germany', currency: 'USDC', source: 'USDC wallet', defaultAmount: '100', initials: 'A' },
] as const;

export function contact(id: RecipientId) { return id === 'kesh' ? CONTACTS[0] : CONTACTS[1]; }
export const PREFERENCES: Record<Preference, string> = { cost: 'Lowest cost', speed: 'Fastest', bank: 'Bank-only' };
export const QUOTE_LIFETIME_MS = 120_000;
export const MAX_AMOUNT_MINOR = 1_000_000;

const internationalNodes = [
  { id: 'sender', name: 'USDC wallet', detail: '@noomy · source', initials: 'N' },
  { id: 'settlement', name: 'Stablecoin settlement', detail: 'Settlement leg', initials: 'S' },
  { id: 'fx', name: 'Off-ramp / FX', detail: 'USDC → EUR conversion', initials: 'F' },
  { id: 'payout', name: 'Local EUR payout rail', detail: 'EUR delivery leg', initials: '€' },
  { id: 'recipient', name: 'Recipient bank', detail: '@anna · Germany', initials: 'A' },
] as const;

// Hackathon fixtures, not provider quotations. All fees are in source minor units.
// FX is rational; fees round up and the destination rounds half-up to two decimals.
export const ROUTES: readonly RouteFixture[] = [
  { id: 'local-bank', recipient: 'kesh', name: 'Direct bank route', bankOnly: true,
    fixedFee: 10, feeBps: 0, fxNumerator: 1, fxDenominator: 1,
    etaSeconds: 30, eta: 'Under a minute', minMinor: 100, maxMinor: MAX_AMOUNT_MINOR,
    nodes: [
      { id: 'sender', name: 'Intesa', detail: '@noomy · source', initials: 'N' },
      { id: 'ips', name: 'IPS BiH', detail: 'Domestic payment rail', initials: 'I' },
      { id: 'recipient', name: 'Raiffeisen', detail: '@kesh · Bosnia', initials: 'K' },
    ] },
  { id: 'eur-economy', recipient: 'anna', name: 'Standard EUR route', bankOnly: false,
    fixedFee: 40, feeBps: 40, fxNumerator: 92, fxDenominator: 100,
    etaSeconds: 14_400, eta: '2–4 hours', minMinor: 500, maxMinor: MAX_AMOUNT_MINOR, nodes: internationalNodes },
  { id: 'eur-express', recipient: 'anna', name: 'Express EUR route', bankOnly: false,
    fixedFee: 95, feeBps: 80, fxNumerator: 92, fxDenominator: 100,
    etaSeconds: 900, eta: '5–15 minutes', minMinor: 500, maxMinor: MAX_AMOUNT_MINOR, nodes: internationalNodes },
];
