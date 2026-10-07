import {describe,expect,it} from 'vitest';
import {ApiFailure,createApiClient} from '../src/api-client.ts';
import {validateContract} from '../../../supabase/functions/_shared/external-booking/contracts.ts';
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
  it('obtains grant recovery by owned ref and returns only customer authorization URL',async()=>{
    const paths:string[]=[];const meta={api_version:'v1',source_checked_at:new Date().toISOString()};
    const client=createApiClient({apiResource:'https://api.example.test',customerOrigin:'https://customer.example.test'},'synthetic',async(input,init)=>{
      const path=new URL(String(input)).pathname;paths.push(path);
      if(path.endsWith('/grant-renewals')){expect(init?.body).toBe('{}');return Response.json({...meta,renewal_id:'44444444-4444-4444-8444-444444444444',state:'authorization_required',customer_url:'https://customer.example.test/agent/authorization/44444444-4444-4444-8444-444444444444',expires_at:new Date(Date.now()+300000).toISOString()},{status:201});}
      return Response.json({code:'grant_revoked',message:'Revoked',request_id:'synthetic_request_123',retryable:false},{status:409});
    });
    const result=await client.status({ref:'owned-ref'});expect(paths).toEqual(['/v1/rental-requests/owned-ref','/v1/rental-requests/owned-ref/grant-renewals']);expect(result).toMatchObject({status:'awaiting_customer_authorization'});expect(JSON.stringify(result)).not.toContain('grant_id');
  });
  it('after renewed customer authorization checks rendezvous and retries status once',async()=>{
    const paths:string[]=[];const meta={api_version:'v1',source_checked_at:new Date().toISOString()};let attempts=0;
    const renewal={...meta,renewal_id:'44444444-4444-4444-8444-444444444444',state:'authorized',customer_url:'https://customer.example.test/agent/authorization/44444444-4444-4444-8444-444444444444',expires_at:new Date(Date.now()+300000).toISOString(),grant_id:'55555555-5555-4555-8555-555555555555'};
    const client=createApiClient({apiResource:'https://api.example.test',customerOrigin:'https://customer.example.test'},'synthetic',async(input)=>{
      const path=new URL(String(input)).pathname;paths.push(path);
      if(path.includes('grant-renewals'))return Response.json(renewal);
      if(++attempts===1)return Response.json({code:'grant_expired',message:'Expired',request_id:'synthetic_request_123',retryable:false},{status:409});
      return Response.json({...meta,ref:'owned-ref',status:'requested',next_action:'await_operator',hold_expires_at:new Date(Date.now()+300000).toISOString(),payment_due_at:null,inventory_blocked:true,poll_after_seconds:5,links:{status:'https://api.example.test/v1/rental-requests/owned-ref'}});
    });
    const result=await client.status({ref:'owned-ref'});expect(result.status).toBe('requested');expect(attempts).toBe(2);expect(paths).toContain('/v1/grant-renewals/44444444-4444-4444-8444-444444444444');expect(JSON.stringify(result)).not.toContain('grant_id');
  });
  it('rejects contract-valid wrong customer origins, routes and encoded secret queries',async()=>{
    const safe='https://customer.example.test/agent/handoff/'+'a'.repeat(43);
    for(const url of [safe.replace('customer.example.test','attacker.example.test'),safe+'?%74oken=legacy-secret',safe+'?anything=1',safe+'#secret',safe.replace('/agent/handoff/','/agent/admin/')]){
      const body={api_version:'v1',source_checked_at:new Date().toISOString(),customer_url:url,expires_at:new Date(Date.now()+300000).toISOString(),state:'pending_payment',next_action:'hosted_checkout'};
      // Raw generic contract deliberately does not establish configured-origin authority.
      if(url.includes('attacker.example.test')||url.includes('/agent/admin/'))expect(validateContract('CheckoutHandoffResult',body).ok).toBe(true);
      const client=createApiClient({apiResource:'https://api.example.test',customerOrigin:'https://customer.example.test'},'synthetic',async()=>Response.json(body));
      await expect(client.checkout({ref:'owned-ref'})).rejects.toMatchObject({status:503,body:{code:'upstream_unavailable'}});
    }
  });
  it('rejects status and scoped links outside the exact API resource and owned ref',async()=>{
    for(const status of ['https://attacker.example.test/v1/rental-requests/owned-ref','https://api.example.test/v1/rental-requests/other-ref','https://api.example.test/v1/rental-requests/owned-ref?%74oken=secret']){
      const body={api_version:'v1',source_checked_at:new Date().toISOString(),ref:'owned-ref',status:'requested',next_action:'await_operator',hold_expires_at:null,payment_due_at:null,inventory_blocked:true,poll_after_seconds:5,links:{status}};
      if(!status.includes('?'))expect(validateContract('RentalStatusResult',body).ok).toBe(true);
      const client=createApiClient({apiResource:'https://api.example.test',customerOrigin:'https://customer.example.test'},'synthetic',async()=>Response.json(body));
      await expect(client.status({ref:'owned-ref'})).rejects.toMatchObject({status:503});
    }
  });
  it('accepts exact owned handoff and scoped API links but rejects poisoned optional links',async()=>{
    const meta={api_version:'v1',source_checked_at:new Date().toISOString()};
    const client=createApiClient({apiResource:'https://api.example.test/edge',customerOrigin:'https://customer.example.test'},'synthetic',async()=>Response.json({...meta,customer_url:'https://customer.example.test/agent/handoff/'+'a'.repeat(43),expires_at:new Date(Date.now()+300000).toISOString(),state:'pending_payment',next_action:'hosted_checkout'}));
    expect((await client.checkout({ref:'owned-ref'})).next_action).toBe('hosted_checkout');
    const base={...meta,ref:'owned-ref',status:'pending_payment',next_action:'hosted_checkout',hold_expires_at:null,payment_due_at:new Date(Date.now()+300000).toISOString(),inventory_blocked:true,poll_after_seconds:5};
    for(const poisoned of [false,true]){const links={status:'https://api.example.test/edge/v1/rental-requests/owned-ref',checkout_handoff:poisoned?'https://customer.example.test/agent/handoff/'+'a'.repeat(43)+'?%61ccess_token=secret':'https://api.example.test/edge/v1/rental-requests/owned-ref/checkout-handoff'};
      const status=createApiClient({apiResource:'https://api.example.test/edge',customerOrigin:'https://customer.example.test'},'synthetic',async()=>Response.json({...base,links}));
      if(poisoned)await expect(status.status({ref:'owned-ref'})).rejects.toMatchObject({status:503});else expect((await status.status({ref:'owned-ref'})).links).toEqual(links);
    }
  });
  it('mints identity browser rendezvous only with existing API capability and action link',async()=>{
    const meta={api_version:'v1',source_checked_at:new Date().toISOString()};
    const status={...meta,ref:'owned-ref',status:'pending_documents',next_action:'verify_identity',hold_expires_at:new Date(Date.now()+300000).toISOString(),payment_due_at:null,inventory_blocked:true,poll_after_seconds:5,links:{status:'https://api.example.test/v1/rental-requests/owned-ref',identity:'https://api.example.test/v1/rental-requests/owned-ref/identity-handoff'}};
    for(const scopes of [[],['identity:handoff']]){const paths:string[]=[];const client=createApiClient({apiResource:'https://api.example.test',customerOrigin:'https://customer.example.test',apiScopes:scopes},'synthetic',async(input,init)=>{const path=new URL(String(input)).pathname;paths.push(path);if(path.endsWith('/identity-handoff')){expect(init?.method).toBe('POST');expect(init?.body).toBe('{}');return Response.json({...meta,customer_url:'https://customer.example.test/agent/handoff/'+'a'.repeat(43),expires_at:new Date(Date.now()+300000).toISOString(),state:'pending_documents',next_action:'verify_identity'});}return Response.json(status);});
      const result=await client.status({ref:'owned-ref'});expect(result.status).toBe('pending_documents');
      if(scopes.length){expect(paths).toHaveLength(2);expect(result.links).toMatchObject({identity:'https://customer.example.test/agent/handoff/'+'a'.repeat(43)});}else{expect(paths).toHaveLength(1);expect(result.links).not.toHaveProperty('identity');}
      expect(JSON.stringify(result)).not.toContain('provider_url');
    }
  });
  it('identity grant denial preserves owned status without inventing a browser landing',async()=>{
    const meta={api_version:'v1',source_checked_at:new Date().toISOString()};
    const client=createApiClient({apiResource:'https://api.example.test',customerOrigin:'https://customer.example.test',apiScopes:['identity:handoff']},'synthetic',async(input)=>String(input).endsWith('/identity-handoff')?Response.json({code:'forbidden',message:'Grant did not select identity.',request_id:'synthetic_request_123',retryable:false},{status:403}):Response.json({...meta,ref:'owned-ref',status:'pending_documents',next_action:'verify_identity',hold_expires_at:null,payment_due_at:null,inventory_blocked:true,poll_after_seconds:5,links:{status:'https://api.example.test/v1/rental-requests/owned-ref',identity:'https://api.example.test/v1/rental-requests/owned-ref/identity-handoff'}}));
    const result=await client.status({ref:'owned-ref'});expect(result.next_action).toBe('verify_identity');expect(result.links).not.toHaveProperty('identity');
  });
  it('requires the status action and rejects poisoned identity handoff URLs',async()=>{
    const meta={api_version:'v1',source_checked_at:new Date().toISOString()};
    const status={...meta,ref:'owned-ref',status:'pending_documents',next_action:'verify_identity',hold_expires_at:null,payment_due_at:null,inventory_blocked:true,poll_after_seconds:5,links:{status:'https://api.example.test/edge/v1/rental-requests/owned-ref'}};
    const paths:string[]=[];
    const absent=createApiClient({apiResource:'https://api.example.test/edge',customerOrigin:'https://customer.example.test',apiScopes:['identity:handoff']},'synthetic',async(input)=>{paths.push(String(input));return Response.json(status);});
    expect((await absent.status({ref:'owned-ref'})).links).toEqual(status.links);expect(paths).toHaveLength(1);
    for(const url of ['https://attacker.example.test/agent/handoff/'+'a'.repeat(43),'https://customer.example.test/agent/handoff/'+'a'.repeat(43)+'?%74oken=secret','https://customer.example.test/admin/'+'a'.repeat(43)]){
      const client=createApiClient({apiResource:'https://api.example.test/edge',customerOrigin:'https://customer.example.test',apiScopes:['identity:handoff']},'synthetic',async(input)=>String(input).endsWith('/identity-handoff')?Response.json({...meta,customer_url:url,expires_at:new Date(Date.now()+300000).toISOString(),state:'pending_documents',next_action:'verify_identity'}):Response.json({...status,links:{...status.links,identity:'https://api.example.test/edge/v1/rental-requests/owned-ref/identity-handoff'}}));
      await expect(client.status({ref:'owned-ref'})).rejects.toMatchObject({status:503,body:{code:'upstream_unavailable'}});
    }
  });
  it('preserves the exact customer-owned account link without agent handoff capabilities',async()=>{
    const account='https://customer.example.test/agent/account/11111111-1111-4111-8111-111111111111?ref=owned-ref';
    const body={api_version:'v1',source_checked_at:new Date().toISOString(),ref:'owned-ref',status:'pending_documents',next_action:'verify_identity',hold_expires_at:null,payment_due_at:null,inventory_blocked:true,poll_after_seconds:5,links:{status:'https://api.example.test/v1/rental-requests/owned-ref',customer_account:account}};
    for(const apiScopes of [[],['identity:handoff','checkout:handoff']]){let calls=0;const client=createApiClient({apiResource:'https://api.example.test',customerOrigin:'https://customer.example.test',apiScopes},'synthetic',async()=>{calls++;return Response.json(body);});
      expect((await client.status({ref:'owned-ref'})).links).toMatchObject({customer_account:account});expect(calls).toBe(1);
    }
  });
  it('rejects wrong-origin, wrong-ref and ambiguous customer account queries',async()=>{
    const base='https://customer.example.test/agent/account/11111111-1111-4111-8111-111111111111';
    for(const url of [base.replace('customer.example.test','attacker.example.test')+'?ref=owned-ref',base+'?ref=other-ref',base+'?ref=owned-ref&ref=owned-ref',base+'?ref=owned-ref&%74oken=secret',base+'?%72ef=owned-ref',base+'?ref=owned%2Dref',base+'?ref=owned-ref#secret',base.replace('/agent/account/','/agent/admin/')+'?ref=owned-ref',base.replace('11111111-1111-4111-8111-111111111111','not-uuid')+'?ref=owned-ref']){
      const client=createApiClient({apiResource:'https://api.example.test',customerOrigin:'https://customer.example.test'},'synthetic',async()=>Response.json({api_version:'v1',source_checked_at:new Date().toISOString(),ref:'owned-ref',status:'pending_documents',next_action:'verify_identity',hold_expires_at:null,payment_due_at:null,inventory_blocked:true,poll_after_seconds:5,links:{status:'https://api.example.test/v1/rental-requests/owned-ref',customer_account:url}}));
      await expect(client.status({ref:'owned-ref'})).rejects.toMatchObject({status:503,body:{code:'upstream_unavailable'}});
    }
  });
});
