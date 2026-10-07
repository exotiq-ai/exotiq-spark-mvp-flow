import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
// Actual scheduler source, isolated transport: no provider or hosted parity.
function scheduler(failQueue=false){
 let handler:((r:Request)=>Promise<Response>)|undefined;const calls:string[]=[];
 const db={rpc:async(name:string)=>{calls.push(name);return{name,data:[],error:failQueue&&name==='external_queue_unresolved_checkout_batch'?{message:'private failure'}:null};},from:()=>{const q:any={select:()=>q,eq:()=>q,is:()=>q,gt:()=>q,gte:()=>q,lte:()=>q,lt:()=>q,not:()=>q,then:(ok:any)=>Promise.resolve({data:[],error:null}).then(ok)};return q;}};
 const source=transpileModule(readFileSync('supabase/functions/rent-payment-scheduler/index.ts','utf8'),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText;
 const require=(name:string)=>{
  if(name.includes('/http/server'))return{serve:(h:typeof handler)=>handler=h};
  if(name.includes('esm.sh/@supabase'))return{createClient:()=>db};
  if(name.includes('serviceAuth'))return{requireCronToken:(r:Request)=>({ok:r.headers.get('x-cron-token')==='synthetic',response:()=>new Response(null,{status:401})})};
  if(name.includes('rentEmail'))return{};if(name.includes('rentFormat'))return{};
  throw Error('Unexpected import '+name);
 };
 const module={exports:{}};new Function('require','module','exports','Deno',source)(require,module,module.exports,{env:{get:()=>undefined}});
 if(!handler)throw Error('Scheduler source did not mount');return{handler,calls};
}
describe('checkout expiry scheduler transport',()=>{
 it('queues bounded unresolved attempts before any expiry sweep',async()=>{
  const {handler,calls}=scheduler();const result=await handler(new Request('https://api.example.invalid/rent-payment-scheduler',{method:'POST',headers:{'x-cron-token':'synthetic'}}));
  expect(result.status).toBe(200);expect(calls.slice(0,3)).toEqual(['external_queue_unresolved_checkout_batch','external_reconcile_lifecycle_batch','expire_overdue_payment_bookings']);
 });
 it('queue outage refuses expiry and exposes no provider/database detail',async()=>{
  const {handler,calls}=scheduler(true);const result=await handler(new Request('https://api.example.invalid/rent-payment-scheduler',{method:'POST',headers:{'x-cron-token':'synthetic'}}));
  expect(result.status).toBe(500);expect(calls).toEqual(['external_queue_unresolved_checkout_batch']);expect(await result.text()).not.toContain('private failure');
 });
 it('unsigned calls cannot queue or expire inventory',async()=>{
  const {handler,calls}=scheduler();expect((await handler(new Request('https://api.example.invalid/rent-payment-scheduler',{method:'POST'}))).status).toBe(401);expect(calls).toEqual([]);
 });
});
