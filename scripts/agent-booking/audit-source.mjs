import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const stateNames = ['pending_documents', 'requested', 'pending_payment', 'confirmed', 'active', 'pending', 'cancelled', 'expired', 'declined', 'completed', 'refunded'];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const lineAt = (source, index) => source.slice(0, index).split('\n').length;
const normalized = (text) => text.replace(/\s+/g, ' ').trim();
function sqlWithoutComments(source) { return source.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' ')); }
function splitArguments(text) {
  const parts = []; let depth = 0, quote = false, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") quote = !quote;
    if (!quote) { if (text[i] === '(') depth++; if (text[i] === ')') depth--; if (text[i] === ',' && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1; } }
  }
  if (text.slice(start).trim()) parts.push(text.slice(start).trim());
  return parts;
}
function signatureType(argument) {
  let text = argument.replace(/\s+(?:DEFAULT|=)[\s\S]*$/i, '').trim().replace(/^(?:IN|INOUT|VARIADIC)\s+/i, '');
  const tokens = text.split(/\s+/);
  const types = ['text','uuid','numeric','integer','int','bigint','boolean','date','jsonb','json','timestamptz','timestamp','double','real','smallint','character','varchar','record','bytea'];
  if (!types.includes(tokens[0].replace(/\[\]$/, '').toLowerCase())) text = tokens.slice(1).join(' ');
  return text.replace(/\s+/g, ' ').toLowerCase();
}
function identity(name, argumentsText, named = true) {
  return `${name.replace(/"/g, '').toLowerCase()}(${splitArguments(argumentsText).filter((argument) => !/^OUT\s/i.test(argument)).map((argument) => named ? signatureType(argument) : normalized(argument).toLowerCase()).join(',')})`;
}

