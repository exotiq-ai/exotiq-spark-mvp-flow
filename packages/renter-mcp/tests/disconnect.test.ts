import { describe, expect, it } from 'vitest';
import { createServer, request as httpRequest } from 'node:http';
import { decodeJwt, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createMcpApplication } from '../src/server.ts';
import { createNodeServer } from '../src/node-http.ts';
import { createApiClient } from '../src/api-client.ts';

const issuer='https://id.example.test',resource='https://mcp.example.test/mcp',api='https://api.example.test';
const quote='33333333-3333-4333-8333-333333333333';
const scopes='catalog:read quotes:create rental_requests:create rental_requests:read checkout:handoff';
const delay=(ms:number)=>new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),ms));
describe('inbound cancellation reaches actual credential/API egress',()=>{
  for(const stage of ['metadata','consent'])it('disconnect during '+stage+' aborts actual stalled HTTP egress and prevents subsequent writes',async()=>{
    const key=await generateKeyPair('ES256');
    const jwk={...await exportJWK(key.publicKey),alg:'ES256',kid:'local'};
    const jwt=async(audience:string)=>{const now=Math.floor(Date.now()/1000);return new SignJWT({client_id:'consumer',scope:scopes}).setProtectedHeader({alg:'ES256',typ:'at+jwt',kid:'local'}).setIssuer(issuer).setSubject('customer').setAudience(audience).setIssuedAt(now).setNotBefore(now).setExpirationTime(now+300).setJti(crypto.randomUUID()).sign(key.privateKey);};
    let stalled!:()=>void,disconnected!:()=>void;
    const stall=new Promise<void>(resolve=>{stalled=resolve;});
    const disconnect=new Promise<void>(resolve=>{disconnected=resolve;});
    const calls:string[]=[];
    const upstream=createServer(async(req,res)=>{
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
      calls.push(req.url!);res.setHeader('content-type','application/json');
      const path=stage==='metadata'?'/identity/metadata':`/api/v1/quotes/${quote}/consent-result`;
      if(req.url===path){res.flushHeaders();res.once('close',disconnected);stalled();return;}
      if(req.url==='/identity/jwks')res.end(JSON.stringify({keys:[jwk]}));
      else if(req.url==='/identity/metadata')res.end(JSON.stringify({issuer,jwks_uri:issuer+'/jwks',token_endpoint:issuer+'/token',introspection_endpoint:issuer+'/introspect',code_challenge_methods_supported:['S256'],grant_types_supported:['urn:ietf:params:oauth:grant-type:token-exchange'],token_endpoint_auth_methods_supported:['client_secret_basic']}));
      else if(req.url==='/identity/introspect')res.end(JSON.stringify({...decodeJwt(new URLSearchParams(Buffer.concat(chunks).toString()).get('token')!),active:true}));
      else if(req.url==='/identity/token')res.end(JSON.stringify({access_token:await jwt(api),token_type:'Bearer',issued_token_type:'urn:ietf:params:oauth:token-type:access_token'}));
      else {res.statusCode=500;res.end('{}');}
    });
    await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
    const upstreamOrigin='http://127.0.0.1:'+(upstream.address() as {port:number}).port;
    const remote:typeof fetch=async(input,init)=>{const url=new URL(String(input));return fetch(upstreamOrigin+'/'+(url.origin===issuer?'identity':'api')+url.pathname,init);};
    const app=createMcpApplication({customerOrigin:'https://customer.example.test',auth:{issuer,resource,apiResource:api,jwksUri:issuer+'/jwks',introspectionUri:issuer+'/introspect',tokenUri:issuer+'/token',metadataUri:issuer+'/metadata',resourceMetadataUri:'https://mcp.example.test/.well-known/oauth-protected-resource/mcp',allowedHosts:['id.example.test','mcp.example.test','api.example.test'],clientIds:['consumer'],exchangeClientId:'adapter',exchangeClientSecret:'synthetic',maxTokenLifetimeSeconds:600}},remote);
    const mcp=createNodeServer(app,resource);await new Promise<void>(resolve=>mcp.listen(0,'127.0.0.1',resolve));
    const port=(mcp.address() as {port:number}).port;
    const bearer=await jwt(resource);
    const req=httpRequest(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:{Host:'mcp.example.test',Authorization:'Bearer '+bearer,'content-type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'}});
    req.on('error',()=>{});req.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'submit_rental_request',arguments:{quote_id:quote,idempotency_key:'stable_customer_key_0001'}}}));
    try{
      expect(await Promise.race([stall.then(()=>true),delay(1000)])).toBe(true);
      req.destroy();expect(await Promise.race([disconnect.then(()=>true),delay(500)])).toBe(true);
      expect(calls).not.toContain('/api/v1/rental-requests');
      if(stage==='metadata'){expect(calls).not.toContain('/identity/introspect');expect(calls).not.toContain('/identity/token');}
    }finally{req.destroy();mcp.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise<void>(r=>mcp.close(()=>r())),new Promise<void>(r=>upstream.close(()=>r()))]);}
  });
  it('cancellation after consent read prevents starting a new request POST',async()=>{
    const controller=new AbortController();let writes=0;
    const client=createApiClient({apiResource:api,customerOrigin:'https://customer.example.test'},'synthetic',async(input)=>{
      if(String(input).endsWith('/consent-result')){controller.abort();return Response.json({api_version:'v1',source_checked_at:new Date().toISOString(),quote_id:quote,state:'authorized',consent_receipt_id:'44444444-4444-4444-8444-444444444444',expires_at:new Date(Date.now()+300000).toISOString()});}
      writes++;return Response.json({});
    },controller.signal);
    await expect(client.submit({quote_id:quote,idempotency_key:'stable_customer_key_0001'})).rejects.toMatchObject({status:503});
    expect(writes).toBe(0);
  });
});
