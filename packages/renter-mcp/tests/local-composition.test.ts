import {describe,it,expect} from 'vitest';
import {createRemoteJWKSet,customFetch,jwtVerify,generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createServer} from 'node:http';
import {SCOPES} from '../../../supabase/functions/_shared/external-booking/contracts.ts';

const issuer='https://composition-id.example.test';
const mcpResource='https://composition-mcp.example.test/mcp';
const apiResource='https://composition-api.example.test/functions/v1/external-booking-api';
const customerOrigin='https://composition-customer.example.test';
const basic='Basic '+Buffer.from('composition-adapter:synthetic-only').toString('base64');
const consumerIds=['legacy-miami','modern-miami','legacy-tampa','modern-tampa','hosted-frontend'];

async function localAuthorizationServer(){
  const keys=await generateKeyPair('ES256'),jwk={...await exportJWK(keys.publicKey),alg:'ES256',kid:'local-composition'};
  const revoked=new Set<string>();
  async function token(clientId:string,subject:string,audience:string,scope:string){
    if(!consumerIds.includes(clientId)||![mcpResource,apiResource].includes(audience)||scope.split(' ').some(s=>!SCOPES.includes(s as typeof SCOPES[number])))throw new Error('invalid_synthetic_token');
    const at=Math.floor(Date.now()/1000);
    return new SignJWT({client_id:clientId,scope}).setProtectedHeader({alg:'ES256',typ:'at+jwt',kid:'local-composition'}).setIssuer(issuer).setSubject(subject).setAudience(audience).setIssuedAt(at).setNotBefore(at).setExpirationTime(at+300).setJti(crypto.randomUUID()).sign(keys.privateKey);
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('content-type','application/json');
    const send=(body:unknown,status=200)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    try{
      let size=0;const chunks:Buffer[]=[];
      for await(const part of req){size+=part.length;if(size>16384){send({error:'invalid_request'},413);return;}chunks.push(Buffer.from(part));}
      const fields=new URLSearchParams(Buffer.concat(chunks).toString());
      if(req.method==='GET'&&req.url==='/jwks'){send({keys:[jwk]});return;}
      if(req.method==='GET'&&req.url==='/.well-known/oauth-authorization-server'){
        send({issuer,jwks_uri:issuer+'/jwks',token_endpoint:issuer+'/token',introspection_endpoint:issuer+'/introspect',code_challenge_methods_supported:['S256'],grant_types_supported:['urn:ietf:params:oauth:grant-type:token-exchange'],token_endpoint_auth_methods_supported:['client_secret_basic']});return;
      }
      if(req.method!=='POST'||req.headers.authorization!==basic){send({error:'invalid_client'},401);return;}
      if(req.url==='/introspect'){
        try{const checked=await jwtVerify(fields.get('token')??'',keys.publicKey,{issuer,audience:[mcpResource,apiResource],typ:'at+jwt',algorithms:['ES256']});send(revoked.has(String(checked.payload.jti))?{active:false}:{active:true,...checked.payload});}catch{send({active:false});}return;
      }
      if(req.url==='/token'){
        const checked=await jwtVerify(fields.get('subject_token')??'',keys.publicKey,{issuer,audience:mcpResource,typ:'at+jwt',algorithms:['ES256'],requiredClaims:['client_id','scope','sub','jti']});
        const p=checked.payload,requested=fields.get('scope')??'';
        if(fields.get('grant_type')!=='urn:ietf:params:oauth:grant-type:token-exchange'||fields.get('resource')!==apiResource||p.aud!==mcpResource||revoked.has(String(p.jti))||typeof p.scope!=='string'||requested.split(' ').some(s=>!String(p.scope).split(' ').includes(s))){send({error:'invalid_request'},400);return;}
        send({access_token:await token(String(p.client_id),String(p.sub),apiResource,requested),token_type:'Bearer',issued_token_type:'urn:ietf:params:oauth:token-type:access_token'});return;
      }
      send({error:'invalid_request'},400);
    }catch{send({error:'invalid_request'},400);}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const local='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const localFetch:typeof fetch=async(input,init)=>{
    const target=new URL(input instanceof Request?input.url:String(input));
    if(target.origin!==issuer||target.search||target.hash||!['/jwks','/token','/introspect','/.well-known/oauth-authorization-server'].includes(target.pathname))throw new Error('invalid_local_egress');
    return fetch(local+target.pathname,init);
  };
  return {token,fetch:localFetch,revoke:(jti:string)=>revoked.add(jti),close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}

// These tests prepare the local AS boundary. SQL/API/SDK composition is added
// only when the root's guarded synthetic lab transport is available.
describe('local composition authorization-server fixture',()=>{
  it('serves actual JWKS and exchanges signed MCP tokens while retaining original consumer',async()=>{
    const fixture=await localAuthorizationServer();
    try{
      const token=await fixture.token('legacy-miami','synthetic-miami-customer',mcpResource,'catalog:read quotes:create');
      const response=await fixture.fetch(issuer+'/token',{method:'POST',headers:{authorization:'Basic '+Buffer.from('composition-adapter:synthetic-only').toString('base64'),'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:token-exchange',subject_token:token,resource:apiResource,scope:'catalog:read quotes:create'})});
      expect(response.status).toBe(200);const result=await response.json() as {access_token:string};
      const resolver=createRemoteJWKSet(new URL(issuer+'/jwks'),{[customFetch]:fixture.fetch});
      const checked=await jwtVerify(result.access_token,resolver,{issuer,audience:apiResource,typ:'at+jwt'});
      expect(checked.payload).toMatchObject({sub:'synthetic-miami-customer',client_id:'legacy-miami',scope:'catalog:read quotes:create'});
      expect(result.access_token).not.toBe(token);
      const introspected=await fixture.fetch(issuer+'/introspect',{method:'POST',headers:{authorization:basic},body:new URLSearchParams({token:result.access_token})});
      expect(await introspected.json()).toMatchObject({active:true,client_id:'legacy-miami',aud:apiResource});
      fixture.revoke(String(checked.payload.jti));
      expect(await (await fixture.fetch(issuer+'/introspect',{method:'POST',headers:{authorization:basic},body:new URLSearchParams({token:result.access_token})})).json()).toEqual({active:false});
    }finally{await fixture.close();}
  });
  it('refuses requested scope escalation and wrong exchange resource',async()=>{
    const fixture=await localAuthorizationServer();
    try{const token=await fixture.token('modern-tampa','synthetic-tampa-customer',mcpResource,'catalog:read');
      for(const [resource,scope] of [[apiResource,'quotes:create'],[customerOrigin,'catalog:read']]){
        const response=await fixture.fetch(issuer+'/token',{method:'POST',headers:{authorization:'Basic '+Buffer.from('composition-adapter:synthetic-only').toString('base64')},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:token-exchange',subject_token:token,resource,scope})});
        expect(response.status).toBe(400);expect(await response.json()).toEqual({error:'invalid_request'});
      }
    }finally{await fixture.close();}
  });
});
