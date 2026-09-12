import { bamPerEuro,validRate } from './domain';
export type Quote={rate:number;date:string};
export async function fetchCurrencyQuote(currency:string,fetcher:typeof fetch=fetch,now=Date.now()):Promise<Quote|null>{
  try{
    const today=new Date(now).toISOString().slice(0,10);
    // Only currency/date are sent. No visitor IP, cookies, email or account data.
    const response=await fetcher(`https://api.frankfurter.dev/v2/rate/eur/${currency.toLowerCase()}?date=${today}`,{signal:AbortSignal.timeout(2500),cache:'no-store'});
    if(response.ok){const parsed=validRate(await response.json(),currency,now);if(parsed)return {rate:parsed.rate/bamPerEuro,date:parsed.date};}
  }catch{/* A missing quote never changes the BAM entitlement or blocks signup. */}
  return null;
}
