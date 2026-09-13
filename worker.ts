import handler from 'vinext/server/fetch-handler';
import { securityHeaders } from './src/security-headers';
import { sharedDemoRequest } from './src/features/demo/shared/room-worker';
export { DemoRoom } from './src/features/demo/shared/room-worker';

// Apply transport and response policy after every framework path, including HTML streams.
export default {
  ...handler,
  async fetch(request:Request,env:Record<string,unknown>,ctx:{waitUntil(promise:Promise<unknown>):void}){
    const url=new URL(request.url);
    if(env.APP_STAGE==='production'&&(url.protocol!=='https:'||url.hostname!=='neylo.xyz')){
      url.protocol='https:';url.hostname='neylo.xyz';url.port='';
      return new Response(null,{status:308,headers:{Location:url.href,...securityHeaders()}});
    }
    // With run_worker_first enabled, static requests must explicitly use the asset binding.
    // The framework handler only serves application routes in the deployed Worker.
    const trustedHeaders=new Headers(request.headers);
    const country=(request as Request & {cf?:{country?:unknown}}).cf?.country;
    trustedHeaders.set('x-neylo-country',typeof country==='string'&&/^[A-Z]{2}$/.test(country)?country:'XX');
    const applicationRequest=new Request(request,{headers:trustedHeaders});
    const original=url.pathname.startsWith('/api/demo-room')
      ? await sharedDemoRequest(applicationRequest,env)
      : url.pathname.startsWith('/_next/static/')
      ? await (env.ASSETS as {fetch(request:Request):Promise<Response>}).fetch(request)
      : await handler.fetch(applicationRequest,env,ctx);
    const response=new Response(original.body,original);
    for(const [name,value] of Object.entries(securityHeaders(env.APP_STAGE==='development')))response.headers.set(name,value);
    if(!url.pathname.startsWith('/_next/static/'))response.headers.set('Cache-Control','private, no-store, max-age=0');
    return response;
  }
};
