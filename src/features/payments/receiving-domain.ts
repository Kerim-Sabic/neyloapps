import { z } from 'zod';
import { normalizeIban, validName } from './domain';

import { bankCountries, currencyCodes, validInternationalIban } from './international';

// Display choices, not a coverage directory. Source: cbbh.ba/content/read/7.
export const bankChoices = ['Addiko Bank Sarajevo','ASA Banka','Bosna Bank International','Intesa Sanpaolo Banka BiH','NLB Banka Sarajevo','NLB Banka Banja Luka','Raiffeisen Bank BiH','Sparkasse Bank BiH','UniCredit Bank Mostar','UniCredit Bank Banja Luka','Other bank'] as const;
const name = z.string().trim().refine(validName, 'Enter the full account-holder or bank name.');
const destinationFields = z.object({
  accountName: name, iban: z.string().max(50).transform(normalizeIban),
  bankCountry: z.enum(bankCountries).default('BA'), currency: z.enum(currencyCodes).default('BAM'),
  bankName: name.refine(value=>value!=='Other bank','Enter your bank’s legal name.'), bic: z.string().trim().toUpperCase().regex(/^(?:[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)?$/, 'Use an 8 or 11 character BIC, or leave blank.'),
  discoverable: z.boolean(), version: z.uuid().nullable(),
}).strict();
const validDestination=(value:{iban:string;bankCountry:string})=>validInternationalIban(value.iban,value.bankCountry);
export const destinationInputSchema = destinationFields.refine(validDestination,{message:'Enter a valid IBAN for the selected bank country.',path:['iban']});
export const destinationSchema = destinationFields.extend({ version: z.uuid(), verification: z.literal('self_declared') }).refine(validDestination,{message:'Invalid destination IBAN.'});
export const recipientSchema = z.object({
  handle: z.string().regex(/^[a-z0-9_]{3,20}$/), accountName: name, bankName: name,
  last4: z.string().regex(/^[A-Z0-9]{4}$/), version: z.uuid(), verification: z.literal('self_declared'), currency: z.enum(currencyCodes), bankCountry:z.enum(bankCountries).default('BA'),
});
export const handleLookupSchema = z.object({handle:z.string().trim().toLowerCase().transform(v=>v.replace(/^@/, '')).pipe(z.string().regex(/^[a-z0-9_]{3,20}$/))}).strict();
export type ReceivingDestination = z.infer<typeof destinationSchema>;
export type HandleRecipient = z.infer<typeof recipientSchema>;

// Explicit projection prevents response metadata from entering strict write requests.
export function receivingForm(destination: ReceivingDestination) {
  const {accountName, iban, bankName, bic, discoverable, currency, bankCountry}=destination;
  return {accountName, iban, bankName, bic, discoverable, currency, bankCountry};
}
