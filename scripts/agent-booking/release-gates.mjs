const critical=['unauthorized','duplicateRequests','duplicateCharges','overlaps','falseConfirmations','secretLeaks'];
const markets=['Miami','Tampa'],clients=['api','mcp'];
/** Evaluate a collected, reviewed pilot record. This offline check cannot
 * establish provider/deployment facts; local/partial records never qualify.
 * Missing/malformed metrics fail closed rather than becoming zero failures. */
export function evaluatePilotEvidence(record,expectedSourceFingerprint){
 const missing=[];const require=(ok,name)=>{if(!ok)missing.push(name);};
 require(record?.evidenceClass==='hosted-staging','hosted_staging');
 require(record?.partialSchema===false&&record?.appliedSchemaAndPrivilegesVerified===true,'applied_schema_privileges');
 require(record?.providersVerified===true,'managed_provider_acceptance');
 require(record?.gatewayAndSchedulerVerified===true,'gateway_scheduler');
 require(/^[a-f0-9]{64}$/.test(expectedSourceFingerprint??'')&&record?.sourceFingerprint===expectedSourceFingerprint,'current_source_provenance');
 require(record?.nextRequestRevocationVerified===true,'next_request_revocation');
 require(record?.authorityOutageClosesWrites===true&&record?.rollbackContinuityVerified===true,'outage_rollback');
 const journeys=Array.isArray(record?.journeys)?record.journeys:[];
 for(const market of markets)for(const client of clients){
  const matching=journeys.filter(j=>j?.market===market&&j.client===client);
  require(matching.length===1&&matching[0].operatorApproved===true&&matching[0].identityVerified===true&&matching[0].operatorSettled===true&&matching[0].exotiqSettled===true&&matching[0].itemizationEqual===true&&matching[0].authoritativeStatus==='confirmed','journey_'+market.toLowerCase()+'_'+client);
 }
 const metrics=record?.metrics;
 for(const name of critical)require(metrics?.[name]===0,'zero_'+name);
 require(Number.isSafeInteger(metrics?.itemizationsCompared)&&metrics.itemizationsCompared>=4&&metrics.itemizationsEqual===metrics.itemizationsCompared,'itemization_equality');
 require(Number.isSafeInteger(metrics?.schedulerLagMs)&&metrics.schedulerLagMs>=0&&metrics.schedulerLagMs<=300000,'scheduler_lag');
 require(metrics?.unresolvedFailures===0,'investigated_failures');
 for(const prefix of ['unknown','handoff']){
  const samples=metrics?.[prefix+'Samples'],failures=metrics?.[prefix+'Failures'];
  const valid=Number.isSafeInteger(samples)&&samples>=0&&Number.isSafeInteger(failures)&&failures>=0&&failures<=samples;
  require(valid&&!(samples>=100&&failures/samples>0.01),'threshold_'+prefix);
 }
 return {releaseAllowed:missing.length===0,missing};
}
