import { mkdir } from 'node:fs/promises';
import { PaymentSandbox } from './engine';
import { startSandbox } from './server';

// Fixed local storage. No environment-supplied database URL or payment credentials.
await mkdir('work/payment-sandbox',{recursive:true});
const engine=new PaymentSandbox('work/payment-sandbox/database');await engine.init();
const app=await startSandbox(engine,3210);
console.log(`SIMULATED MONEY ONLY: ${app.origin}`);
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,async()=>{await app.close();await engine.db.close();process.exit(0);});
