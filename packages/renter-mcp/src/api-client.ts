import { schemas,validateContract,type ContractName } from '../../../supabase/functions/_shared/external-booking/contracts.ts';
import { boundedJson,record } from './http.ts';

export class ApiFailure extends Error {
  constructor(public readonly body:Record<string,unknown>,public readonly status:number){super('api_request_failed');}
}
const unavailable=()=>new ApiFailure({code:'upstream_unavailable',message:'The service could not verify this operation.',request_id:crypto.randomUUID(),retryable:true},503);
export interface ApiClientConfig {apiResource:string;customerOrigin:string}
export function createApiClient(config:ApiClientConfig,apiToken:string,fetcher:typeof fetch=fetch) {
  const api=new URL(config.apiResource),customer=new URL(config.customerOrigin);
  if(api.protocol!=='https:'||api.username||api.password||api.search||api.hash||api.pathname.includes('%')||/\/\//.test(api.pathname)||customer.protocol!=='https:'||customer.username||customer.password||customer.pathname!=='/'||customer.search||customer.hash)throw new Error('invalid_configuration');
  const prefix=api.pathname.replace(/\/$/,'');
  const customerUrl=(path:string)=>new URL(path,customer).href;
  async function request(method:string,path:string,contract:ContractName,input?:unknown,key?:string):Promise<Record<string,unknown>> {
    const target=new URL(prefix+path,api.origin);if(target.origin!==api.origin||!target.pathname.startsWith(prefix+'/v1/'))throw unavailable();
    let response:Awaited<ReturnType<typeof boundedJson>>;
    try{response=await boundedJson(fetcher,target.href,{method,headers:{Authorization:'Bearer '+apiToken,Accept:'application/json',...(input!==undefined?{'content-type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},...(input!==undefined?{body:JSON.stringify(input)}:{})},262144,4000);}catch{throw unavailable();}
    if(response.status<200||response.status>=300){
      if(validateContract('ApiError',response.body).ok&&record(response.body)) {
        const body={...response.body,message:'The API declined this operation.'};
        const account=response.headers.get('link');
        // Only the fixed owned customer account path can become a user-facing recovery URL.
        if(account){const match=/^<([^>]+)>;\s*rel="?customer-account"?$/.exec(account);if(match){try{const u=new URL(match[1]);if(u.origin===customer.origin&&/^\/agent\/account\/[0-9a-f-]{36}$/.test(u.pathname)&&!u.search&&!u.hash)Object.assign(body,{customer_account_url:u.href});}catch{ /* unsafe links are ignored */ }}}
        throw new ApiFailure(body,response.status);
      }
      throw unavailable();
    }
    if(!validateContract(contract,response.body).ok||!record(response.body))throw unavailable();
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
    async status(input:Record<string,unknown>){const ref=encodeURIComponent(String(input.ref));const read=()=>request('GET',`/v1/rental-requests/${ref}`,'RentalStatusResult');try{return await read();}catch(error){return renewal(error,ref,read);}},
    async checkout(input:Record<string,unknown>){const ref=encodeURIComponent(String(input.ref));const create=()=>request('POST',`/v1/rental-requests/${ref}/checkout-handoff`,'CheckoutHandoffResult',{});try{return await create();}catch(error){return renewal(error,ref,create);}}
  };
  async function renewal(error:unknown,ref:string,retry:()=>Promise<Record<string,unknown>>):Promise<Record<string,unknown>> {
    if(!(error instanceof ApiFailure)||!['grant_expired','grant_revoked'].includes(String(error.body.code)))throw error;
    let result=await request('POST',`/v1/rental-requests/${ref}/grant-renewals`,'GrantRenewalResult',{});
    if(result.state==='authorized'){
      result=await request('GET',`/v1/grant-renewals/${encodeURIComponent(String(result.renewal_id))}`,'GrantRenewalResult');
      if(result.state==='authorized')return retry(); // One retry; no recursive grant creation.
    }
    const u=new URL(String(result.customer_url));if(u.origin!==customer.origin||!u.pathname.startsWith('/agent/')||u.search||u.hash)throw unavailable();
    return {status:'awaiting_customer_authorization',customer_url:result.customer_url,expires_at:result.expires_at};
  }
}
export const waitingConsentSchema={type:'object',properties:{status:{const:'awaiting_customer_consent'},consent_url:{type:'string',format:'uri',pattern:'^https://'},retry_after:{const:5},expires_at:schemas.ConsentResult.properties!.expires_at},required:['status','consent_url','retry_after','expires_at'],additionalProperties:false};
export const waitingAuthorizationSchema={type:'object',properties:{status:{const:'awaiting_customer_authorization'},customer_url:{type:'string',format:'uri',pattern:'^https://'},expires_at:schemas.GrantRenewalResult.properties!.expires_at},required:['status','customer_url','expires_at'],additionalProperties:false};
