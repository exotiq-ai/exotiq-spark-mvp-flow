import {describe,expect,it} from 'vitest';
import {ApiFailure,createApiClient} from '../src/api-client.ts';
describe('API client bounded fixed resources',()=>{
  it('preserves configured API base prefix and keeps receipt rendezvous server-side',async()=>{
    const paths:string[]=[];const headers:Headers[]=[];
    const client=createApiClient({apiResource:'https://api.example.test/functions/v1/external-booking-api',customerOrigin:'https://customer.example.test'},'synthetic-delegated-token',async(input,init)=>{
      paths.push(String(input));headers.push(new Headers(init?.headers));
      return Response.json({api_version:'v1',source_checked_at:new Date().toISOString(),quote_id:'33333333-3333-4333-8333-333333333333',state:'waiting',expires_at:new Date(Date.now()+300000).toISOString()},{status:202});
    });
    const result=await client.submit({quote_id:'33333333-3333-4333-8333-333333333333',idempotency_key:'stable_customer_key_0001'});
    expect(paths).toEqual(['https://api.example.test/functions/v1/external-booking-api/v1/quotes/33333333-3333-4333-8333-333333333333/consent-result']);
    expect(headers[0].get('Authorization')).toBe('Bearer synthetic-delegated-token');expect(result.status).toBe('awaiting_customer_consent');expect(Object.hasOwn(result,'consent_receipt_id')).toBe(false);
  });
  it('refuses malformed output and strips unsafe account link',async()=>{
    const client=createApiClient({apiResource:'https://api.example.test',customerOrigin:'https://customer.example.test'},'synthetic',async()=>Response.json({code:'forbidden',message:'secret instructions',request_id:'synthetic_request_123',retryable:false},{status:403,headers:{Link:'<https://attacker.test/steal>; rel=customer-account'}}));
    try{await client.quote({});expect.fail('must reject');}catch(error){expect(error).toBeInstanceOf(ApiFailure);expect((error as ApiFailure).body).toEqual({code:'forbidden',message:'The API declined this operation.',request_id:'synthetic_request_123',retryable:false});}
    const malformed=createApiClient({apiResource:'https://api.example.test',customerOrigin:'https://customer.example.test'},'synthetic',async()=>Response.json({items:[],private_secret:'hidden'}));
    await expect(malformed.search({})).rejects.toMatchObject({status:503,body:{code:'upstream_unavailable'}});
  });
});
