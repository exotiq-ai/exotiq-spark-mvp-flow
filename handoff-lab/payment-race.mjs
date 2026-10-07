// Actual local PostgreSQL transport. Synthetic settlement simulates a delayed
// already-validated provider webhook; it does not prove Stripe interoperability.
import {spawn,spawnSync} from 'node:child_process';import path from 'node:path';
const lab=path.resolve(process.argv[2]??'');if(!lab.endsWith('/integration-lab'))throw Error('Explicit lab required');
const status=spawnSync(process.execPath,[path.join(lab,'lab.mjs'),'status'],{encoding:'utf8'});if(status.status)throw Error('Owned guard failed');const m=JSON.parse(status.stdout);if(!m.partialSchema||m.providerParity||m.port!==null)throw Error('Not partial isolated lab');
const connect=()=>spawn('docker',['exec','-i',m.container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','agent_test'],{stdio:['pipe','pipe','pipe']});
const run=(sql,p=connect())=>new Promise((resolve,reject)=>{let out='',err='';const timer=setTimeout(()=>{p.kill();reject(Error('Local SQL deadline'));},6000);p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',code=>{clearTimeout(timer);resolve({code,out,err});});p.stdin.end(sql);});
const expire="BEGIN;UPDATE public.bookings SET status='payment_expired' WHERE team_id='a1410000-0000-4000-8000-000000000001';SELECT pg_sleep(0.1);COMMIT;";
const settle="BEGIN;SELECT public.external_record_settlement('evt_delayed_synthetic',booking_ref,'operator','pi_delayed_synthetic',(total_value*100)::bigint,'usd','test','acct_synthetic') FROM public.bookings WHERE team_id='a1410000-0000-4000-8000-000000000001';COMMIT;";
const statements=[expire,settle],connections=[connect(),connect()],started=performance.now();let retries=0;
const results=await Promise.all(statements.map((sql,i)=>run(sql,connections[i])));
for(let i=0;i<results.length;i++){if(results[i].code){if(!/inventory_guard_retry|could not obtain|lock timeout|serialization|retry/i.test(results[i].err))throw Error('Unexpected concurrent transaction failure: '+results[i].err);const retry=await run(statements[i]);if(retry.code)throw Error('Whole transaction retry failed');retries++;}}
const proof=await run("SELECT b.status,coalesce(b.operator_payment_intent_id,''),(SELECT count(*) FROM public.external_payment_settlements s WHERE s.booking_id=b.id AND s.intent_id='pi_delayed_synthetic'),public.agent_inventory_blocking(b.status) FROM public.bookings b WHERE b.team_id='a1410000-0000-4000-8000-000000000001';");
if(proof.code||proof.out.trim()!=='pending_payment|pi_delayed_synthetic|1|t')throw Error('Delayed settlement lost occupancy or duplicated authority: '+proof.err+proof.out);
console.log(JSON.stringify({environment:'owned-local-partial-schema',providerParity:false,connections:2,delayedSettlementRecordedOnce:true,inventoryPreserved:true,wholeTransactionRetries:retries,elapsedMs:Math.round(performance.now()-started)}));
