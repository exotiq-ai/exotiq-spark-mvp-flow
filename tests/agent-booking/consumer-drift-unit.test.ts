import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {assertBrowserContract,expectedBrowserContract} from '../../scripts/agent-booking/consumer-contract.mjs';
const source=readFileSync('supabase/functions/_shared/external-booking/contracts.ts','utf8');
describe('ongoing API consumer compatibility',()=>{
 it('accepts the complete generated validator and excludes server cursor/OpenAPI code',()=>{
  const artifact=expectedBrowserContract(source);expect(()=>assertBrowserContract(source,artifact)).not.toThrow();
  expect(artifact).toContain('export function validateContract');expect(artifact).not.toContain('export function generateOpenApi');
 });
 it('rejects changed backend authority and edited browser validation even with a retained hash',()=>{
  const artifact=expectedBrowserContract(source);
  expect(()=>assertBrowserContract(source.replace("enum: ['USD']","enum: ['EUR']"),artifact)).toThrow(/drift/);
  expect(()=>assertBrowserContract(source,artifact.replace('Number.isSafeInteger(value)','Number.isInteger(value)'))).toThrow(/drift/);
  expect(()=>expectedBrowserContract(source.replace('export function validateIdempotencyKey','export function renamedBoundary'))).toThrow(/boundary/);
 });
});
