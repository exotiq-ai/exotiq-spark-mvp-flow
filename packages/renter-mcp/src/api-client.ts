import { schemas,validateContract,type ContractName } from '../../../supabase/functions/_shared/external-booking/contracts.ts';
import { boundedJson,record } from './http.ts';

export class ApiFailure extends Error {
  constructor(public readonly body:Record<string,unknown>,public readonly status:number){super('api_request_failed');}
}
const unavailable=()=>new ApiFailure({code:'upstream_unavailable',message:'The service could not verify this operation.',request_id:crypto.randomUUID(),retryable:true},503);
export interface ApiClientConfig {apiResource:string;customerOrigin:string;apiScopes?:readonly string[]}
export function createApiClient(config:ApiClientConfig,apiToken:string,fetcher:typeof fetch=fetch,signal?:AbortSignal) {
  const api=new URL(config.apiResource),customer=new URL(config.customerOrigin);
  if(api.protocol!=='https:'||api.username||api.password||api.search||api.hash||api.pathname.includes('%')||/\/\//.test(api.pathname)||customer.protocol!=='https:'||customer.username||customer.password||customer.pathname!=='/'||customer.search||customer.hash)throw new Error('invalid_configuration');
  const prefix=api.pathname.replace(/\/$/,'');
  const customerUrl=(path:string)=>new URL(path,customer).href;
  const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  const handoff=/^\/agent\/handoff\/[A-Za-z0-9_-]{43}$/;
  const consent=new RegExp('^/agent/consent/'+uuid+'$','i');
  const authorization=new RegExp('^/agent/authorization/'+uuid+'$','i');
  const account=new RegExp('^/agent/account/'+uuid+'$','i');
  function ownedUrl(value:unknown,origin:string,path:string|RegExp):boolean {
    try{if(typeof value!=='string')return false;const u=new URL(value);
      // Reject every query/fragment, including percent-encoded credential keys.
      return u.protocol==='https:'&&u.origin===origin&&!u.username&&!u.password&&!u.search&&!u.hash&&!u.pathname.includes('%')&&u.href===value&&(typeof path==='string'?u.pathname===path:path.test(u.pathname));
    }catch{return false;}
  }
  function customerAccount(value:unknown,ref:string):boolean {
    try{
      if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(ref))return false;
      const u=new URL(value);
      // One canonical, non-credential query is permitted for customer continuity.
      // The API supplies its owned operator UUID; the result's ref binds the link.
      return u.search==='?ref='+ref&&u.href===value&&ownedUrl(value.slice(0,value.indexOf('?')),customer.origin,account);
    }catch{return false;}
  }
  function validateOwnedLinks(contract:ContractName,body:Record<string,unknown>,path:string) {
    if(contract==='QuoteResult'&&!ownedUrl(body.consent_url,customer.origin,'/agent/consent/'+body.quote_id))throw unavailable();
    if((contract==='CheckoutHandoffResult'||contract==='IdentityHandoffResult')&&!ownedUrl(body.customer_url,customer.origin,handoff))throw unavailable();
    if(contract==='GrantRenewalResult'&&!ownedUrl(body.customer_url,customer.origin,'/agent/authorization/'+body.renewal_id))throw unavailable();
    if(contract==='RentalRequestResult'||contract==='RentalStatusResult'){
      if(!record(body.links)||typeof body.ref!=='string')throw unavailable();
      const ref=body.ref,base=prefix+'/v1/rental-requests/'+ref;
      if(contract==='RentalStatusResult'&&path!=='/v1/rental-requests/'+ref)throw unavailable();
      for(const [key,value] of Object.entries(body.links)){
        const safe=key==='status'?ownedUrl(value,api.origin,base)
          :key==='checkout_handoff'?ownedUrl(value,api.origin,base+'/checkout-handoff')
          :key==='identity'?ownedUrl(value,api.origin,base+'/identity-handoff')||ownedUrl(value,customer.origin,handoff)
          :key==='consent'?ownedUrl(value,customer.origin,consent)
          :key==='customer_account'?customerAccount(value,ref)
          :key==='recovery'?ownedUrl(value,api.origin,base+'/grant-renewals')||ownedUrl(value,customer.origin,authorization):false;
        if(!safe)throw unavailable();
      }
    }
  }
  async function request(method:string,path:string,contract:ContractName,input?:unknown,key?:string):Promise<Record<string,unknown>> {
    const target=new URL(prefix+path,api.origin);if(target.origin!==api.origin||!target.pathname.startsWith(prefix+'/v1/'))throw unavailable();
    let response:Awaited<ReturnType<typeof boundedJson>>;
    try{response=await boundedJson(fetcher,target.href,{method,signal,headers:{Authorization:'Bearer '+apiToken,Accept:'application/json',...(input!==undefined?{'content-type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},...(input!==undefined?{body:JSON.stringify(input)}:{})},262144,4000);}catch{throw unavailable();}
    if(response.status<200||response.status>=300){
      if(validateContract('ApiError',response.body).ok&&record(response.body)) {
        const body={...response.body,message:'The API declined this operation.'};
        const accountLink=response.headers.get('link');
        // Only the fixed owned customer account path can become a user-facing recovery URL.
        if(accountLink){const match=/^<([^>]+)>;\s*rel="?customer-account"?$/.exec(accountLink);if(match&&ownedUrl(match[1],customer.origin,account))Object.assign(body,{customer_account_url:match[1]});}
        throw new ApiFailure(body,response.status);
      }
      throw unavailable();
    }
    if(!validateContract(contract,response.body).ok||!record(response.body))throw unavailable();
    validateOwnedLinks(contract,response.body,path);
    return response.body;
  }
  return {
    async search(input:Record<string,unknown>){const query=new URLSearchParams();for(const [key,value]of Object.entries(input))query.set(key,String(value));return request('GET','/v1/vehicles'+(query.size?'?'+query:''),'VehiclesPage');},
    availability:(input:Record<string,unknown>)=>request('POST','/v1/availability','AvailabilityResult',input),
    quote:(input:Record<string,unknown>)=>request('POST','/v1/quotes','QuoteResult',input),
    async submit(input:Record<string,unknown>){
      const quoteId=String(input.quote_id);const consent=await request('GET',`/v1/quotes/${encodeURIComponent(quoteId)}/consent-result`,'ConsentResult');
      if(consent.quote_id!==quoteId)throw unavailable();
      if(consent.state==='waiting')return {status:'awaiting_customer_consent',consent_url:customerUrl('/agent/consent/'+quoteId),retry_after:5,expires_at:consent.expires_at};
      // Receipt is obtained through the authenticated rendezvous and never appears in tool I/O.
      return request('POST','/v1/rental-requests','RentalRequestResult',{quote_id:quoteId,consent_receipt_id:consent.consent_receipt_id},String(input.idempotency_key));
    },
    async status(input:Record<string,unknown>){const ref=encodeURIComponent(String(input.ref));const read=async()=>identityReview(await request('GET',`/v1/rental-requests/${ref}`,'RentalStatusResult'),ref);try{return await read();}catch(error){return renewal(error,ref,read);}},
    async checkout(input:Record<string,unknown>){const ref=encodeURIComponent(String(input.ref));const create=()=>request('POST',`/v1/rental-requests/${ref}/checkout-handoff`,'CheckoutHandoffResult',{});try{return await create();}catch(error){return renewal(error,ref,create);}}
  };
  async function identityReview(status:Record<string,unknown>,ref:string):Promise<Record<string,unknown>> {
    if(!record(status.links)||!ownedUrl(status.links.identity,api.origin,prefix+'/v1/rental-requests/'+ref+'/identity-handoff'))return status;
    // An API POST action is never presented as a browser landing. Existing grants
    // and the independently verified exchanged token must both permit the action.
    const links={...status.links};delete links.identity;
    const safeStatus={...status,links};
    if(status.next_action!=='verify_identity'||!config.apiScopes?.includes('identity:handoff'))return safeStatus;
    try{
      const result=await request('POST',`/v1/rental-requests/${ref}/identity-handoff`,'IdentityHandoffResult',{});
      return {...safeStatus,links:{...links,identity:result.customer_url}};
    }catch(error){
      if(error instanceof ApiFailure&&error.status===403&&error.body.code==='forbidden')return safeStatus;
      throw error;
    }
  }
  async function renewal(error:unknown,ref:string,retry:()=>Promise<Record<string,unknown>>):Promise<Record<string,unknown>> {
    if(!(error instanceof ApiFailure)||!['grant_expired','grant_revoked'].includes(String(error.body.code)))throw error;
    let result=await request('POST',`/v1/rental-requests/${ref}/grant-renewals`,'GrantRenewalResult',{});
    if(result.state==='authorized'){
      const renewalId=result.renewal_id;
      result=await request('GET',`/v1/grant-renewals/${encodeURIComponent(String(result.renewal_id))}`,'GrantRenewalResult');
      if(result.renewal_id!==renewalId)throw unavailable();
      if(result.state==='authorized')return retry(); // One retry; no recursive grant creation.
    }
    return {status:'awaiting_customer_authorization',customer_url:result.customer_url,expires_at:result.expires_at};
  }
}
export const waitingConsentSchema={type:'object',properties:{status:{const:'awaiting_customer_consent'},consent_url:{type:'string',format:'uri',pattern:'^https://'},retry_after:{const:5},expires_at:schemas.ConsentResult.properties!.expires_at},required:['status','consent_url','retry_after','expires_at'],additionalProperties:false};
export const waitingAuthorizationSchema={type:'object',properties:{status:{const:'awaiting_customer_authorization'},customer_url:{type:'string',format:'uri',pattern:'^https://'},expires_at:schemas.GrantRenewalResult.properties!.expires_at},required:['status','customer_url','expires_at'],additionalProperties:false};
