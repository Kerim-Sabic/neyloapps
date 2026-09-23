'use client';
import {useId} from 'react';
import { bankCountries, bankFormats, currencies, currencyCodes, type Currency } from './international';

export function BankCountryField({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const id=useId();
  return <div><label htmlFor={id}>Bank country</label><select id={id} value={value} onChange={e=>onChange(e.target.value)}>
    {bankCountries.map(code=><option key={code} value={code}>{bankFormats[code].name}</option>)}
    <option value="unsupported">Another country / account format</option>
  </select></div>;
}
const preferred:Currency[]=['BAM','EUR','USD','GBP','CHF','JPY','KWD'];
export function CurrencyField({value,onChange,disabled=false}:{value:Currency;onChange:(value:Currency)=>void;disabled?:boolean}) {
  const id=useId();
  return <div><label htmlFor={id}>Account currency</label><select id={id} value={value} disabled={disabled} onChange={e=>onChange(e.target.value as Currency)}>
    {[...preferred,...currencyCodes.filter(code=>!preferred.includes(code))].map(code=><option key={code} value={code}>{code} · {currencies[code].name}</option>)}
  </select></div>;
}
export function UnavailableFormat(){return <p className="pay-note" role="status">This account format is not available yet. Keep your Neylo username; more local account formats will be added as they are validated. Do not enter a routing number, BSB or IFSC in an IBAN field.</p>;}
