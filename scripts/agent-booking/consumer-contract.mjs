import {createHash} from 'node:crypto';
/** Exact reviewed frontend generator protocol. Compare complete validator
 * contents as well as provenance, so a preserved hash cannot hide local edits. */
export function expectedBrowserContract(source){
 const boundary=source.indexOf('export function validateIdempotencyKey');
 if(boundary<0)throw Error('Canonical validation boundary changed; review consumer generation.');
 const sha=createHash('sha256').update(source).digest('hex');
 const generated=source.slice(0,boundary).replace(/\b0n\b/g,'BigInt(0)');
 return `// GENERATED canonical backend schema/validator; do not edit by hand.\n// Source: supabase/functions/_shared/external-booking/contracts.ts\n// Source SHA256: ${sha}\n// Generator: scripts/generate-external-contracts.mjs; server-only section excluded; 0n -> BigInt(0).\n${generated}`;
}
export function assertBrowserContract(source,artifact){
 if(artifact!==expectedBrowserContract(source))throw Error('Frontend canonical contract drift: regenerate from the reviewed backend source.');
}
