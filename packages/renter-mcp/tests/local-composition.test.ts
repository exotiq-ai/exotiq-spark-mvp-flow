import {describe,it,expect} from 'vitest';
import {createRemoteJWKSet,customFetch,jwtVerify} from 'jose';

const issuer='https://composition-id.example.test';
const mcpResource='https://composition-mcp.example.test/mcp';
const apiResource='https://composition-api.example.test/functions/v1/external-booking-api';
const customerOrigin='https://composition-customer.example.test';

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
      const introspected=await fixture.fetch(issuer+'/introspect',{method:'POST',body:new URLSearchParams({token:result.access_token})});
      expect(await introspected.json()).toMatchObject({active:true,client_id:'legacy-miami',aud:apiResource});
      fixture.revoke(String(checked.payload.jti));
      expect(await (await fixture.fetch(issuer+'/introspect',{method:'POST',body:new URLSearchParams({token:result.access_token})})).json()).toEqual({active:false});
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
