import {validateContract,type ContractName} from './contracts.ts';
import {BookingApiError} from './errors.ts';
import type {Principal,Scope} from './auth.ts';
import {verifyHostedProof,type HostedProofConfiguration,type HostedCustomerProof} from './hosted-proof.ts';
import {jsonResponse} from './catalog-routes.ts';
import {quoteResultFromSnapshot} from './quote-routes.ts';
import {normalizeAuthority,type QuoteRpcClient,type QuoteSnapshot} from './quotes.ts';
import {grantRecoveryResponse} from './grant-recovery-routes.ts';
export interface ConsentDependencies {
 auth:{requirePrincipal(request:Request,scope:Scope,operatorId?:string):Promise<Principal>};
 rpc:QuoteRpcClient;hosted:HostedProofConfiguration|null;consentOrigin:string;now?:()=>number;
}
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validated(name:ContractName,body:unknown,output=false) {if(!validateContract(name,body).ok)throw new BookingApiError(output?'upstream_unavailable':'invalid_input');return body as Record<string,unknown>;}
export async function consentRpc(deps:ConsentDependencies,name:string,args:Record<string,unknown>):Promise<unknown>{
 const {data,error}=await deps.rpc.rpc(name,args);
 if(error){const message=error&&typeof error==='object'?(error as {message?:unknown}).message:undefined;
  const code=error&&typeof error==='object'?(error as {code?:unknown}).code:undefined;
  if(['55P03','57014','40001'].includes(String(code)))throw new BookingApiError('upstream_unavailable',{retry_after_seconds:1});
  if(['configuration_unavailable','external_writes_disabled','invalid_input','not_found','dates_unavailable','quote_expired','quote_changed','consent_mismatch','consent_expired','forbidden'].includes(String(message)))throw new BookingApiError(message as 'not_found');
  if(message==='renewal_expired')throw new BookingApiError('consent_expired');
  if(message==='grant_revoked')throw new BookingApiError('forbidden');
  throw new BookingApiError('upstream_unavailable');
 }
 return data;
}
export async function customerProof(request:Request,principal:Principal,deps:ConsentDependencies):Promise<HostedCustomerProof>{
 if(request.headers.has('origin')&&request.headers.get('origin')!==deps.hosted?.frontendOrigin)throw new BookingApiError('unauthorized');
 return verifyHostedProof(request,principal,deps.hosted,new Date(deps.now?.()??Date.now()));
}
export function actorArgs(principal:Principal){return {_issuer:principal.issuer,_subject:principal.subject,_client_id:principal.clientId,_audience:principal.audience};}
/** Every route first authenticates the configured managed-provider bearer.
 * Customer writes additionally require the independent short-lived BFF proof.
 * Caller JSON never supplies issuer/subject/customer/profile/email bindings. */
export function createConsentExtension(deps:ConsentDependencies){
 return async(request:Request,path:string,body:unknown):Promise<Response|null>=>{
  if(path==='/v1/customers/operator-links'&&request.method==='POST'){
   const input=validated('CustomerOperatorLinkInput',body),principal=await deps.auth.requirePrincipal(request,'quotes:create'),proof=await customerProof(request,principal,deps);
   if(!proof.profile.emailVerified||!proof.profile.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proof.profile.email))throw new BookingApiError('unauthorized');
   const result=await consentRpc(deps,'external_hosted_link_customer',{...actorArgs(principal),_operator_id:input.operator_id,_email:proof.profile.email,_email_verified:true,_full_name:input.full_name,_phone:input.phone,_consented:true});
   return jsonResponse(validated('CustomerOperatorLinkResult',result,true),201);
  }
  const match=/^\/v1\/quotes\/([^/]+)(?:\/(consents|consent-result))?$/.exec(path);
  if(match){
   if(!uuid.test(match[1]))throw new BookingApiError('invalid_input');
   const action=match[2],hosted=deps.hosted?.hostedClientIds;
   if((!action&&request.method!=='GET')||(action==='consents'&&request.method!=='POST')||(action==='consent-result'&&request.method!=='GET'))throw new BookingApiError('invalid_input');
   const principal=await deps.auth.requirePrincipal(request,action==='consent-result'?'rental_requests:create':'quotes:create'),isCustomer=!!hosted?.includes(principal.clientId);
   if(action==='consents'){
    const input=validated('ConsentInput',body),proof=await customerProof(request,principal,deps);
    const result=await consentRpc(deps,'external_hosted_authorize_quote_scopes',{...actorArgs(principal),_quote_id:match[1],_terms_hash:input.terms_hash,_action:input.action,_csrf_hash:proof.csrfHash,_action_scopes:input.action_scopes});
    return jsonResponse(validated('CustomerConsentResult',result,true),201);
   }
   if(action==='consent-result'){
    if(isCustomer)throw new BookingApiError('forbidden');
    const result=validated('ConsentResult',await consentRpc(deps,'external_quote_consent_result',{...actorArgs(principal),_quote_id:match[1]}),true);
    const response=jsonResponse(result,result.state==='waiting'?202:200);if(result.state==='waiting')response.headers.set('Retry-After','5');return response;
   }
   if(isCustomer)await customerProof(request,principal,deps);
   const raw=await consentRpc(deps,'external_review_quote',{...actorArgs(principal),_quote_id:match[1],_hosted:isCustomer});
   if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BookingApiError('upstream_unavailable');
   const row=raw as Record<string,unknown>,authority=normalizeAuthority(row.authority),snapshot={...row,authority,holds_inventory:false,principal:{issuer:row.issuer,subject:row.subject,clientId:row.client_id,customerId:row.customer_id,audience:row.audience,scopes:principal.scopes}} as unknown as QuoteSnapshot;
   const quote=quoteResultFromSnapshot(snapshot,deps.consentOrigin,deps.now?.()??Date.now());
   return jsonResponse(isCustomer?validated('QuoteReviewResult',{quote,operator_name:row.operator_name,vehicle_name:row.vehicle_name,agent_client_id:row.client_id},true):quote);
  }
  return grantRecoveryResponse(request,path,body,deps);
 };
}
