import {describe,expect,it} from 'vitest';
import { readRuntimeConfig } from '../src/runtime.ts';
import { boundedJson } from '../src/http.ts';
import { createNodeServer } from '../src/node-http.ts';
import { request as httpRequest } from 'node:http';

describe('runtime configuration and bounded remote transport',()=> {
  it('has no default enabled server, provider or permissive fallback',()=>{
    expect(()=>readRuntimeConfig({})).toThrow('configuration_unavailable');
    expect(()=>readRuntimeConfig({EXOTIQ_MCP_ENABLED:'true'})).toThrow('configuration_unavailable');
  });
  it('accepts only explicitly pinned HTTPS resources and fixed gateway profile',()=>{
    const env={EXOTIQ_MCP_ENABLED:'true',EXOTIQ_MCP_GATEWAY_PROFILE:'distributed-limit-tls-v1',EXOTIQ_MCP_RESOURCE:'https://mcp.example.test/mcp',EXOTIQ_API_RESOURCE:'https://api.example.test/functions/v1/external-booking-api',EXOTIQ_CUSTOMER_ORIGIN:'https://customer.example.test',EXOTIQ_OAUTH_ISSUER:'https://id.example.test',EXOTIQ_OAUTH_JWKS_URI:'https://id.example.test/jwks',EXOTIQ_OAUTH_INTROSPECTION_URI:'https://id.example.test/introspect',EXOTIQ_OAUTH_TOKEN_URI:'https://id.example.test/token',EXOTIQ_OAUTH_METADATA_URI:'https://id.example.test/.well-known/oauth-authorization-server',EXOTIQ_MCP_RESOURCE_METADATA_URI:'https://mcp.example.test/.well-known/oauth-protected-resource/mcp',EXOTIQ_OAUTH_ALLOWED_HOSTS:'mcp.example.test,api.example.test,id.example.test',EXOTIQ_OAUTH_CONSUMER_CLIENT_IDS:'consumer-a,consumer-b',EXOTIQ_OAUTH_EXCHANGE_CLIENT_ID:'adapter',EXOTIQ_OAUTH_EXCHANGE_CLIENT_SECRET:'synthetic'};
    expect(readRuntimeConfig(env).application.auth.apiResource).toBe(env.EXOTIQ_API_RESOURCE);
    expect(()=>readRuntimeConfig({...env,EXOTIQ_OAUTH_TOKEN_URI:'https://attacker.test/token'})).toThrow();
    expect(()=>readRuntimeConfig({...env,EXOTIQ_MCP_GATEWAY_PROFILE:''})).toThrow();
    expect(()=>readRuntimeConfig({...env,EXOTIQ_MCP_PORT:'70000'})).toThrow();
  });
  it('rejects oversize, nonJSON, redirect and stalled bodies without returning payload',async()=>{
    for(const response of [new Response('secret '.repeat(10000),{headers:{'content-type':'application/json'}}),new Response('secret',{headers:{'content-type':'text/html'}}),new Response('not json',{headers:{'content-type':'application/json'}})])await expect(boundedJson(async()=>response,'https://fixed.test')).rejects.toThrow('remote_unavailable');
    await expect(boundedJson(async()=>{throw new Error('Bearer private secret');},'https://fixed.test')).rejects.toThrow('remote_unavailable');
    const slow:typeof fetch=async(_input,init)=>{return new Promise((_,reject)=>init?.signal?.addEventListener('abort',()=>reject(new Error('secret'))));};
    await expect(boundedJson(slow,'https://fixed.test',{},100,20)).rejects.toThrow('remote_unavailable');
  });
  it('aborts rejected upstream streams and accepts standard JWKS JSON media type',async()=>{
    let signal:AbortSignal|undefined;
    await expect(boundedJson(async(_url,init)=>{signal=init?.signal as AbortSignal;return new Response('{}',{headers:{'content-type':'application/json','content-length':'100000'}});},'https://fixed.test',{},100)).rejects.toThrow('remote_unavailable');
    expect(signal?.aborted).toBe(true);
    expect((await boundedJson(async()=>new Response('{"keys":[]}',{headers:{'content-type':'application/jwk-set+json'}}),'https://fixed.test')).body).toEqual({keys:[]});
  });
  it('actual HTTP client disconnect cancels response instead of waiting forever for drain',async()=>{
    let cancelled!:()=>void;const cancellation=new Promise<void>(r=>{cancelled=r;});
    const server=createNodeServer({fetch:async()=>new Response(new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(32768));},cancel(){cancelled();}}))},'https://mcp.example.test/mcp');
    await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;
    try{
      await new Promise<void>((resolve,reject)=>{const req=httpRequest(`http://127.0.0.1:${port}/mcp`,{headers:{Host:'mcp.example.test'}},res=>res.once('data',()=>{req.destroy();resolve();}));req.on('error',reject);req.end();});
      const result=await Promise.race([cancellation.then(()=>true),new Promise<boolean>(r=>setTimeout(()=>r(false),1000))]);expect(result).toBe(true);
    }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
  });
});
