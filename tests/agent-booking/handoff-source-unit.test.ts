import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
import {verifyInternalHandoff,signInternalHandoff} from '../../supabase/functions/_shared/external-booking/internal-handoff.ts';
import * as bridge from '../../supabase/functions/_shared/external-booking/provider-handoff.ts';
// Execute actual source handlers with offline SDK transport. No provider proof.
function sourceHandler(path:string){
 let handler:any,providerCalls=0,queries=0,checkoutParameters:any;
 const booking={id:'booking',customer_id:'customer',booking_ref:'synthetic',confirmation_token:'legacy',status:'pending_payment',booking_source:'marketplace',payment_due_at:new Date(Date.now()+3600000).toISOString(),total_value:100,platform_fee_cents:1000,protection_total_cents:0,team_id:'10000000-0000-4000-8000-000000000001',vehicle_id:'vehicle'};
 const db={auth:{getUser:async()=>({data:{user:null}})},rpc:async(name:string)=>({data:name==='external_provider_handoff_context'?{booking_id:booking.id,booking_ref:booking.booking_ref,customer_id:booking.customer_id,operator_id:booking.team_id,mode:'test'}:name==='external_reserve_rental_checkout'?{attempt_key:'persisted-source-key',customer_ref:null,session_ref:null}:true,error:null}),from:(table:string)=>{queries++;const chain:any={select:()=>chain,eq:()=>chain,single:async()=>({data:table==='teams'?{name:'Operator',currency:'USD',stripe_test_account_id:'acct_synthetic'}:booking}),maybeSingle:async()=>({data:table==='identity_verifications'?{status:'verified',document_expiry:null}:booking})};return chain;}};
 const stripe={customers:{list:async()=>({data:[]})},checkout:{sessions:{create:async(parameters:any)=>{providerCalls++;checkoutParameters=parameters;return {id:'cs_test_synthetic',url:'https://checkout.stripe.com/c/pay/test',status:'open',payment_status:'unpaid',livemode:false,expires_at:Math.floor(Date.now()/1000)+600,amount_total:10000,currency:'usd',metadata:parameters.metadata,success_url:parameters.success_url,cancel_url:parameters.cancel_url};}}}};
 const fakeRequire=(name:string)=>{
  if(name.includes('/http/server'))return {serve:(fn:any)=>handler=fn};
  if(name.includes('esm.sh/stripe'))return {default:function(){return stripe;}};
  if(name.includes('esm.sh/@supabase'))return {createClient:()=>db};
  if(name.includes('rateLimit'))return {checkRateLimit:async()=>true,clientIp:()=> 'synthetic'};
  if(name.includes('stripeMode'))return {resolveStripeMode:()=> 'test',teamConnectedAccountId:()=> 'acct_synthetic'};
  if(name.includes('internal-handoff'))return {verifyInternalHandoff};
  if(name.includes('provider-handoff'))return bridge;
  throw new Error('Unconfigured source import '+name);
 };
 const output=transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText,module={exports:{}};
 new Function('require','module','exports','Deno',output)(fakeRequire,module,module.exports,{env:{get:(name:string)=>name==='EXTERNAL_API_HANDOFF_KEY'?'a'.repeat(43):name==='EXTERNAL_API_CUSTOMER_ORIGIN'?'https://customer.example.test':name.includes('SECRET_KEY')?'sk_test_synthetic':undefined}});
 return {handler:handler as (request:Request)=>Promise<Response>,counts:()=>({providerCalls,queries}),checkoutParameters:()=>checkoutParameters};
}
it.each(['rent-checkout','identity-create-session'])('actual %s rejects unsigned external marker before source authority/provider access',async endpoint=>{
 const source=sourceHandler('supabase/functions/'+endpoint+'/index.ts');
 const response=await source.handler(new Request('https://api.example.test/'+endpoint,{method:'POST',body:JSON.stringify({booking_ref:'synthetic',token:'legacy',confirmation_token:'legacy',external_handoff:{nonce_hash:'a'.repeat(64),claim_token:'00000000-0000-4000-8000-000000000000'}})}));
 expect(response.status).toBe(401);expect(source.counts()).toEqual({providerCalls:0,queries:0});
});
it('actual signed source checkout returns to the exact authenticated generic account selector',async()=>{
 const source=sourceHandler('supabase/functions/rent-checkout/index.ts'),body={booking_ref:'synthetic',token:'legacy',external_handoff:{nonce_hash:'a'.repeat(64),claim_token:'00000000-0000-4000-8000-000000000000'}},signed=await signInternalHandoff('rent-checkout',body,'a'.repeat(43));
 const result=await source.handler(new Request('https://api.example.test/rent-checkout',{method:'POST',headers:{'X-Exotiq-Handoff-Timestamp':signed.timestamp,'X-Exotiq-Handoff-Proof':signed.proof},body:JSON.stringify(body)}));expect(result.status).toBe(200);
 const expected='https://customer.example.test/agent/account/10000000-0000-4000-8000-000000000001?booking_ref=synthetic&action=checkout';
 expect(source.checkoutParameters().success_url).toBe(expected);expect(source.checkoutParameters().cancel_url).toBe(expected);expect(JSON.stringify(source.checkoutParameters())).not.toContain('legacy');
});
