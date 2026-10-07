import {describe,it,expect} from 'vitest';
import {evaluatePilotEvidence} from '../../scripts/agent-booking/release-gates.mjs';
const fingerprint='a'.repeat(64);
// Synthetic checker fixture only. No test execution or provider proof is
// established by these booleans; actual evidence must be collected separately.
const fixture=()=>({evidenceClass:'hosted-staging',partialSchema:false,appliedSchemaAndPrivilegesVerified:true,providersVerified:true,gatewayAndSchedulerVerified:true,sourceFingerprint:fingerprint,nextRequestRevocationVerified:true,authorityOutageClosesWrites:true,rollbackContinuityVerified:true,journeys:['Miami','Tampa'].flatMap(market=>['api','mcp'].map(client=>({market,client,operatorApproved:true,identityVerified:true,operatorSettled:true,exotiqSettled:true,itemizationEqual:true,authoritativeStatus:'confirmed'}))),metrics:{unauthorized:0,duplicateRequests:0,duplicateCharges:0,overlaps:0,falseConfirmations:0,secretLeaks:0,itemizationsCompared:4,itemizationsEqual:4,schedulerLagMs:300000,unresolvedFailures:0,unknownSamples:100,unknownFailures:1,handoffSamples:100,handoffFailures:1}});
describe('measured pilot release gates',()=>{
 it('refuses local/partial evidence regardless of passing local metrics',()=>{
  const result=evaluatePilotEvidence({...fixture(),evidenceClass:'local-partial',partialSchema:true,providersVerified:false,gatewayAndSchedulerVerified:false},fingerprint);
  expect(result.releaseAllowed).toBe(false);expect(result.missing).toEqual(expect.arrayContaining(['hosted_staging','applied_schema_privileges','managed_provider_acceptance','gateway_scheduler']));
 });
 it('requires all four actual journey states and every independent settlement',()=>{
  expect(evaluatePilotEvidence(fixture(),fingerprint).releaseAllowed).toBe(true);
  for(const field of ['operatorApproved','identityVerified','operatorSettled','exotiqSettled','itemizationEqual']){const record=fixture();(record.journeys[0] as any)[field]=false;expect(evaluatePilotEvidence(record,fingerprint).releaseAllowed,field).toBe(false);}
  const pending=fixture();pending.journeys[0].authoritativeStatus='pending_payment';expect(evaluatePilotEvidence(pending,fingerprint).releaseAllowed).toBe(false);
  const duplicate=fixture();duplicate.journeys[1]={...duplicate.journeys[0]};expect(evaluatePilotEvidence(duplicate,fingerprint).releaseAllowed).toBe(false);
 });
 it('never turns missing metrics into zero and rejects any critical failure or stale source',()=>{
  expect(evaluatePilotEvidence({...fixture(),metrics:{}},fingerprint).releaseAllowed).toBe(false);
  for(const key of ['unauthorized','duplicateRequests','duplicateCharges','overlaps','falseConfirmations','secretLeaks','unresolvedFailures']){const record=fixture();(record.metrics as any)[key]=1;expect(evaluatePilotEvidence(record,fingerprint).releaseAllowed,key).toBe(false);}
  expect(evaluatePilotEvidence(fixture(),'b'.repeat(64)).releaseAllowed).toBe(false);
 });
 it('enforces exact itemization, five-minute lag and sampled failure thresholds',()=>{
  for(const patch of [{itemizationsEqual:3},{schedulerLagMs:300001},{unknownFailures:2},{handoffFailures:2},{unknownSamples:0,unknownFailures:1},{handoffFailures:NaN}])expect(evaluatePilotEvidence({...fixture(),metrics:{...fixture().metrics,...patch}},fingerprint).releaseAllowed).toBe(false);
  expect(evaluatePilotEvidence({...fixture(),metrics:{...fixture().metrics,handoffSamples:10,handoffFailures:1}},fingerprint).releaseAllowed).toBe(true); // Below alert floor; unresolvedFailures still must be zero.
 });
});
