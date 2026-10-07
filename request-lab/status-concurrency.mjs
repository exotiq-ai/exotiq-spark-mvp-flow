import fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const lab=path.dirname(fileURLToPath(import.meta.url));
const guard=spawnSync(process.execPath,[path.join(lab,'lab.mjs'),'status'],{encoding:'utf8'});if(guard.status!==0)throw Error('Strict owned partial laboratory guard failed');const m=JSON.parse(guard.stdout);
const connect=()=>spawn('docker',['exec','-i',m.container,'psql','-v','ON_ERROR_STOP=1','-At','-U','postgres','-d','agent_test'],{stdio:['pipe','pipe','pipe']});
const run=sql=>new Promise((resolve,reject)=>{const p=connect();let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',code=>resolve({code,out,err}));p.stdin.end(sql);});
const statement="SELECT public.external_submit_rental_request_result('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1',quote_id,receipt_id,'status-twenty-key-001','https://api.example.invalid') FROM public.lab_requests WHERE ordinal=3;";
async function create(){for(let attempt=0;attempt<5;attempt++){const r=await run(statement);if(!r.code)return JSON.parse(r.out);if(/request_in_flight|inventory_retry|lock timeout/.test(r.err)&&attempt<4){await new Promise(resolve=>setTimeout(resolve,25*2**attempt));continue;}throw Error(r.err);}}
const responses=await Promise.all(Array.from({length:20},create));
if(responses.filter(r=>r.created).length!==1||new Set(responses.map(r=>JSON.stringify(r.response))).size!==1)throw Error('Concurrent201/200 or durable body identity failure');
const ref=responses[0].response.ref;
const held=connect();let heldOutput='',heldError='';held.stdout.on('data',x=>heldOutput+=x);held.stderr.on('data',x=>heldError+=x);
const ready=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Owned lock fixture failed readiness:'+heldError)),2000);held.stdout.on('data',()=>{if(heldOutput.includes('LOCK_HELD')){clearTimeout(timeout);resolve();}});held.on('error',reject);});
held.stdin.write("BEGIN;SELECT 1 FROM public.external_customer_links WHERE subject='renter' FOR UPDATE;SELECT 'LOCK_HELD';\n");await ready;
const started=performance.now();let failed;try{failed=await run(`SELECT public.external_read_rental_request('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1','${ref}');`);}finally{held.stdin.end('ROLLBACK;\n');}
const elapsedMs=performance.now()-started;
if(failed.code===0||!failed.err.includes('lock timeout')||elapsedMs<400||elapsedMs>2000)throw Error('Database row wait exceeded/omitted bounded lock timeout:'+JSON.stringify({elapsedMs,error:failed.err}));
const after=await run("SELECT current_setting('lock_timeout')||','||current_setting('statement_timeout');");if(after.out.trim()!=='0,0')throw Error('Function timeout leaked into unrelated sessions');
const evidence={partialSchema:true,providerParity:false,sameKeyConnections:20,created201:1,replayed200:19,identicalBodies:true,heldRowLockTimeoutMs:Math.round(elapsedMs),connectionSettingsUnchanged:true,postgrestStatementTimeoutHoistingProven:false};
fs.writeFileSync(path.join(lab,'status-concurrency-evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
