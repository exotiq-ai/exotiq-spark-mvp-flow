import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const lab=path.dirname(fileURLToPath(import.meta.url));
const guard=spawnSync(process.execPath,[path.join(lab,'lab.mjs'),'status'],{encoding:'utf8'});
if(guard.status!==0)throw Error('Owned local isolation guard failed');
const manifest=JSON.parse(guard.stdout);
const run=(sql)=>new Promise((resolve,reject)=>{
 const process=spawn('docker',['exec','-i',manifest.container,'psql','-v','ON_ERROR_STOP=1','-At','-U','postgres','-d','agent_test'],{stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';process.stdout.on('data',data=>stdout+=data);process.stderr.on('data',data=>stderr+=data);process.on('error',reject);process.on('close',code=>resolve({code,stdout,stderr}));process.stdin.end(sql);
});
const sql=(ordinal,key)=>`SELECT public.external_submit_rental_request(quote_id,receipt_id,'${key}','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid') FROM public.lab_requests WHERE ordinal=${ordinal};`;
async function transaction(ordinal,key){
 for(let attempt=0;attempt<5;attempt++){
  const response=await run(sql(ordinal,key));
  if(response.code===0)return {success:true,body:JSON.parse(response.stdout),attempts:attempt+1};
  if(/inventory_retry|request_in_flight/.test(response.stderr)&&attempt<4){await new Promise(resolve=>setTimeout(resolve,25*2**attempt));continue;}
  if(response.stderr.includes('consent_mismatch'))return {success:false,consentDenied:true,attempts:attempt+1};
  throw Error('Unexpected local request SQL failure: '+response.stderr);
 }
}
const same=await Promise.all(Array.from({length:20},()=>transaction(3,'twenty-same-key-001')));
if(same.some(result=>!result.success)||new Set(same.map(result=>JSON.stringify(result.body))).size!==1)throw Error('Same-key response identity failed');
const different=await Promise.all(Array.from({length:20},(_,index)=>transaction(4,`twenty-distinct-key-${String(index).padStart(3,'0')}`)));
if(different.filter(result=>result.success).length!==1||different.filter(result=>result.consentDenied).length!==19)throw Error('Different keys consumed receipt twice');
const counts=await run("SELECT jsonb_build_object('bookings',(SELECT count(*) FROM bookings),'outbox',(SELECT count(*) FROM external_booking_outbox),'ledgers',(SELECT count(*) FROM external_request_idempotency),'grants',(SELECT count(*) FROM external_booking_grants),'consumed_receipts',(SELECT count(*) FROM external_consent_receipts WHERE consumed_at IS NOT NULL),'consumed_quotes',(SELECT count(*) FROM external_quotes WHERE consumed_booking_id IS NOT NULL));");
const actual=JSON.parse(counts.stdout);
if(Object.values(actual).some(value=>value!==2))throw Error('Atomic side-effect counts incorrect: '+JSON.stringify(actual));
fs.writeFileSync(path.join(lab,'concurrency-evidence.json'),JSON.stringify({partialSchema:true,providerParity:false,sameKeyConnections:20,differentKeyConnections:20,same,different,actual},null,2)+'\n');
console.log(JSON.stringify({sameKeyConnections:20,sameKeyBookingCount:1,differentKeyConnections:20,differentKeyBookingCount:1,consentDenied:19,atomicSideEffectCounts:actual,partialSchema:true}));
