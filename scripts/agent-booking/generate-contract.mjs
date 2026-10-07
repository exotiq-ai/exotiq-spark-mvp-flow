import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

// No build or dependency installation: transpile only the transport-independent
// canonical module. JSON is a YAML 1.2 subset, avoiding another serializer.
const source = readFileSync('supabase/functions/_shared/external-booking/contracts.ts', 'utf8');
const emitted = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { generateOpenApi, validateContract, schemas } = await import(`data:text/javascript;base64,${Buffer.from(emitted).toString('base64')}`);
const api = generateOpenApi();
const examples = JSON.parse(readFileSync('docs/external-booking/examples.json','utf8'));
for (const example of examples) {
 if (!Object.hasOwn(schemas,example.contract) || !validateContract(example.contract,example.value).ok) throw Error('Invalid documented example: '+example.contract);
}
const digest = text => createHash('sha256').update(text).digest('hex');
const outputs = {
 'docs/external-booking/openapi.yaml': JSON.stringify(api,null,2)+'\n',
 'docs/external-booking/contract-manifest.json': JSON.stringify({api_version:'v1',canonical_source:'supabase/functions/_shared/external-booking/contracts.ts',source_sha256:digest(source),examples_sha256:digest(JSON.stringify(examples)),operations:Object.fromEntries(Object.entries(api.paths).map(([path,methods])=>[path,Object.fromEntries(Object.entries(methods).map(([method,operation])=>[method,operation.operationId]))])),provider_acceptance:'unverified'},null,2)+'\n',
};
for (const [destination,generated] of Object.entries(outputs)) {
 if (process.argv.includes('--check')) { if (readFileSync(destination,'utf8')!==generated) throw Error('Contract artifact drift: '+destination); }
 else writeFileSync(destination,generated);
}
console.log(process.argv.includes('--check')?'Canonical contract, examples and provenance verified':'Generated contract and provenance');
