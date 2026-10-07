import {BookingApiError} from './errors.ts';
import {jsonResponse} from './catalog-routes.ts';
import {actorArgs,consentRpc,customerProof,uuid,validated,type ConsentDependencies} from './consent-routes.ts';
/** IDs are rendezvous references, never bearer authority. Original agent client
 * and scopes stay in SQL; browser approval cannot replace either with its BFF ID. */
export async function grantRecoveryResponse(request:Request,path:string,body:unknown,deps:ConsentDependencies):Promise<Response|null>{
 const revoke=/^\/v1\/grants\/([^/]+)\/revoke$/.exec(path),renewal=/^\/v1\/grant-renewals(?:\/([^/]+)(?:\/(review|complete))?)?$/.exec(path);
 if(!revoke&&!renewal)return null;
 if(revoke){
  if(request.method!=='POST'||!uuid.test(revoke[1]))throw new BookingApiError('invalid_input');validated('GrantRenewalReviewInput',body);
  const principal=await deps.auth.requirePrincipal(request,'rental_requests:read'),proof=await customerProof(request,principal,deps);
  await consentRpc(deps,'external_hosted_revoke_grant',{...actorArgs(principal),_grant_id:revoke[1],_csrf_hash:proof.csrfHash});
  return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
 }
 const id=renewal![1],action=renewal![2];
 const principal=await deps.auth.requirePrincipal(request,'rental_requests:read'),isCustomer=!!deps.hosted?.hostedClientIds.includes(principal.clientId);
 if(!id){
  if(request.method!=='POST'||isCustomer)throw new BookingApiError('invalid_input');
  const input=validated('GrantRenewalInput',body),secret=crypto.randomUUID()+crypto.randomUUID();
  const csrfHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const result=await consentRpc(deps,'external_begin_grant_recovery',{...actorArgs(principal),_grant_id:input.grant_id,_csrf_hash:csrfHash,_customer_origin:deps.consentOrigin});
  return jsonResponse(validated('GrantRenewalResult',result,true),201);
 }
 if(!uuid.test(id))throw new BookingApiError('invalid_input');
 if(!action&&request.method==='GET'){
  if(isCustomer)await customerProof(request,principal,deps);
  const result=await consentRpc(deps,'external_review_grant_renewal',{...actorArgs(principal),_renewal_id:id,_hosted:isCustomer,_customer_origin:deps.consentOrigin});
  return jsonResponse(validated(isCustomer?'GrantRenewalReviewResult':'GrantRenewalResult',result,true));
 }
 if(request.method!=='POST'||!action)throw new BookingApiError('invalid_input');
 const input=validated(action==='review'?'GrantRenewalReviewInput':'GrantRenewalCompleteInput',body),proof=await customerProof(request,principal,deps);
 const result=await consentRpc(deps,action==='review'?'external_hosted_review_grant_renewal':'external_hosted_complete_grant_renewal',{...actorArgs(principal),_renewal_id:id,_csrf_hash:proof.csrfHash,...(action==='complete'?{_scopes:input.action_scopes,_explicit_new_delegation:input.explicit_new_delegation,_consented:input.consented}:{})});
 return jsonResponse(validated('GrantRenewalReviewResult',result,true));
}
