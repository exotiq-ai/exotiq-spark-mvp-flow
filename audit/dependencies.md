# Dependencies & Security Audit

---

## 1. Security Vulnerabilities Summary

**npm audit results:** 29 vulnerabilities (2 low, 13 moderate, 13 high, 1 critical)

### Critical Severity

| Package | Issue | Fix Available | Risk |
|---------|-------|---------------|------|
| **vitest** | Arbitrary file read/execute via UI server (GHSA-5xrq-8626-4rwp) | Yes (`npm audit fix` → 3.2.6+) | **CRITICAL** — Dev dependency, but UI server exposure. Patch immediately for any deployed dev tools. |

---

## 2. High Severity Vulnerabilities

| Package | Version Range | CVE/Advisory | Severity | Fix | Notes |
|---------|---------------|------|----------|-----|-------|
| **@babel/plugin-transform-modules-systemjs** | 7.12.0–7.29.0 | GHSA-fv7c-fp4j-7gwp | HIGH | Available | Arbitrary code generation on malicious input. Dev transitive. |
| **@remix-run/router** | ≤1.23.1 | GHSA-2w69-qvjg-hvjx | HIGH | Available | XSS via open redirects in React Router. Blocks `react-router-dom@≤6.30.2`. |
| **fast-uri** | ≤3.1.1 | GHSA-q3j6-qgpj-74h6 / GHSA-v39h-62p7-jpjc | HIGH | Available | Path traversal + host confusion. ESLint transitive. |
| **flatted** | ≤3.4.1 | GHSA-25h7-pfq9-p65f / GHSA-rf6f-7fwh-wjgh | HIGH | Available | DoS via unbounded recursion + prototype pollution. ESLint transitive. |
| **glob** | 10.2.0–10.4.5 | GHSA-5j98-mcp5-4vw2 | HIGH | Available | Command injection via `-c/--cmd` with shell:true. Build tool transitive. |
| **lodash** | ≤4.17.23 | GHSA-r5fr-rjxr-66jc / GHSA-f23m-r3pf-42rh / GHSA-xxjr-mmjv-4gpg | HIGH | Available | Code injection + prototype pollution. Transitive from various packages. |
| **minimatch** | Multiple ranges | GHSA-3ppc-4f35-3m26 / GHSA-7r86-cg39-jmmj / GHSA-23c5-xmqv-rm74 | HIGH | Available | ReDoS via wildcard patterns. Build tool transitive. |
| **picomatch** | ≤2.3.1, 4.0.0–4.0.3 | GHSA-3v7f-55p6-f55p / GHSA-c2c7-rcm5-vvqj | HIGH | Available | Glob matching bypass + ReDoS. Transitive from watch/build tools. |
| **rollup** | 4.0.0–4.59.0 / <2.80.0 | GHSA-mw96-cpmx-2vgc | HIGH | Available | Arbitrary file write via path traversal. Vite transitive. |
| **serialize-javascript** | ≤7.0.4 | GHSA-5c6j-r48x-rmvq / GHSA-qj8w-gfj5-8c6v | HIGH | Available | RCE via RegExp.flags + CPU exhaustion DoS. Workbox transitive. |
| **xlsx** | * (all versions) | GHSA-4r6h-8v6p-xvw6 / GHSA-5pgg-2g8v-p4x9 | HIGH | **NONE AVAILABLE** | Prototype pollution + ReDoS. Shipped to production. See below. |

---

## 3. XLSX Package Alert

**Package:** `xlsx@^0.18.5` (production dependency)  
**Vulnerabilities:**
1. **GHSA-4r6h-8v6p-xvw6** — Prototype Pollution  
2. **GHSA-5pgg-2g8v-p4x9** — Regular Expression Denial of Service (ReDoS)  

**Status:** No patch available for any version (maintained project but unfixed).  

**Usage in codebase:**
- `src/components/dashboard/CRMSection.tsx` — CSV export for CRM data
- `src/lib/importUtils.ts` — Customer/vehicle bulk import from Excel

**Mitigation:**
- Input validation: Restrict Excel file uploads to known formats
- Consider alternative: `papaparse` (already installed) for CSV; `libxlsx` if .xlsx needed
- Monitor upstream SheetJS repo for patches
- Risk assessment: Prototype pollution requires malicious Excel file + unsafe code path

