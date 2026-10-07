// ROOT invokes after its explicitly marked lab delta + dedicated synthetic seed.
// No credentials, cloud fallback, arbitrary SQL, provider calls, or host port.
import {spawn,spawnSync} from 'node:child_process';import path from 'node:path';
const lab=path.resolve(process.argv[2]??'');if(!lab.endsWith('/integration-lab'))throw Error('Require explicit root-owned integration-lab directory');
function guard(){const r=spawnSync(process.execPath,[path.join(lab,'lab.mjs'),'status'],{encoding:'utf8'});if(r.status!==0)throw Error('Strict owned laboratory guard failed');const m=JSON.parse(r.stdout);if(m.partialSchema!==true||m.providerParity!==false||m.port!==null)throw Error('Not an isolated partial lab');return m;}
const connect=()=>{const m=guard();return spawn('docker',['exec','-i',m.container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','agent_test'],{stdio:['pipe','pipe','pipe']});};
const run=sql=>new Promise((resolve,reject)=>{const p=connect();let out='',err='';const timer=setTimeout(()=>{p.kill();reject(Error('Bounded local connection exceeded'));},6000);p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',code=>{clearTimeout(timer);resolve({code,out,err});});p.stdin.end(sql);});
const statement=n=>`BEGIN;SELECT public.external_create_customer_owned_handoff('https://issuer.example.invalid','renter','hosted','https://api.example.invalid/external-booking-api',ref,'identity',repeat('${n}',64),'test') FROM public.lab_handoff_concurrency;SELECT pg_sleep(0.1);COMMIT;`;
const started=performance.now(),results=await Promise.all([run(statement('a')),run(statement('b'))]);
if(results.some(r=>r.code!==0||/lock timeout|deadlock/i.test(r.err)))throw Error('Concurrent customer nonce failed its bounded direct booking lock');
const authority=await run("SELECT count(*),count(*)FILTER(WHERE revoked_at IS NULL),count(DISTINCT provider_attempt_key),count(DISTINCT provider_attempt_created_at) FROM public.external_customer_handoffs WHERE operator_id='a1410000-0000-4000-8000-000000000001';");
if(authority.code||authority.out.trim()!=='2|1|1|1')throw Error('Concurrent rotation lost single active nonce/durable provider attempt');
console.log(JSON.stringify({environment:'owned-local-partial-schema',providerParity:false,connections:2,bothSucceeded:true,singleActiveNonce:true,oneDurableProviderAttempt:true,elapsedMs:Math.round(performance.now()-started)}));
