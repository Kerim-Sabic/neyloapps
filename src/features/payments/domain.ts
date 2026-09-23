/** Pure payment preparation. No network calls, custody, or execution. */
export const MAX_AMOUNT_MINOR = 10_000;
export const MIN_AMOUNT_MINOR = 100;
export type Recipient = { name: string; iban: string };
export type PaymentPlan = {
  version: 1;
  id: string;
  createdAt: string;
  recipient: Recipient;
  amountMinor: number;
  currency: 'BAM';
  note: string;
  recipientHandle?: string;
  bankName?: string;
  bic?: string;
};
export type PlanStatus = 'prepared' | 'reported_sent';

export function parseBam(value: string): number | null {
  const input = value.trim();
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(input)) return null;
  const [whole = '', fraction = ''] = input.replace(',', '.').split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return minor >= MIN_AMOUNT_MINOR && minor <= MAX_AMOUNT_MINOR ? minor : null;
}

export function bam(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Invalid minor units');
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')} BAM`;
}

export function normalizeIban(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}

/** BA prefix and length + ISO 13616 checksum. NOT account existence/ownership. */
export function validBosnianIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^BA39\d{16}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + '1110' + iban.slice(2, 4);
  let remainder = 0;
  for (const digit of rearranged) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export function formattedIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})(?=.)/g, '$1 ');
}

export function validName(value: string): boolean {
  const name = value.trim();
  return name.length >= 2 && name.length <= 100 && /\p{L}/u.test(name) && !/[\p{C}<>]/u.test(name);
}

export function validNote(value: string): boolean {
  return value.trim().length <= 100 && !/[\p{C}<>]/u.test(value);
}

export function createPlan(input: {
  name: string; iban: string; amount: string; note: string;
}, id: string, createdAt: string): PaymentPlan {
  const amountMinor = parseBam(input.amount);
  if (!validName(input.name) || !validBosnianIban(input.iban) || amountMinor === null || !validNote(input.note)) {
    throw new Error('Check recipient, account, amount and payment purpose.');
  }
  if (!/^[a-f0-9-]{36}$/i.test(id) || !Number.isFinite(Date.parse(createdAt))) throw new Error('Invalid plan identity');
  return { version: 1, id, createdAt, recipient: { name: input.name.trim(), iban: normalizeIban(input.iban) }, amountMinor, currency: 'BAM', note: input.note.trim() };
}

/** User reports can never produce an executed or settled payment state. */
export function reportSent(status: PlanStatus): PlanStatus {
  if (status !== 'prepared' && status !== 'reported_sent') throw new Error('Invalid plan status');
  return 'reported_sent';
}

export function instructions(plan: PaymentPlan, status: PlanStatus): string {
  return [
    'NEYLO — BANK PAYMENT PLAN',
    'Not proof of payment. Neylo has not moved or verified any money.',
    `Status: ${status === 'reported_sent' ? 'Reported sent by you; not bank-confirmed' : 'Prepared; not sent'}`,
    `Recipient (${plan.recipientHandle ? 'supplied by @'+plan.recipientHandle+'; not bank-verified' : 'entered by you'}): ${plan.recipient.name}`,
    ...(plan.bankName ? [`Bank (recipient supplied): ${plan.bankName}`] : []),
    ...(plan.bic ? [`SWIFT / BIC: ${plan.bic}`] : []),
    `IBAN: ${formattedIban(plan.recipient.iban)}`,
    `Domestic account number: ${plan.recipient.iban.slice(4)}`,
    `Payment amount: ${bam(plan.amountMinor)}`,
    `Purpose: ${plan.note || 'Confirm the purpose with the recipient'}`,
    'Bank fees and arrival time: check with your bank before authorizing.',
    'Recipient net amount: not confirmed by Neylo; bank fees may apply.',
    `Plan ID (not a bank reference): ${plan.id}`,
    `Prepared at: ${plan.createdAt}`,
    'Confirm the recipient and account using a trusted channel. Check for an existing payment before trying again.',
  ].join('\n');
}
