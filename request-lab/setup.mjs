import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const lab=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(lab);
function sql(file){const result=spawnSync(process.execPath,[path.join(lab,'lab.mjs'),'sql',path.join(lab,file)],{encoding:'utf8'});if(result.status!==0)throw Error(result.stdout+'\n'+result.stderr);}
const guard=spawnSync(process.execPath,[path.join(lab,'lab.mjs'),'status'],{encoding:'utf8'});
if(guard.status!==0)throw Error('Owned lab required; start explicit request-lab/lab.mjs start first.');
sql('reset.sql');sql('baseline.sql');sql('reviewed-source.sql');sql('request-dependencies.sql');
// Add exact retained17 body to prove the real source ambiguity is fixed, not
// merely absent from a partial baseline. No whole historical file executes.
const obsoleteFile='20260819024902_88d5433f-dd91-452b-bec6-da445dd77008.sql';
const original=fs.readFileSync(path.join(root,'supabase/migrations',obsoleteFile),'utf8');
const body=original.match(/CREATE OR REPLACE FUNCTION public\.create_marketplace_booking\([\s\S]*?AS (\$\w*\$)[\s\S]*?\1;/)?.[0];
if(!body)throw Error('Missing exact retained17 source body');
fs.writeFileSync(path.join(lab,'applied-obsolete17.sql'),body+'\n');sql('applied-obsolete17.sql');
const hashes=[{file:obsoleteFile,selectedStatementSha256:crypto.createHash('sha256').update(body).digest('hex')}];
for(const file of ['20261007090000_external_customer_grants.sql','20261007090100_external_quote_snapshots.sql','20261007090200_shared_inventory_guard.sql','20261007090300_inventory_policy_read_parity.sql','20261007090400_consented_request_transaction.sql']){
 const contents=fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8');const local='applied-'+file;
 fs.writeFileSync(path.join(lab,local),contents);sql(local);hashes.push({file,sha256:crypto.createHash('sha256').update(contents).digest('hex')});
}
sql('seed.sql');fs.writeFileSync(path.join(lab,'applied-evidence.json'),JSON.stringify({partialSchema:true,providerParity:false,hashes},null,2)+'\n');
console.log('Owned partial request laboratory reset and seeded; exact source17 + request migration applied.');
