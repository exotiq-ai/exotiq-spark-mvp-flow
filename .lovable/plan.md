## Plan: Tighten `identity_verifications` grants to exact intent

Ship a single additive migration that trims the table-level privileges on `public.identity_verifications` to match the stated policy: anon has nothing, authenticated has read-only, service_role keeps everything.

### Migration SQL

```sql
REVOKE ALL ON public.identity_verifications FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.identity_verifications FROM authenticated;
-- authenticated retains SELECT (granted in prior migration)
-- service_role retains ALL
```

### Verification (post-apply)

1. **relacl inspection** — `SELECT relacl FROM pg_class WHERE relname='identity_verifications'` should show `anon` absent, `authenticated=r/postgres` (SELECT only), `service_role=arwdDxtm/postgres`.
2. **Anon PostgREST SELECT** — curl with anon key. Expected: RLS-filtered empty result or explicit denial; combined with no table-level privilege, no rows leak.
3. **Authenticated SELECT** — with a real team-member JWT (or by asserting the SELECT policy + grant are both present), confirm rows for their team's customers are returned.
4. **Authenticated INSERT/UPDATE** — attempt via PostgREST with a team-member JWT. Expected: `permission denied for table identity_verifications` (privilege layer), not "0 rows affected".

### Reporting

Drift-report style: Applied ✅ / Failed ❌, each verification check with actual result, linter delta vs. current 188-finding baseline. No frontend changes. No edge function changes.
