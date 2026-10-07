// Test-only alias for actual handler dependencies. No provider or SQL proof.
export let client:unknown;
export function setClient(value:unknown){client=value;}
export function createClient(){return client;}
