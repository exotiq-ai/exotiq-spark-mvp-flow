import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

// No build or dependency installation: transpile only the transport-independent
// canonical module. JSON is a YAML 1.2 subset, avoiding another serializer.
const source = readFileSync('supabase/functions/_shared/external-booking/contracts.ts', 'utf8');
const emitted = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { generateOpenApi } = await import(`data:text/javascript;base64,${Buffer.from(emitted).toString('base64')}`);
const generated = JSON.stringify(generateOpenApi(), null, 2) + '\n';
const destination = 'docs/external-booking/openapi.yaml';
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== generated) throw new Error('OpenAPI drift: run node scripts/agent-booking/generate-contract.mjs');
  console.log('Canonical OpenAPI parity verified');
} else {
  writeFileSync(destination, generated);
  console.log(`Generated ${destination}`);
}
