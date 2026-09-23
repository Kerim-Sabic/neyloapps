import { z } from 'zod';
import { normalizeIban, validBosnianIban, validName } from './domain';

// Display choices, not a coverage directory. Source: cbbh.ba/content/read/7.
export const bankChoices = ['Addiko Bank Sarajevo','ASA Banka','Bosna Bank International','Intesa Sanpaolo Banka BiH','NLB Banka Sarajevo','NLB Banka Banja Luka','Raiffeisen Bank BiH','Sparkasse Bank BiH','UniCredit Bank Mostar','UniCredit Bank Banja Luka','Other bank'] as const;
const name = z.string().trim().refine(validName, 'Enter the full account-holder or bank name.');
export const destinationInputSchema = z.object({
  accountName: name, iban: z.string().transform(normalizeIban).refine(validBosnianIban, 'Enter a valid Bosnian IBAN.'),
  bankName: name.refine(value=>value!=='Other bank','Enter your bank’s legal name.'), bic: z.string().trim().toUpperCase().regex(/^(?:[A-Z]{4}BA[A-Z0-9]{2}(?:[A-Z0-9]{3})?)?$/, 'Use an 8 or 11 character Bosnian BIC, or leave blank.'),
  discoverable: z.boolean(), version: z.uuid().nullable(),
}).strict();
export const destinationSchema = destinationInputSchema.extend({ version: z.uuid(), verification: z.literal('self_declared'), currency: z.literal('BAM') });
export const recipientSchema = z.object({
  handle: z.string().regex(/^[a-z0-9_]{3,20}$/), accountName: name, bankName: name,
  last4: z.string().regex(/^\d{4}$/), version: z.uuid(), verification: z.literal('self_declared'), currency: z.literal('BAM'),
});
export const handleLookupSchema = z.object({handle:z.string().trim().toLowerCase().transform(v=>v.replace(/^@/, '')).pipe(z.string().regex(/^[a-z0-9_]{3,20}$/))}).strict();
export type ReceivingDestination = z.infer<typeof destinationSchema>;
export type HandleRecipient = z.infer<typeof recipientSchema>;

// Explicit projection prevents response metadata from entering strict write requests.
export function receivingForm(destination: ReceivingDestination) {
  const {accountName, iban, bankName, bic, discoverable}=destination;
  return {accountName, iban, bankName, bic, discoverable};
}
