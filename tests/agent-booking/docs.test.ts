import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {generateOpenApi,schemas,validateContract} from '../../supabase/functions/_shared/external-booking/contracts';
const required = {
 '/v1/quotes/{quote_id}':'get', '/v1/quotes/{quote_id}/consents':'post',
 '/v1/quotes/{quote_id}/consent-result':'get', '/v1/customers/operator-links':'post',
 '/v1/grant-renewals':'post', '/v1/grant-renewals/{renewal_id}':'get',
 '/v1/grant-renewals/{renewal_id}/review':'post', '/v1/grant-renewals/{renewal_id}/complete':'post',
 '/v1/grants/{grant_id}/revoke':'post', '/v1/rental-requests/{ref}/grant-renewals':'post',
 '/v1/rental-requests/{ref}/identity-handoff':'post', '/v1/customers/rental-requests/{ref}':'get',
 '/v1/customer-handoffs/{nonce}/review':'get', '/v1/customer-handoffs/{nonce}/resolve':'post', '/v1/customer-handoffs/{nonce}/grant-renewals':'post', '/v1/customers/rental-requests/{ref}/identity-handoff':'post', '/v1/customers/rental-requests/{ref}/checkout-handoff':'post',
};
describe('published API contract',()=>{
 it('includes the actual consent and recovery boundaries with private customer proof',()=>{
  const api=generateOpenApi(); const paths=api.paths as Record<string,Record<string,any>>;
  for(const [path,method] of Object.entries(required))expect(paths[path]?.[method],path).toBeDefined();
  for(const path of ['/v1/quotes/{quote_id}/consents','/v1/customers/operator-links','/v1/grants/{grant_id}/revoke','/v1/grant-renewals/{renewal_id}/review','/v1/grant-renewals/{renewal_id}/complete'])expect(paths[path].post.security[0].hostedCustomerProof).toEqual([]);
  expect(paths['/v1/quotes/{quote_id}/consent-result'].get.responses['202']).toBeDefined();
  expect(paths['/v1/grants/{grant_id}/revoke'].post.responses['204'].content).toBeUndefined();
  for(const [path,method] of Object.entries({'/v1/customers/rental-requests/{ref}':'get','/v1/customer-handoffs/{nonce}/review':'get','/v1/customer-handoffs/{nonce}/resolve':'post', '/v1/customer-handoffs/{nonce}/grant-renewals':'post', '/v1/customers/rental-requests/{ref}/identity-handoff':'post', '/v1/customers/rental-requests/{ref}/checkout-handoff':'post'}))expect(paths[path][method].security[0].hostedCustomerProof).toEqual([]);
  expect(paths['/v1/rental-requests/{ref}/identity-handoff'].post.security[0].customerOAuth).toEqual(['identity:handoff']);
  expect(paths['/v1/rental-requests/{ref}/checkout-handoff'].post.responses['201']).toBeDefined();
 });
 it('resolves every schema reference and unique operation/path parameter',()=>{
  const api=generateOpenApi();const ids=new Set();
  const walk=(value:any)=>{if(!value||typeof value!=='object')return;if(value.$ref)expect(Object.keys(schemas)).toContain(value.$ref.replace('#/components/schemas/',''));for(const next of Object.values(value))walk(next);};walk(api);
  for(const [path,methods] of Object.entries(api.paths))for(const op of Object.values(methods)){
   expect(ids.has(op.operationId)).toBe(false);ids.add(op.operationId);
   for(const name of [...path.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]))expect(op.parameters.some(p=>p.in==='path'&&p.name===name&&p.required)).toBe(true);
  }
 });
 it('publishes exactly the generated artifact',()=>expect(JSON.parse(readFileSync('docs/external-booking/openapi.yaml','utf8'))).toEqual(generateOpenApi()));
 it('validates documented examples and rejects changed monetary authority',()=>{
  const examples=JSON.parse(readFileSync('docs/external-booking/examples.json','utf8'));
  for(const example of examples)expect(validateContract(example.contract,example.value).ok,example.description).toBe(true);
  const quote=examples.find((example:any)=>example.contract==='QuoteResult');
  expect(quote,'Published itemized quote example').toBeDefined();
  expect(validateContract('QuoteResult',{...quote.value,total_cents:quote.value.total_cents+1}).ok).toBe(false);
 });
 it('records exact canonical and example provenance without claiming hosted acceptance',()=>{
  const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
  const manifest=JSON.parse(readFileSync('docs/external-booking/contract-manifest.json','utf8'));
  expect(manifest.source_sha256).toBe(digest(readFileSync('supabase/functions/_shared/external-booking/contracts.ts','utf8')));
  expect(manifest.examples_sha256).toBe(digest(JSON.stringify(JSON.parse(readFileSync('docs/external-booking/examples.json','utf8')))));
  expect(manifest.provider_acceptance).toBe('unverified');
  expect(manifest.operations).toEqual(Object.fromEntries(Object.entries(generateOpenApi().paths).map(([path,methods])=>[path,Object.fromEntries(Object.entries(methods).map(([method,operation])=>[method,operation.operationId]))])));
 });
});
