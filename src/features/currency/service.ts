import 'server-only';
import { cookies,headers } from 'next/headers';
import { bamPerEuro,countryCurrency,currencyChoice,type CurrencyDisplay } from './domain';
import { fetchCurrencyQuote,type Quote } from './rates';

const quotes=new Map<string,{value:Quote|null;until:number}>();
const pending=new Map<string,Promise<Quote|null>>();
async function quote(currency:string):Promise<Quote|null>{
  const saved=quotes.get(currency);if(saved&&saved.until>Date.now())return saved.value;
  const active=pending.get(currency);if(active)return active;
  const lookup=(async()=>{
    const value=await fetchCurrencyQuote(currency);
    quotes.set(currency,{value,until:Date.now()+(value?3600000:60000)});
    return value;
  })();
  pending.set(currency,lookup);
  try{return await lookup;}finally{pending.delete(currency);}
}
export async function getCurrencyDisplay(override?:string):Promise<CurrencyDisplay>{
  const [incoming,jar]=await Promise.all([headers(),cookies()]);
  const detected=countryCurrency(incoming.get('x-neylo-country'));
  const requested=currencyChoice(override??jar.get('neylo_currency')?.value);
  const currency=requested==='auto'?detected:requested;
  if(currency==='BAM')return {requested,detected,currency,rate:1,date:null,unavailable:false};
  if(currency==='EUR')return {requested,detected,currency,rate:1/bamPerEuro,date:null,unavailable:false};
  const value=await quote(currency);
  if(!value)return {requested,detected,currency:'BAM',rate:1,date:null,unavailable:true};
  return {requested,detected,currency,...value,unavailable:false};
}
