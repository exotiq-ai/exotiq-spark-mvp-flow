import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { auditSource, assertAuditMatches, inspectSource } from '../../scripts/agent-booking/audit-source.mjs';

describe('capability provenance', () => {
  it('includes inventory trigger functions that modify OLD/NEW without naming the table in their body', () => {
    const actual = auditSource(process.cwd());
    expect(actual.finalFunctions.map((entry) => entry.identity)).toEqual(expect.arrayContaining([
      'public.external_preserve_financial_hold()',
      'public.external_checkout_reservation_immutable()',
    ]));
  });
  it('captures direct/operator insert, blocked-date edit, SQL writer, overload and grants', () => {
    const inspected = inspectSource('supabase/migrations/test.sql', `
      CREATE FUNCTION public.create_marketplace_booking(_id uuid, _note text DEFAULT NULL)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO public.bookings(id) VALUES (_id); END; $$;
      GRANT EXECUTE ON FUNCTION public.create_marketplace_booking(uuid,text) TO service_role;
      REVOKE ALL ON FUNCTION public.create_marketplace_booking(uuid,text) FROM PUBLIC;
      CREATE TRIGGER ensure_booking BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.ensure_booking();
    `);
    expect(inspected.functions[0].identity).toBe('public.create_marketplace_booking(uuid,text)');
    expect(inspected.functions[0].defaults).toContain('_note text DEFAULT NULL');
    expect(inspected.writers[0]).toMatchObject({ table: 'bookings', operation: 'insert' });
    expect(inspected.permissions).toHaveLength(2);
    expect(inspected.triggers).toHaveLength(1);
    const js = inspectSource('src/contexts/operator.ts', `db.from('bookings').insert(input); db.from('vehicle_blocked_dates').delete().eq('id', id); db.from(table).update(input);`);
    expect(js.writers.map((item) => item.table)).toEqual(['bookings', 'vehicle_blocked_dates']);
    expect(js.dynamicAccess).toHaveLength(1);
  });
  it('detects omitted writer and changed source content independently of HEAD', () => {
    const source = auditSource(process.cwd());
    expect(() => assertAuditMatches({ ...source, writers: source.writers.slice(1) }, source)).toThrow(/writers/);
    expect(() => assertAuditMatches({ ...source, sourceFingerprint: 'changed' }, source)).toThrow(/fingerprint/i);
  });
  it('requires the checked-in inventory to match all current tracked source candidates', () => {
    const expected = JSON.parse(readFileSync('docs/external-booking/source-audit.json', 'utf8'));
    const actual = auditSource(process.cwd());
    expect(() => assertAuditMatches(expected, actual)).not.toThrow();
    expect(actual.writers.some((entry) => entry.file === 'src/contexts/FleetContext.tsx' && entry.operation === 'insert')).toBe(true);
    expect(actual.writers.some((entry) => entry.file === 'src/hooks/useVehicleBlockedDates.ts')).toBe(true);
    const latest = actual.finalFunctions.find((entry) => entry.identity.startsWith('public.create_marketplace_booking(') && entry.arguments.length === 18);
    expect(latest?.file).toContain('20260819031937');
    expect(latest?.deployment).toBe('unverified');
    expect(actual.effectivePrivileges).toBe('unverified: requires applied schema, roles and default privileges');
    expect(actual.states.map((entry) => entry.state)).toEqual(expect.arrayContaining(['pending_documents', 'requested', 'pending_payment', 'confirmed', 'active', 'pending', 'cancelled', 'expired']));
  });
});
