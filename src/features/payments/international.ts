import currencies from './currencies.json';
import bankFormats from './bank-formats.json';

// Format support is not provider coverage, residency eligibility or account verification.
export { currencies, bankFormats };
export type Currency = keyof typeof currencies;
export type BankCountry = keyof typeof bankFormats;
export const currencyCodes = Object.keys(currencies) as Currency[];
export const bankCountries = Object.keys(bankFormats) as BankCountry[];
export function isCurrency(value: string): value is Currency { return Object.hasOwn(currencies,value); }
export function isBankCountry(value: string): value is BankCountry { return Object.hasOwn(bankFormats,value); }

/** Exact decimal parsing: no rounding, exponents, grouping or float multiplication. */
export function parseMoney(value: string, currency: Currency): number | null {
  if (!isCurrency(currency)) return null;
  const digits=currencies[currency].digits;
  const pattern=digits ? new RegExp(`^\\d{1,9}(?:[.,]\\d{1,${digits}})?$`) : /^\d{1,9}$/;
  if(!pattern.test(value.trim()))return null;
  const [whole='',fraction='']=value.trim().replace(',','.').split('.');
  const minor=Number(whole+fraction.padEnd(digits,'0'));
  return Number.isSafeInteger(minor)&&minor>0?minor:null;
}
export function decimalMoney(minor:number,currency:Currency):string {
  if(!isCurrency(currency)||!Number.isSafeInteger(minor)||minor<0)throw new Error('Invalid money');
  const digits=currencies[currency].digits;
  const raw=String(minor).padStart(digits+1,'0');
  return digits?`${raw.slice(0,-digits)}.${raw.slice(-digits)}`:raw;
}
export function formatMoney(minor:number,currency:Currency){return `${decimalMoney(minor,currency)} ${currency}`;}
export function validInternationalIban(value:string,country:string):boolean {
  if(!isBankCountry(country))return false;
  const iban=value.replace(/\s/g,'').toUpperCase();
  if(!new RegExp(`^${bankFormats[country].pattern}$`).test(iban))return false;
  const digits=(iban.slice(4)+iban.slice(0,4)).replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55));
  let remainder=0;
  for(const digit of digits)remainder=(remainder*10+Number(digit))%97;
  return remainder===1;
}
export function suggestedCurrency(country:BankCountry):Currency {
  const code=bankFormats[country].defaultCurrency;
  return isCurrency(code)?code:'BAM';
}
// A conservative product preparation limit, not a bank limit or FX equivalence.
export function planAmount(value:string,currency:Currency):number|null {
  const minor=parseMoney(value,currency),scale=10**currencies[currency].digits;
  return minor!==null&&minor>=scale&&minor<=100*scale?minor:null;
}
