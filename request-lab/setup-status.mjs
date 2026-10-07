import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const lab=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(lab);
function sql(file){const r=spawnSync(process.execPath,[path.join(lab,'lab.mjs'),'sql',path.join(lab,file)],{encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);}
const guard=spawnSync(process.execPath,[path.join(lab,'lab.mjs'),'status'],{encoding:'utf8'});if(guard.status!==0)throw Error('Explicitly start this OWNED partial lab first');
// Fresh labs bootstrap the fixed marker; existing labs reset only after marker
// verification in reset.sql. No network addresses/credentials are accepted.
const m=JSON.parse(guard.stdout),probe=spawnSync('docker',['exec',m.container,'psql','-U','postgres','-d','agent_test','-Atc',"SELECT to_regclass('public.lab_identity')"],{encoding:'utf8'});
if(probe.status!==0)throw Error('Partial marker probe failed');
if(probe.stdout.trim())sql('reset.sql');
sql('baseline.sql');sql('reviewed-source.sql');sql('request-dependencies.sql');sql('status-dependencies.sql');sql('status-lifecycle-dependencies.sql');
const hashes=[];
for(const file of ['20261007090000_external_customer_grants.sql','20261007090100_external_quote_snapshots.sql','20261007090200_shared_inventory_guard.sql','20261007090300_inventory_policy_read_parity.sql','20261007090400_consented_request_transaction.sql','20261007090470_hosted_consent_bridge.sql','20261007090500_external_lifecycle_reconciliation.sql','20261007090510_external_request_status.sql']){
 const contents=fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'),local='applied-'+file;fs.writeFileSync(path.join(lab,local),contents);sql(local);hashes.push({file,sha256:crypto.createHash('sha256').update(contents).digest('hex')});
}
sql('seed.sql');fs.writeFileSync(path.join(lab,'status-applied-evidence.json'),JSON.stringify({partialSchema:true,providerParity:false,hashes},null,2)+'\n');
console.log('Real PostgreSQL request/status dependencies applied to owned isolated PARTIAL lab.');
