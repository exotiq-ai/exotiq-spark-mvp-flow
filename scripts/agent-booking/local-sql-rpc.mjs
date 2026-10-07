/** TEST ONLY: production HTTP RPC requests can be routed to an explicitly owned
 * partial-schema local lab. No HTTP port, cloud fallback or provider access.
 * This does not verify PostgREST, applied production schema, pooling or ingress.
 */
import {readFileSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const safeMessage=new Set(['invalid_input','not_found','forbidden','unauthorized','upstream_unavailable','configuration_unavailable','external_writes_disabled','dates_unavailable','quote_changed','quote_expired','consent_mismatch','consent_expired','idempotency_conflict','grant_expired','grant_revoked','payment_window_expired','request_in_flight','renewal_expired']);
export function createLocalSqlRpc(manifestPath){
 const file=realpathSync(manifestPath),manifest=JSON.parse(readFileSync(file,'utf8'));
 if(manifest.partialSchema!==true||manifest.providerParity!==false||manifest.port!==null||!/^exotiq-agent-test-[a-f0-9]{12}-db$/.test(manifest.container)||!(/^[a-f0-9]{12}$/).test(manifest.owner)||manifest.container!==`exotiq-agent-test-${manifest.owner}-db`)throw Error('Not an owned partial local lab');
 if(process.env.DOCKER_HOST&&!process.env.DOCKER_HOST.startsWith('unix://'))throw Error('Remote Docker refused');
 const docker=args=>execFileSync('docker',args,{encoding:'utf8',timeout:6000,maxBuffer:1048576,stdio:['pipe','pipe','pipe']}).trim();
 function guard(){
  const context=JSON.parse(docker(['context','inspect']))[0];if(!context.Endpoints?.docker?.Host?.startsWith('unix://'))throw Error('Require local Unix Docker');
  const container=JSON.parse(docker(['inspect',manifest.container]))[0];
  if(container.Id!==manifest.containerId||container.Image!==manifest.imageId||container.Config.Labels?.['exotiq.agent-test.owner']!==manifest.owner||!container.State.Running)throw Error('Local lab ownership or runtime drift');
  const networks=Object.keys(container.NetworkSettings.Networks);
  if(networks.length!==1||networks[0]!==manifest.network||(container.NetworkSettings.Ports['5432/tcp']??[]).length!==0)throw Error('Local lab exposure drift');
  const network=JSON.parse(docker(['network','inspect',manifest.network]))[0];
  if(!network.Internal||network.Labels?.['exotiq.agent-test.owner']!==manifest.owner)throw Error('Local network isolation drift');
  const mounts=container.Mounts;
  if(mounts.length!==1||mounts[0].Type!=='volume'||mounts[0].Name!==manifest.volume)throw Error('Local lab filesystem drift');
  const volume=JSON.parse(docker(['volume','inspect',manifest.volume]))[0];
  if(volume.Labels?.['exotiq.agent-test.owner']!==manifest.owner)throw Error('Local volume ownership drift');
 }
 function query(sql){
  guard();
  return execFileSync('docker',['exec','-i',manifest.container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','agent_test'],{input:sql,encoding:'utf8',timeout:6000,maxBuffer:1048576,stdio:['pipe','pipe','pipe']}).trim();
 }
 if(query('SELECT current_database();')!=='agent_test')throw Error('Wrong local database');
 return {
  evidence:{environment:'owned-local-partial-schema',partialSchema:true,providerParity:false},
  /** Fixed synthetic fixture control, separate from RPC authority. Never accepts
   * a tenant selector or arbitrary SQL and never operates outside this lab. */
  async setFixtureAdmission(enabled){
   if(typeof enabled!=='boolean')throw Error('Invalid synthetic admission control');
   query(`BEGIN;SET LOCAL statement_timeout='4s';SET LOCAL lock_timeout='500ms';UPDATE public.external_api_runtime_settings SET external_api_new_writes_enabled=${enabled} WHERE singleton;UPDATE public.external_operator_api_settings SET external_api_enabled=${enabled} WHERE operator_id IN('a1200000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000002');COMMIT;`);
  },
  async rpc(name,args){
   if(!/^(?:external_[a-z_]+|agent_inventory_available|check_rate_limit)$/.test(name)||!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!/^_[a-z_]+$/.test(key)))throw Error('Invalid local RPC boundary');
   try{
    const signatures=JSON.parse(query(`SELECT coalesce(jsonb_agg(jsonb_build_object('names',p.proargnames[1:p.pronargs],'types',(SELECT jsonb_agg(format_type(t,NULL) ORDER BY ordinal) FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY a(t,ordinal)),'required',p.pronargs-p.pronargdefaults,'set',p.proretset)),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=${literal(name)};`));
    const keys=Object.keys(args),matches=signatures.filter(s=>Array.isArray(s.names)&&keys.every(key=>s.names.includes(key))&&keys.length>=s.required&&s.names.slice(0,s.required).every(key=>keys.includes(key)));
    if(matches.length!==1)throw Error('Local RPC signature mismatch');
    const signature=matches[0];
    const argumentsSql=keys.map(key=>{
     const type=signature.types[signature.names.indexOf(key)],value=args[key];
     if(value===null)return `${key} => NULL::${type}`;
     if(type==='jsonb'||type==='json')return `${key} => ${literal(JSON.stringify(value))}::${type}`;
     if(type.endsWith('[]')){if(!Array.isArray(value))throw Error('Local array mismatch');return `${key} => ARRAY(SELECT jsonb_array_elements_text(${literal(JSON.stringify(value))}::jsonb))::${type}`;}
     if(typeof value==='object'||value===undefined)throw Error('Local scalar mismatch');
     return `${key} => ${literal(value)}::${type}`;
    }).join(',');
    const call=`public.${name}(${argumentsSql})`;
    const select=signature.set?`SELECT coalesce(jsonb_agg(to_jsonb(value)), '[]') FROM ${call} value;`:`SELECT to_jsonb(${call});`;
    const output=query(`BEGIN;SET LOCAL ROLE service_role;SET LOCAL statement_timeout='4s';SET LOCAL lock_timeout='500ms';${select}COMMIT;`);
    return {data:output?JSON.parse(output):null,error:null};
   }catch(error){
    // psql diagnostics can contain SQL values. Never return or print them.
    const diagnostic=String(error?.stderr??''),match=/ERROR:\s+([^\n]+)/.exec(diagnostic),message=match?.[1]?.trim();
    return {data:null,error:{message:safeMessage.has(message)?message:'upstream_unavailable'}};
   }
  },
 };
}