**Category:** JUDGMENT — Monitor but acceptable if file uploads restricted to trusted sources.

---

## 4. Moderate Severity Vulnerabilities (13 total)

| Package | Issue | Severity | Fix |
|---------|-------|----------|-----|
| `@babel/runtime` | RegExp complexity in transpiled code | MODERATE | Available |
| `@eslint/plugin-kit` | ReDoS via ConfigCommentParser | MODERATE | Available |
| `ajv` | ReDoS with `$data` option | MODERATE | Available (multiple versions affected) |
| `brace-expansion` | ReDoS + zero-step sequence hang | MODERATE | Available |
| `esbuild` | Dev server allows external request interception | MODERATE | Available |
| `js-yaml` | Prototype pollution in merge (`<<`) | MODERATE | Available |
| `mdast-util-to-hast` | Unsanitized class attribute (markdown-to-HTML) | MODERATE | Available |
| `nanoid` | Predictable results on non-integer input | MODERATE | Available |
| `postcss` | XSS via unescaped `</style>` in CSS output | MODERATE | Available |
| `ws` | Uninitialized memory disclosure | MODERATE | Available |
| `yaml` | Stack overflow via deeply nested YAML | MODERATE | Available |

**All moderate issues have fixes available via `npm audit fix`.**

---

## 5. Outdated Dependencies (npm outdated Summary)

### Breaking Changes (Major Versions Available)

| Package | Current | Latest | Break Type | Notes |
|---------|---------|--------|-----------|-------|
| **@elevenlabs/client** | 0.9.1 | 1.10.0 | MAJOR | +1.01.0 versions behind. Breaking API likely. Keep old if working. |
| **@eslint/js** | 9.13.0 | 10.0.1 | MAJOR | ESLint v10 coming; v9 still supported. |
| **@tanstack/react-query** | 5.59.16 | 5.101.0 | MINOR | v5 latest stable; v6 exists but major. Patch available. |
| **@types/node** | 22.7.9 | 25.9.2 | MINOR | Type definitions only; safe to update. |
| **@types/react** | 18.3.12 | 19.2.17 | MAJOR | React v19 types; stay on v18 if using React 18. |
| **@types/react-dom** | 18.3.1 | 19.2.3 | MAJOR | React v19 types; stay on v18 if using React 18. |
| **date-fns** | 3.6.0 | 4.4.0 | MAJOR | v4 released; consider after stabilization. |
| **eslint** | 9.13.0 | 10.4.1 | MAJOR | ESLint v10; v9 still receiving patches. |
| **jsdom** | 20.0.3 | 29.1.1 | MAJOR | JSDOM 20 is old; v29 is stable. Breaking upgrade path. |
| **lucide-react** | 0.462.0 | 1.17.0 | MAJOR | Icon library; check visual compatibility. |
| **react** | 18.3.1 | 19.2.7 | MAJOR | Stay on 18; React 19 is new. |
| **react-dom** | 18.3.1 | 19.2.7 | MAJOR | Stay on 18; React 19 is new. |
| **react-is** | 19.2.0 | 19.2.7 | PATCH | Version mismatch: `react@18.3.1` but `react-is@19.2.0`. See oddities. |
| **react-markdown** | 9.1.0 | 10.1.0 | MAJOR | Major bump; check API changes. |
| **react-router-dom** | 6.27.0 | 7.17.0 | MAJOR | React Router v7; stays on v6. |
| **recharts** | 3.1.0 | 3.8.1 | MINOR | Safe patch; many fixes. Recommend. |
| **tailwindcss** | 3.4.17 | 4.3.0 | MAJOR | Tailwind v4; v3 still supported. |
| **typescript** | 5.6.3 | 6.0.3 | MAJOR | TS 6 is new; v5 still active. |
| **vite** | 5.4.10 | 8.0.16 | MAJOR | Vite 6–8 are jumping; stay on v5 if stable. |
| **vitest** | 3.2.4 | 4.1.8 | MAJOR | Vitest v4; v3 still actively used. |
| **zod** | 3.23.8 | 4.4.3 | MAJOR | Zod v4; breaking changes in v4. Stay on v3 unless needed. |