export function inspectSource(file, source) {
  const sql = file.endsWith('.sql');
  const text = sql ? sqlWithoutComments(source) : source;
  const result = { writers: [], functions: [], drops: [], permissions: [], triggers: [], policies: [], dynamicAccess: [], rpcCalls: [], states: [] };
  const evidence = (match, extra = {}) => ({ file, line: lineAt(text, match.index), evidence: normalized(match[0]).slice(0, 800), sha256: hash(source), ...extra });
  if (sql) {
    const writer = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+(?:public\.)?"?(bookings|vehicle_blocked_dates)"?\b/gi;
    for (const match of text.matchAll(writer)) result.writers.push(evidence(match, { table: match[2].toLowerCase(), operation: match[1].split(/\s+/)[0].toLowerCase(), kind: 'sql-candidate' }));
    const declaration = /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w."]+)\s*\(/gi;
    for (const match of text.matchAll(declaration)) {
      const begin = match.index + match[0].length; let depth = 1, end = begin, quote = false;
      while (end < text.length && depth) { if (text[end] === "'") quote = !quote; if (!quote) { if (text[end] === '(') depth++; if (text[end] === ')') depth--; } end++; }
      const argumentsText = text.slice(begin, end - 1);
      const bodyStart = /\bAS\s+(\$[\w]*\$)/i.exec(text.slice(end));
      const nextDeclaration = text.slice(end).search(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
      if (!bodyStart || (nextDeclaration >= 0 && bodyStart.index > nextDeclaration)) {
        result.dynamicAccess.push(evidence(match, { reason: 'Function body format needs applied-schema review' })); continue;
      }
      const bodyBegin = end + bodyStart.index + bodyStart[0].length;
      const bodyEnd = text.indexOf(bodyStart[1], bodyBegin);
      const whole = text.slice(match.index, bodyEnd + bodyStart[1].length);
      result.functions.push(evidence(match, {
        name: match[1].replace(/"/g, '').toLowerCase(), identity: identity(match[1], argumentsText),
        arguments: splitArguments(argumentsText), defaults: splitArguments(argumentsText).filter((arg) => /\bDEFAULT\b|=/.test(arg)),
        securityDefiner: /SECURITY\s+DEFINER/i.test(whole),
        bodySha256: hash(whole), bodyEndLine: lineAt(text, bodyEnd),
        touchesInventory: /\b(bookings|vehicle_blocked_dates)\b/i.test(whole),
        lifecycleStates: stateNames.filter((state) => whole.includes(`'${state}'`)),
        deployment: 'unverified',
      }));
      if (/\bEXECUTE\s+(?:format\(|\w+|')/i.test(text.slice(bodyBegin, bodyEnd)) && /bookings|vehicle_blocked_dates/i.test(whole)) result.dynamicAccess.push(evidence(match, { reason: 'Dynamic SQL inside inventory-related function requires review' }));
    }
    for (const match of text.matchAll(/\bDROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?([\w."]+)\s*\(([^;]*?)\)\s*(?:CASCADE|RESTRICT)?\s*;/gi)) result.drops.push(evidence(match, { identity: identity(match[1], match[2], false) }));
    for (const match of text.matchAll(/\b(?:GRANT|REVOKE|ALTER\s+DEFAULT\s+PRIVILEGES)\b[^;]*;/gi)) result.permissions.push(evidence(match));
    for (const match of text.matchAll(/\b(?:CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER|DROP\s+TRIGGER|ALTER\s+TABLE[^;]*?(?:ENABLE|DISABLE)\s+TRIGGER)\b[^;]*;/gi)) result.triggers.push(evidence(match));
    for (const match of text.matchAll(/\b(?:CREATE|ALTER|DROP)\s+POLICY\b[^;]*;|\bALTER\s+TABLE\b[^;]*?ROW\s+LEVEL\s+SECURITY[^;]*;/gi)) result.policies.push(evidence(match));
  } else {
    for (const match of text.matchAll(/\.from\(\s*(['"])(bookings|vehicle_blocked_dates)\1\s*\)([\s\S]*?)(?=;|\.from\(|$)/g)) {
      const operation = /\.(insert|update|upsert|delete)\s*\(/.exec(match[3]);
      if (operation) result.writers.push(evidence(match, { table: match[2], operation: operation[1], kind: 'client-candidate' }));
    }
    for (const match of text.matchAll(/\.from\(\s*([^'"\s][^)]*)\)/g)) {
      const receiver = /([\w$]+)$/.exec(text.slice(0, match.index))?.[1];
      if (['Array', 'Buffer', 'Uint8Array'].includes(receiver) || /\.storage\s*$/.test(text.slice(0, match.index))) continue;
      result.dynamicAccess.push(evidence(match, { reason: 'Dynamic table access requires owner classification' }));
    }
    for (const match of text.matchAll(/\.rpc\(\s*(['"])([\w]+)\1/g)) result.rpcCalls.push(evidence(match, { name: match[2] }));
  }
  if (/bookings|rent-|vehicle_blocked_dates|marketplace_booking/.test(file + text)) {
    for (const state of stateNames) {
      const index = text.search(new RegExp(`["']${state}["']`));
      if (index >= 0) result.states.push({ state, file, line: lineAt(text, index), sha256: hash(source) });
    }
  }
  return result;
}

export function auditSource(root) {
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0')
    .filter((file) => /^(supabase\/(migrations|functions)|src|scripts\/(rls-verify|rari))\//.test(file) && /\.(sql|tsx?|m?js)$/.test(file)).sort();
  const report = { version: 1, sourceFingerprint: '', files: [], writers: [], functions: [], drops: [], permissions: [], triggers: [], policies: [], dynamicAccess: [], rpcCalls: [], states: [], finalFunctions: [], effectivePrivileges: 'unverified: requires applied schema, roles and default privileges', appliedSchema: 'not inspected', quarantine: ['supabase/migrations/20260724035422_6ac3ac4e-e8d6-413a-bae7-ae8d23b65ba5.sql'] };
  for (const file of paths) {
    const source = readFileSync(join(root, file), 'utf8');
    report.files.push({ file, sha256: hash(source) });
    const findings = inspectSource(file, source);
    for (const [key, entries] of Object.entries(findings)) report[key].push(...entries);
  }
  report.sourceFingerprint = hash(JSON.stringify(report.files));
  const final = new Map();
  const events = [...report.functions.map((entry) => ({ ...entry, action: 'create' })), ...report.drops.map((entry) => ({ ...entry, action: 'drop' }))].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  for (const event of events) { if (event.action === 'drop') final.delete(event.identity); else final.set(event.identity, event); }
  report.finalFunctions = [...final.values()].filter((entry) => entry.touchesInventory || /public_(?:vehicle|fleet|booking|team|marketplace)|is_marketplace|rent_/.test(entry.name)).sort((a, b) => a.identity.localeCompare(b.identity));
  report.states = stateNames.map((state) => ({ state, evidence: report.states.filter((entry) => entry.state === state) })).filter((entry) => entry.evidence.length);
  return report;
}

export function assertAuditMatches(expected, actual) {
  if (expected.sourceFingerprint !== actual.sourceFingerprint) throw new Error('Source fingerprint changed; review and regenerate inventory');
  for (const key of ['files', 'writers', 'functions', 'drops', 'permissions', 'triggers', 'policies', 'dynamicAccess', 'rpcCalls', 'states', 'finalFunctions']) {
    if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key])) throw new Error(`Source inventory mismatch: ${key}`);
  }
}

export function renderCapabilityAppendix(report) {
  const table = (header, rows) => `${header}\n${rows.join('\n')}\n`;
  const safe = (value) => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return '\n## Complete tracked-source writer candidates\n\n'
    + table('| Operation | Table | Exact source | Evidence |\n|---|---|---|---|', report.writers.map((row) => `| ${row.operation} | ${row.table} | ${row.file}:${row.line} | ${safe(row.evidence.slice(0, 150))} |`))
    + '\n## Final static function overloads\n\n'
    + table('| Identity | Last source definition | Definer | Default arguments | Privileges/deployment |\n|---|---|---|---|---|', report.finalFunctions.map((row) => `| ${row.identity} | ${row.file}:${row.line} | ${row.securityDefiner} | ${safe(row.defaults.join('; '))} | Applied privileges and deployment unverified; all historical ACL statements in JSON |`))
    + '\n## Dynamic table candidates requiring explicit applied-schema coverage\n\n'
    + table('| Source | Expression | Coverage disposition |\n|---|---|---|', report.dynamicAccess.map((row) => `| ${row.file}:${row.line} | ${safe(row.evidence)} | ${row.file.includes('ImportWizard') ? 'Booking INSERT/UPDATE source path; include import writes' : row.file.includes('confirm-data-deletion') ? 'Bookings DELETE exists in deletionOrder; include team deletion/cascade proof' : row.file.includes('dsr-erase') ? 'Bookings PII UPDATE via CUSTOMER_TARGETS; include preservation/authorization tests' : row.file.includes('retention-sweeper') ? 'Current ENTITY_TABLE excludes bookings/blocked dates; rerun audit on changes' : row.file.includes('dsr-export') || row.file.includes('importDuplicateCheck') ? 'Read-only source path; verify no associated side effects' : 'Owner review required'} |`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = auditSource(process.cwd());
  const [action, destination] = process.argv.slice(2);
  if (action === '--write' && destination) writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  else if (action === '--check' && destination) assertAuditMatches(JSON.parse(readFileSync(destination, 'utf8')), report);
  else console.log(JSON.stringify({ fingerprint: report.sourceFingerprint, writers: report.writers.length, overloads: report.finalFunctions.length, dynamicCandidates: report.dynamicAccess.length, privilegeEvidence: report.permissions.length, deployment: report.appliedSchema }));
}
