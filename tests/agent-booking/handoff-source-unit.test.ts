import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
import {verifyInternalHandoff} from '../../supabase/functions/_shared/external-booking/internal-handoff.ts';
// Execute actual source handlers with offline SDK transport. No provider proof.
function sourceHandler(path:string){
 let handler:any,providerCalls=0,queries=0;
 const booking={id:'booking',customer_id:'customer',booking_ref:'synthetic',confirmation_token:'legacy',status:'pending_payment',booking_source:'marketplace',payment_due_at:new Date(Date.now()+3600000).toISOString(),total_value:100,platform_fee_cents:1000,protection_total_cents:0,team_id:'operator',vehicle_id:'vehicle'};
 const db={auth:{getUser:async()=>({data:{user:null}})},from:(table:string)=>{queries++;const chain:any={select:()=>chain,eq:()=>chain,single:async()=>({data:table==='teams'?{name:'Operator',currency:'USD',stripe_test_account_id:'acct_synthetic'}:booking}),maybeSingle:async()=>({data:table==='identity_verifications'?{status:'verified',document_expiry:null}:booking})};return chain;}};
 const stripe={customers:{list:async()=>({data:[]})},checkout:{sessions:{create:async()=>{providerCalls++;return {id:'cs_test_synthetic',url:'https://checkout.stripe.com/c/pay/test'};}}}};
 const fakeRequire=(name:string)=>{
  if(name.includes('/http/server'))return {serve:(fn:any)=>handler=fn};
  if(name.includes('esm.sh/stripe'))return {default:function(){return stripe;}};
  if(name.includes('esm.sh/@supabase'))return {createClient:()=>db};
  if(name.includes('rateLimit'))return {checkRateLimit:async()=>true,clientIp:()=> 'synthetic'};
  if(name.includes('stripeMode'))return {resolveStripeMode:()=> 'test',teamConnectedAccountId:()=> 'acct_synthetic'};
  if(name.includes('internal-handoff'))return {verifyInternalHandoff};
  if(name.includes('provider-handoff'))return {};
  throw new Error('Unconfigured source import '+name);
 };
 const output=transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText,module={exports:{}};
 new Function('require','module','exports','Deno',output)(fakeRequire,module,module.exports,{env:{get:(name:string)=>name==='EXTERNAL_API_HANDOFF_KEY'?'a'.repeat(43):name.includes('SECRET_KEY')?'sk_test_synthetic':undefined}});
 return {handler:handler as (request:Request)=>Promise<Response>,counts:()=>({providerCalls,queries})};
}
it.each(['rent-checkout','identity-create-session'])('actual %s rejects unsigned external marker before source authority/provider access',async endpoint=>{
 const source=sourceHandler('supabase/functions/'+endpoint+'/index.ts');
 const response=await source.handler(new Request('https://api.example.test/'+endpoint,{method:'POST',body:JSON.stringify({booking_ref:'synthetic',token:'legacy',confirmation_token:'legacy',external_handoff:{nonce_hash:'a'.repeat(64),claim_token:'00000000-0000-4000-8000-000000000000'}})}));
 expect(response.status).toBe(401);expect(source.counts()).toEqual({providerCalls:0,queries:0});
});