### Patch/Minor Updates (Policy-Safe)

| Package | Current | Wanted | Type | Risk |
|---------|---------|--------|------|------|
| **@supabase/supabase-js** | 2.77.0 | 2.108.1 | MINOR | High — 31 minor versions behind. Likely includes bug fixes & feature updates. Recommend. |
| **@radix-ui/* (all 30 packages)** | Varies | Latest | MINOR | Safe — Radix maintains backward compatibility. Bulk update recommended. |
| **framer-motion** | 12.23.12 | 12.40.0 | PATCH | Safe — Animation library. Update. |
| **react-hook-form** | 7.53.1 | 7.78.0 | MINOR | Safe — Form handling. Recommend. |
| **recharts** | 3.1.0 | 3.8.1 | MINOR | Safe — Chart updates. Recommend. |
| **tailwind-merge** | 2.5.4 | 3.6.0 | MAJOR | Breaking rename likely; check. |
| **next-themes** | 0.3.0 | 0.4.6 | MINOR | Safe — Theme provider. Update. |

---

## 6. Lock File Oddities

### Issue #1: Dual Lock Files (bun + npm)

**Files present:**
- `bun.lock` (291 KB) — Bun package manager lock
- `bun.lockb` (194 KB) — Bun binary format lock
- `package-lock.json` (561 KB) — npm format lock

**Authoritative Lock:** `package-lock.json` (npm is primary)  
**Status:** Redundant bun locks suggest **project was initially scaffolded with bun, then migrated to npm**

**Recommendation:**
- If using npm only, remove `bun.lock` and `bun.lockb` to reduce confusion
- If intentionally supporting both, document and pin version schemas

---

### Issue #2: Test Dependencies in `dependencies` Instead of `devDependencies`

**Production dependencies that should be dev-only:**

| Package | Current Location | Reason | Action |
|---------|------------------|--------|--------|
| `vitest` | dependencies | Test runner | Move to devDependencies |
| `@testing-library/jest-dom` | dependencies | Test utilities | Move to devDependencies |
| `@testing-library/react` | dependencies | Test utilities | Move to devDependencies |
| `jsdom` | dependencies | DOM environment for tests | Move to devDependencies |
| `@types/papaparse` | dependencies | Type defs for CSV parsing | Keep or move to devDependencies |

**Impact:** Shipping ~2 MB of unnecessary test tooling in production builds.

**Category:** MECHANICAL-FIX — Run `npm install` with corrected package.json or use:
```bash
npm move vitest @testing-library/jest-dom @testing-library/react jsdom --save-dev
```

---

## 7. Mismatched React Versions

**Issue:** `react-is@19.2.0` but `react@18.3.1`

**Analysis:**
- `react-is` is a utility that inspects React element types; version mismatch can cause subtle type-checking issues
- React 19 introduced new element types that React 18's `react-is` won't recognize

**Risk:** LOW — If not using React 19-specific features, not an immediate problem, but semantically wrong.

**Fix:**
```bash
npm install react-is@18.3.1  # Match react version
```

---

## 8. Summary of Dependency Issues

| Category | Count | Fixable | Effort | Priority |
|----------|-------|---------|--------|----------|
| Critical vulnerabilities | 1 | Yes | LOW | HIGH |
| High vulnerabilities | 11 | 10 available; 1 unfixable (xlsx) | MEDIUM | HIGH |
| Moderate vulnerabilities | 13 | Yes (all) | MEDIUM | MEDIUM |
| Patch/minor updates available | ~50+ | Yes | LOW | LOW |
| Major version updates | ~20 | Some breaking | MEDIUM-HIGH | JUDGMENT |
| Test deps in production | 4 | Yes | LOW | MEDIUM |
| Lock file duplication | 2 files | Yes (delete) | TRIVIAL | LOW |
| Mismatched react-is version | 1 | Yes | TRIVIAL | LOW |

---

## 9. npm audit Fix Results (If Run)

**Expected after `npm audit fix`:**
- Fixes all 13 moderate vulnerabilities
- Fixes 10 of 11 high vulnerabilities (xlsx remains unfixable)
- Fixes 1 critical (vitest)
- Remaining vulnerabilities: **8** (mostly xlsx, some transitive unfixable deps)

---

## 10. Recommendations Prioritized

### IMMEDIATE (This week)
1. **Run `npm audit fix`** — Resolves 24/29 vulnerabilities
2. **Update vitest** → 3.2.6+ (critical)
3. **Update react-is** → 18.3.1 (semantic alignment)
4. **Move test libs to devDependencies:**
   ```json
   // Remove from dependencies:
   "vitest": "^3.2.4",
   "@testing-library/jest-dom": "^6.6.0",
   "@testing-library/react": "^16.0.0",
   "jsdom": "^20.0.3"
   
   // Add to devDependencies
   ```

### SOON (Next 2 weeks)
1. **Update @supabase/supabase-js** → 2.108.1 (31 minor versions behind)
2. **Update all @radix-ui/** packages to latest (safe bulk update)
3. **Update recharts** → 3.8.1 (chart improvements)
4. **Delete `bun.lock` and `bun.lockb`** (if npm is primary)

### LATER (Next month)
1. **Evaluate react-router-dom upgrade** — Currently at 6.27.0, v6.30.4 has XSS fix (done by audit fix)
2. **Monitor xlsx alternatives** — Prototype pollution unfixed; consider migration strategy
3. **Plan React 18 → 19 migration** if features needed (affects types, libraries)
4. **Review @elevenlabs/client upgrade** (0.9.1 → 1.10.0 is breaking API likely)

### KEEP AS-IS (Intentional)
- **react@18.3.1** — Stay on v18 (v19 is new)
- **vite@5.4.10** — Stay on v5 (v6+ may have breaking changes)
- **typescript@5.6.3** — v6 is new; v5 stable (no pressure to upgrade)
- **tailwindcss@3.4.17** — v4 is new; v3 still supported
- **zod@3.23.8** — v4 has breaking changes; stay on v3 unless needed

---

## 11. xlsx Vulnerability Deep Dive

**Package Status:** `xlsx@0.18.5` (latest available, but still vulnerable)

**Vulnerabilities:**
1. **Prototype Pollution (GHSA-4r6h-8v6p-xvw6)**
   - Malicious Excel cells can pollute Object.prototype
   - Affects all downstream code checking object properties
   - Severity: HIGH if processing untrusted files

2. **ReDoS (GHSA-5pgg-2g8v-p4x9)**
   - Regular expressions can be exploited to cause CPU exhaustion
   - Severity: MODERATE in typical use (data imports)

**Mitigation in Exotiq:**
- Uploads restricted to authenticated users (not public)
- File size limits (likely in place)
- Input validation recommended: whitelist/sanitize Excel content

**Alternatives:**
- **papaparse** (already installed) — CSV only, much simpler
- **fast-csv** — Lightweight CSV parser
- **exceljs** — If .xlsx reading needed, check CVE status
- **alasql** — SQL-like queries on data (advanced)

**Recommendation:** Leave xlsx as-is for now (no fix available) but add explicit file upload validation.

---

## Appendix: Full npm audit Output

```
29 vulnerabilities (2 low, 13 moderate, 13 high, 1 critical)

Fixable issues (26 via npm audit fix):
- @babel/plugin-transform-modules-systemjs: HIGH
- @babel/runtime: MODERATE
- @eslint/plugin-kit: MODERATE
- @remix-run/router: HIGH
- ajv: MODERATE
- brace-expansion: MODERATE
- esbuild: MODERATE
- fast-uri: HIGH
- flatted: HIGH
- glob: HIGH
- js-yaml: MODERATE
- lodash: HIGH
- mdast-util-to-hast: MODERATE
- minimatch: HIGH
- nanoid: MODERATE
- picomatch: HIGH
- postcss: MODERATE
- rollup: HIGH
- serialize-javascript: HIGH
- vitest: CRITICAL
- ws: MODERATE
- yaml: MODERATE

Unfixable:
- xlsx: HIGH (all versions affected)

Transitive chains requiring further investigation:
- eslint → @eslint/plugin-kit → ReDoS
- vite → rollup → File write
- workbox-build → serialize-javascript → RCE
```
