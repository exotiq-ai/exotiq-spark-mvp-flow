#!/usr/bin/env node
// Codemod: shadcn useToast → sonner toast
// Run: node scripts/migrate-toast.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const FILES = execSync(
  `rg -l "from ['\\"]@/hooks/use-toast['\\"]|from ['\\"]@/components/ui/use-toast['\\"]" src`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

// Skip the lib files themselves — they'll be deleted later
const SKIP = new Set(['src/components/ui/use-toast.ts', 'src/hooks/use-toast.ts', 'src/components/ui/toaster.tsx']);

// Find the matching closing brace for a `{` at index `start` (which points AT the `{`).
function findMatchingBrace(s, start) {
  let depth = 0;
  let inStr = null; // '"' | "'" | '`'
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === inStr) inStr = null;
      // template literal: handle ${...}
      if (inStr === '`' && c === '$' && s[i+1] === '{') {
        // skip into expression
        let d = 1; i += 2;
        while (i < s.length && d > 0) {
          if (s[i] === '{') d++;
          else if (s[i] === '}') d--;
          i++;
        }
        i--;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '/' && s[i+1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i+1] === '*') { i += 2; while (i < s.length - 1 && !(s[i] === '*' && s[i+1] === '/')) i++; i++; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// Split top-level object-literal entries by commas (ignoring nested braces/strings).
function splitProps(body) {
  const parts = [];
  let depth = 0, inStr = null, escaped = false, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  const tail = body.slice(start);
  if (tail.trim()) parts.push(tail);
  return parts;
}

// Parse `key: value` (key can be ident or string literal). Returns null if not parseable.
function parseProp(part) {
  const trimmed = part.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))\s*:\s*([\s\S]+)$/);
  if (!m) return { raw: trimmed }; // shorthand or spread — keep as-is
  return { key: m[1] || m[2], value: m[3].trim(), raw: trimmed };
}

function transformToastCall(source) {
  // Match `toast(` not preceded by `.` (so we don't touch `toast.error(`)
  const re = /(^|[^.\w])toast\s*\(\s*\{/g;
  let out = '';
  let lastIdx = 0;
  let m;
  while ((m = re.exec(source)) !== null) {
    const braceIdx = m.index + m[0].length - 1; // position of `{`
    const closeIdx = findMatchingBrace(source, braceIdx);
    if (closeIdx === -1) continue;
    // Find the `)` after the closing brace (skip whitespace + optional trailing comma)
    let parenIdx = closeIdx + 1;
    while (parenIdx < source.length && /\s/.test(source[parenIdx])) parenIdx++;
    if (source[parenIdx] !== ')') continue;

    const propsBody = source.slice(braceIdx + 1, closeIdx);
    const props = splitProps(propsBody).map(parseProp).filter(Boolean);

    const titleProp = props.find(p => p.key === 'title');
    const descProp = props.find(p => p.key === 'description');
    const variantProp = props.find(p => p.key === 'variant');
    const actionProp = props.find(p => p.key === 'action');
    const otherProps = props.filter(p =>
      !['title','description','variant','action'].includes(p.key) && p.raw
    );

    const isError = variantProp && /["']destructive["']/.test(variantProp.value);
    const fn = isError ? 'toast.error' : 'toast';

    let titleArg = titleProp ? titleProp.value : '""';
    const optsEntries = [];
    if (descProp) optsEntries.push(`description: ${descProp.value}`);
    if (actionProp) optsEntries.push(actionProp.raw); // keep as-is, may need manual review
    for (const p of otherProps) optsEntries.push(p.raw);

    const optsStr = optsEntries.length ? `, { ${optsEntries.join(', ')} }` : '';
    const replacement = `${m[1]}${fn}(${titleArg}${optsStr})`;

    out += source.slice(lastIdx, m.index) + replacement;
    lastIdx = parenIdx + 1;
    re.lastIndex = parenIdx + 1;
  }
  out += source.slice(lastIdx);
  return out;
}

let changed = 0;
let actionFlagged = [];

for (const file of FILES) {
  if (SKIP.has(file)) continue;
  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  // 1. Rewrite import
  src = src.replace(
    /import\s*\{\s*useToast\s*\}\s*from\s*['"]@\/hooks\/use-toast['"]\s*;?/g,
    `import { toast } from "sonner";`
  );
  src = src.replace(
    /import\s*\{\s*useToast\s*\}\s*from\s*['"]@\/components\/ui\/use-toast['"]\s*;?/g,
    `import { toast } from "sonner";`
  );

  // 2. Remove `const { toast } = useToast();` (with optional surrounding whitespace/newline)
  src = src.replace(/^\s*const\s*\{\s*toast\s*\}\s*=\s*useToast\(\)\s*;?\s*$\n?/gm, '');

  // 3. Transform toast({...}) calls
  src = transformToastCall(src);

  // 4. Flag remaining ToastAction usages
  if (/ToastAction/.test(src)) actionFlagged.push(file);

  if (src !== before) {
    fs.writeFileSync(file, src);
    changed++;
    console.log(`✓ ${file}`);
  }
}

console.log(`\nTransformed ${changed}/${FILES.length} files`);
if (actionFlagged.length) {
  console.log(`\n⚠ Files using <ToastAction> — handle manually:`);
  actionFlagged.forEach(f => console.log(`  - ${f}`));
}
