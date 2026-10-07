import {describe,expect,it} from 'vitest';
import {request as httpRequest} from 'node:http';
import {createMcpApplication} from '../src/server.ts';
import {createNodeServer} from '../src/node-http.ts';
const resource='https://mcp.example.test/mcp',issuer='https://id.example.test';
function application(){let calls=0;const app=createMcpApplication({customerOrigin:'https://customer.example.test',auth:{issuer,resource,apiResource:'https://api.example.test',jwksUri:issuer+'/jwks',introspectionUri:issuer+'/introspect',tokenUri:issuer+'/token',metadataUri:issuer+'/.well-known/oauth-authorization-server',resourceMetadataUri:'https://mcp.example.test/.well-known/oauth-protected-resource/mcp',allowedHosts:['id.example.test','mcp.example.test','api.example.test'],clientIds:['consumer'],exchangeClientId:'adapter',exchangeClientSecret:'synthetic',maxTokenLifetimeSeconds:600}},async()=>{calls++;throw new Error('Unexpected credential egress');});return {app,calls:()=>calls};}
function request(body:ReadableStream<Uint8Array>,signal?:AbortSignal){return new Request(resource,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer synthetic'},body,signal,duplex:'half'} as RequestInit);}
describe('bounded unauthenticated ingress',()=>{
  it('uses a total five-second deadline even while bytes arrive and cancellation never settles',async()=>{
    await Promise.all([false,true].map(async(slow)=>{const {app,calls}=application();let cancelled=false;let timer:ReturnType<typeof setInterval>|undefined;
      const body=new ReadableStream<Uint8Array>({start(c){if(slow)timer=setInterval(()=>c.enqueue(new TextEncoder().encode(' ')),100);},cancel(){cancelled=true;if(timer)clearInterval(timer);return new Promise<void>(()=>{});}});
      const started=Date.now();const pending=app.fetch(request(body));
      try{const result=await Promise.race([pending,new Promise<null>(r=>setTimeout(()=>r(null),5700))]);expect(result?.status).toBe(408);expect(Date.now()-started).toBeGreaterThanOrEqual(4900);expect(Date.now()-started).toBeLessThan(5700);expect(cancelled).toBe(true);expect(calls()).toBe(0);}
      finally{if(timer)clearInterval(timer);}
    }));
  },6500);
  it('inbound abort cancels a pending read without awaiting hostile cancellation or dispatch',async()=>{
    const {app,calls}=application();const controller=new AbortController();let cancelled=false;
    const body=new ReadableStream<Uint8Array>({cancel(){cancelled=true;return new Promise<void>(()=>{});}});
    const pending=app.fetch(request(body,controller.signal));await new Promise(r=>setTimeout(r,40));controller.abort();
    const result=await Promise.race([pending,new Promise<null>(r=>setTimeout(()=>r(null),300))]);expect(result?.status).toBe(400);expect(cancelled).toBe(true);expect(calls()).toBe(0);
  });
  it('actual loopback HTTP applies the same deadline before authentication',async()=>{
    const {app,calls}=application();const server=createNodeServer(app,resource);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;let req:ReturnType<typeof httpRequest>|undefined;
    try{const result=await Promise.race([new Promise<number>((resolve,reject)=>{req=httpRequest(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:{Host:'mcp.example.test','content-type':'application/json',authorization:'Bearer synthetic'}},res=>{res.resume();resolve(res.statusCode!);});req.on('error',reject);req.flushHeaders();req.write('{');}),new Promise<null>(r=>setTimeout(()=>r(null),5700))]);expect(result).toBe(408);expect(calls()).toBe(0);}
    finally{req?.destroy();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
  },6500);
  it('actual HTTP disconnect releases the in-progress body read before authentication',async()=>{
    const {app,calls}=application();let entered!:()=>void,finished!:()=>void;const entry=new Promise<void>(r=>{entered=r;}),completion=new Promise<void>(r=>{finished=r;});
    const server=createNodeServer({fetch:async(request)=>{entered();try{return await app.fetch(request);}finally{finished();}}},resource);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
    const req=httpRequest(`http://127.0.0.1:${(server.address() as {port:number}).port}/mcp`,{method:'POST',headers:{Host:'mcp.example.test','content-type':'application/json'}});req.on('error',()=>{});
    try{req.flushHeaders();req.write('{');await entry;await new Promise(r=>setTimeout(r,40));req.destroy();expect(await Promise.race([completion.then(()=>true),new Promise<boolean>(r=>setTimeout(()=>r(false),500))])).toBe(true);expect(calls()).toBe(0);}
    finally{req.destroy();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
  });
});
