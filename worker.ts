import handler from 'vinext/server/fetch-handler';
import { securityHeaders } from './src/security-headers';

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
    const original=url.pathname.startsWith('/_next/static/')
      ? await (env.ASSETS as {fetch(request:Request):Promise<Response>}).fetch(request)
      : await handler.fetch(request,env,ctx);
    const response=new Response(original.body,original);
    for(const [name,value] of Object.entries(securityHeaders(env.APP_STAGE==='development')))response.headers.set(name,value);
    if(!url.pathname.startsWith('/_next/static/'))response.headers.set('Cache-Control','private, no-store, max-age=0');
    return response;
  }
};
