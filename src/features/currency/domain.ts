import { z } from 'zod';
import countries from './countries.json';
import { formatCredit } from '@/lib/domain';

// Country mapping: Unicode CLDR currencyData, retrieved 2026-09-12.
// https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/currencyData.json
// The official BAM/EUR peg is 1 EUR = 1.95583 BAM: https://www.cbbh.ba
export const bamPerEuro=1.95583;
export const currencyCodes=[...new Set(Object.values(countries))].filter(code=>/^[A-Z]{3}$/.test(code)).sort();
const countryCurrencies=new Map(Object.entries(countries));
export function countryCurrency(country:string|null){return country?countryCurrencies.get(country.toUpperCase())??'BAM':'BAM';}
export function currencyChoice(value:unknown){return typeof value==='string'&&currencyCodes.includes(value)?value:'auto';}
export const currencyDisplaySchema=z.object({
  requested:z.string(),detected:z.string(),currency:z.string(),rate:z.number().positive(),date:z.string().nullable(),unavailable:z.boolean(),
});
export type CurrencyDisplay=z.infer<typeof currencyDisplaySchema>;
export const defaultDisplay:CurrencyDisplay={requested:'auto',detected:'BAM',currency:'BAM',rate:1,date:null,unavailable:false};
export function formatDisplayCredit(minor:number,display:CurrencyDisplay){
  if(display.currency==='BAM')return formatCredit(minor);
  const formatted=new Intl.NumberFormat('en-US',{style:'currency',currency:display.currency,maximumFractionDigits:2}).format(minor/100*display.rate);
  return `${minor===0?'':'≈ '}${formatted}`;
}
export const rateSchema=z.object({date:z.iso.date(),base:z.literal('EUR'),quote:z.string().regex(/^[A-Z]{3}$/),rate:z.number().finite().positive().max(1e9)});
export function validRate(input:unknown,currency:string,now=Date.now()){
  const parsed=rateSchema.safeParse(input);
  if(!parsed.success||parsed.data.quote!==currency)return null;
  const age=now-Date.parse(`${parsed.data.date}T00:00:00Z`);
  return age>=0&&age<=7*86400000?parsed.data:null;
}
