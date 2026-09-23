import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { PaymentSandbox, SandboxError, sign } from './engine';

export async function startSandbox(engine: PaymentSandbox, port = 0) {
  if(process.env.APP_STAGE==='production' || process.env.NODE_ENV==='production') throw new Error('Sandbox cannot start in production');
  const secret=randomBytes(32).toString('hex'), session=randomBytes(32).toString('hex');
  let origin='';
  const read=async(req:IncomingMessage)=>{const parts:Buffer[]=[];let size=0;for await(const part of req){const b=Buffer.from(part);size+=b.length;if(size>4096)throw new SandboxError('BODY_TOO_LARGE',413);parts.push(b);}return Buffer.concat(parts).toString('utf8');};
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    const json=(data:unknown,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    try {
      if(req.headers.host!==new URL(origin).host) throw new SandboxError('INVALID_HOST',403);
      const path=req.url??'/';
      if(req.method==='GET' && ['/','/app.js','/app.css'].includes(path)) {
        if(path==='/')res.setHeader('Set-Cookie',`neylo_local_sandbox=${session}; HttpOnly; SameSite=Strict; Path=/`);
        res.setHeader('Content-Type',path==='/'?'text/html; charset=utf-8':path.endsWith('.js')?'text/javascript':'text/css');
        res.end(await readFile(new URL(path==='/'?'./index.html':`.${path}`,import.meta.url)));return;
      }
      if(path==='/webhook' && req.method==='POST') {
        const raw=await read(req);json(await engine.webhook(raw,String(req.headers['x-timestamp']??''),String(req.headers['x-signature']??''),secret));return;
      }
      if(!req.headers.cookie?.split(';').some(c=>c.trim()===`neylo_local_sandbox=${session}`))throw new SandboxError('UNAUTHENTICATED',401);
      if(req.method==='POST' && (req.headers.origin!==origin || !req.headers['content-type']?.startsWith('application/json')))throw new SandboxError('INVALID_ORIGIN_OR_CONTENT_TYPE',403);
      if(path==='/transfers' && req.method==='POST') {json(await engine.create('alice',String(req.headers['idempotency-key']??''),JSON.parse(await read(req))),201);return;}
      if(path==='/reconciliation' && req.method==='GET') {json(await engine.reconcile());return;}
      if(path.startsWith('/transfers/') && req.method==='GET') {json(await engine.get(path.slice('/transfers/'.length)));return;}
      if(path==='/simulate' && req.method==='POST') {
        const p=z.object({id:z.string().uuid(),action:z.enum(['fund','pay','fail','lose-response','recover','refund'])}).strict().parse(JSON.parse(await read(req)));
        if(p.action==='fund') {const e=await engine.simulateProvider(p.id,'funding'),raw=JSON.stringify(e),ts=String(Date.now());await engine.webhook(raw,ts,sign(raw,ts,secret),secret);}
        else await engine.dispatch(p.id,secret,{fail:p.action==='fail',loseResponse:p.action==='lose-response'});
        json(await engine.get(p.id));return;
      }
      throw new SandboxError('NOT_FOUND',404);
    } catch(e) {json({error:e instanceof SandboxError?e.code:e instanceof z.ZodError||e instanceof SyntaxError?'INVALID_INPUT':'INTERNAL'},e instanceof SandboxError?e.status:e instanceof z.ZodError||e instanceof SyntaxError?400:500);}
  });
  server.requestTimeout=10_000;server.headersTimeout=5_000;
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const address=server.address();if(!address||typeof address==='string')throw new Error('Missing address');
  origin=`http://127.0.0.1:${address.port}`;
  return {origin,secret,server,close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
