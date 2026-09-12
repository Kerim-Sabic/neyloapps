'use client';
import { createContext,useContext,useState } from 'react';
import { currencyCodes,currencyChoice,currencyDisplaySchema,defaultDisplay,formatDisplayCredit,type CurrencyDisplay } from './domain';
import { request } from '@/lib/client';
import currencyNames from './names.json';

// Stable labels prevent browser/server ICU versions from breaking hydration.
const names=new Map(Object.entries(currencyNames));

type DisplayContext={display:CurrencyDisplay;busy:boolean;error:string;choose:(value:string)=>Promise<void>};
const CurrencyContext=createContext<DisplayContext>({display:defaultDisplay,busy:false,error:'',choose:async()=>{}});
export function CurrencyProvider({initial,children}:{initial:CurrencyDisplay;children:React.ReactNode}){
  const [display,setDisplay]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function choose(value:string){
    setBusy(true);setError('');const choice=currencyChoice(value);
    try{
      const next=await request(`display-currency?currency=${choice}`,currencyDisplaySchema);
      setDisplay(next);
      // Display preference only. It never stores account, authentication, or ledger data.
      document.cookie=`neylo_currency=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
    }catch{setError('Could not change display currency. Please retry.');}finally{setBusy(false);}
  }
  return <CurrencyContext value={{display,busy,error,choose}}>{children}</CurrencyContext>;
}
export function useCreditDisplay(){const {display}=useContext(CurrencyContext);return {display,credit:(minor:number)=>formatDisplayCredit(minor,display)};}
export function CurrencyControls({account=false}:{account?:boolean}){
  const {display,busy,error,choose}=useContext(CurrencyContext);
  return <div className="currency-controls">
    <label>Display currency<select aria-label="Display currency" value={display.requested} disabled={busy} onChange={event=>void choose(event.target.value)}><option value="auto">Automatic · {display.detected==='BAM'?'KM':display.detected}</option>{currencyCodes.map(code=><option key={code} value={code}>{code==='BAM'?'KM (BAM)':code} · {names.get(code)??code}</option>)}</select></label>
    <p className="currency-status" role="status">{busy?'Updating display…':error|| (display.unavailable?'A current rate is unavailable. Showing your credit in KM.':'')}</p>
    {display.currency!=='BAM'&&<details className="currency-explanation"><summary>About this {display.currency} equivalent</summary><p>{account?'Your credit remains reserved in KM (BAM).':'The offer remains 100 KM welcome credit, 50 KM per qualifying friend, up to 250 KM.'} Display equivalents are rounded estimates, not an exchange or a new entitlement. {display.date?<>Reference rate dated {display.date} from <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter</a>. Rates can change before launch.</>:<>Calculated at the official <a href="https://www.cbbh.ba/" target="_blank" rel="noreferrer">1 EUR = 1.95583 KM rate</a>.</>} The display preference is saved in an essential preference cookie.</p></details>}
  </div>;
}
