// Genuine LOCAL PostgreSQL/HTTP tests, explicitly partial-schema. This custom
// owned runner does not bypass or satisfy hosted staging/provider release gates.
import {beforeAll,expect,it} from 'vitest';import {spawnSync} from 'node:child_process';import {resolve} from 'node:path';
import {createRequestExtension} from '../../supabase/functions/_shared/external-booking/request-routes.ts';
const run=(script:string,...args:string[])=>{const r=spawnSync(process.execPath,[resolve('request-lab',script),...args],{encoding:'utf8',timeout:25000});if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);return r.stdout;};
beforeAll(()=>{run('setup-status.mjs');});
it('checks actual first/replay metadata, ownership/tenant/client/audience, expired vs revoked recovery and SQL ACLs',()=>{expect(run('lab.mjs','sql',resolve('request-lab/status-check.sql'))).toContain('ROLLBACK');});
it('20 actual concurrent connections return exactlyone201/nineteen200 and real row locks expire in500ms',()=>{const result=JSON.parse(run('status-concurrency.mjs'));expect(result).toMatchObject({sameKeyConnections:20,created201:1,replayed200:19,connectionSettingsUnchanged:true});expect(result.heldRowLockTimeoutMs).toBeLessThan(2000);});
it('actual HTTP request/status handlers load PostgreSQL, conditional304 rechecks current grant',async()=>{
 const guard=JSON.parse(run('lab.mjs','status')),principal={issuer:'https://issuer.example.invalid',subject:'renter',clientId:'client-a',audience:'https://api.example.invalid/v1',tokenId:'synthetic-preverified-fixture',scopes:['rental_requests:create','rental_requests:read'] as const};
 const sql=(query:string)=>{const r=spawnSync('docker',['exec','-i',guard.container,'psql','-v','ON_ERROR_STOP=1','-At','-U','postgres','-d','agent_test'],{input:query,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
 const q=JSON.parse(sql('SELECT jsonb_build_object(\'quote_id\',quote_id,\'consent_receipt_id\',receipt_id) FROM public.lab_requests WHERE ordinal=5;'));
 const publicBase='https://api.example.invalid/functions/v1/external-booking-api';
 const handler=createRequestExtension({publicOrigin:publicBase,customerOrigin:'https://customer.example.invalid',auth:{requirePrincipal:async()=>principal},rpc:{rpc:async(name,args)=>{
  if(!['external_submit_rental_request_result','external_read_rental_request','external_begin_request_grant_recovery'].includes(name))throw Error('Unexpected RPC');
  const literal=(x:unknown)=>x===null?'NULL':`'${String(x).replaceAll("'","''")}'`;
  const r=spawnSync('docker',['exec','-i',guard.container,'psql','-v','ON_ERROR_STOP=1','-At','-U','postgres','-d','agent_test'],{input:`SELECT public.${name}(${Object.entries(args).map(([key,value])=>`${key}=>${literal(value)}`).join(',')});`,encoding:'utf8'});
  return r.status===0?{data:JSON.parse(r.stdout),error:null}:{data:null,error:{message:['not_found','grant_expired','grant_revoked'].find(code=>r.stderr.includes(code))??'upstream_unavailable'}};
 }} });
 const create=()=>handler(new Request('https://api.example.invalid/v1/rental-requests',{method:'POST',headers:{'Idempotency-Key':'http-local-request-001'}}),'/v1/rental-requests',q);
 const first=await create(),body=await first!.json();expect(first!.status).toBe(201);expect(body.links.status).toBe(publicBase+'/v1/rental-requests/'+body.ref);const replay=await create();expect(replay!.status).toBe(200);expect(await replay!.json()).toEqual(body);
 const path=`/v1/rental-requests/${body.ref}`,read=await handler(new Request('https://api.example.invalid'+path),path,undefined);expect(read!.status).toBe(200);expect((await read!.json()).status).toBe('pending_documents');const tag=read!.headers.get('ETag')!;
 expect((await handler(new Request('https://api.example.invalid'+path,{headers:{'If-None-Match':tag}}),path,undefined))!.status).toBe(304);
 sql(`SELECT public.external_revoke_booking_grant(grant_id,customer_id,issuer,subject,client_id) FROM public.external_request_idempotency WHERE idempotency_key='http-local-request-001';`);
 const revoked=await handler(new Request('https://api.example.invalid'+path,{headers:{'If-None-Match':tag}}),path,undefined);expect(revoked!.status).toBe(409);expect((await revoked!.json()).code).toBe('grant_revoked');expect(revoked!.headers.get('Link')).toBe(`<${publicBase}${path}/grant-renewals>; rel="grant-renewal"`);
 const recovery=await handler(new Request('https://api.example.invalid'+path+'/grant-renewals',{method:'POST'}),path+'/grant-renewals',{});expect(recovery!.status).toBe(201);expect((await recovery!.json()).state).toBe('authorization_required');
});
