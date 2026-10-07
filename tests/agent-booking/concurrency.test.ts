import { describe, it, expect, beforeAll } from 'vitest';
import { inventorySql, testTeam, vehicle, bookingInsert } from './helpers/inventory-sql.ts';

describe('shared inventory guard on actual isolated PostgreSQL', () => {
  let sql: ReturnType<typeof inventorySql>;
  beforeAll(async () => {
    sql = inventorySql();
    const ids=Array.from({length:29},(_,i)=>`'${vehicle(i+1)}'`).join(',');
    expect((await sql(`DELETE FROM public.vehicle_blocked_dates WHERE team_id='${testTeam}' AND vehicle_id IN(${ids}); DELETE FROM public.bookings WHERE team_id='${testTeam}' AND vehicle_id IN(${ids});`)).ok).toBe(true);
    expect((await sql(`INSERT INTO public.teams(id,name,owner_id,slug,marketplace_visible,marketplace_request_status) VALUES('${testTeam}','agent-test-inventory','${testTeam}','agent-test-inventory',true,'approved') ON CONFLICT DO NOTHING;
      INSERT INTO public.vehicles(id,team_id,name,slug,marketplace_visible) SELECT ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'${testTeam}','agent-test-inventory','agent-test-'||i,true FROM generate_series(1,29) i ON CONFLICT DO NOTHING;`)).ok).toBe(true);
  });
  it('accepts exactly one of 20 concurrent mixed-source overlaps', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => sql(`BEGIN; ${bookingInsert(vehicle(1), '2030-01-01 10:00Z', '2030-01-02 10:00Z', ['marketplace','direct','operator','import'][i % 4])} SELECT pg_sleep(0.05); COMMIT;`)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => /40001|23P01/.test(r.error))).toBe(true);
    expect((await sql(`SELECT count(*) FROM public.bookings WHERE vehicle_id='${vehicle(1)}';`)).output).toMatch(/\n1$/);
  }, 30000);
  it('rechecks fresh trigger snapshots when the INSERT command starts before another commits', async () => {
    const a = sql(`BEGIN; ${bookingInsert(vehicle(2),'2030-01-01 10:00Z','2030-01-02 10:00Z')} SELECT pg_sleep(0.2); COMMIT;`);
    // The INSERT command snapshot predates a's commit. Its SELECT delays trigger
    // execution inside that SAME command, rather than starting a later command.
    const delayed=bookingInsert(vehicle(2),'2030-01-01 10:00Z','2030-01-02 10:00Z','import').replace('VALUES(','SELECT ').replace(');',' FROM (SELECT pg_sleep(0.5)) delay;');
    const b = sql(`BEGIN; ${delayed} COMMIT;`);
    const results = await Promise.all([a,b]); expect(results[0].ok).toBe(true); expect(results[1].error).toMatch(/23P01/);
  });
  it('rejects snapshot isolation rather than silently permitting a phantom', async () => {
    const result = await sql(`BEGIN ISOLATION LEVEL REPEATABLE READ; ${bookingInsert(vehicle(3),'2030-01-01 10:00Z','2030-01-02 10:00Z')} COMMIT;`);
    expect(result.ok).toBe(false); expect(result.error).toMatch(/40001/);
  });
  it('guards blocked-date UPDATE and reservation UPDATE in both directions', async () => {
    expect((await sql(`${bookingInsert(vehicle(4),'2030-01-01 10:00Z','2030-01-02 10:00Z')}
      INSERT INTO public.vehicle_blocked_dates(team_id,vehicle_id,start_date,end_date) VALUES('${testTeam}','${vehicle(4)}','2030-01-03 10:00Z','2030-01-04 10:00Z');`)).ok).toBe(true);
    const blocked = await sql(`UPDATE public.vehicle_blocked_dates SET start_date='2030-01-01 12:00Z' WHERE vehicle_id='${vehicle(4)}';`);
    expect(blocked.error).toMatch(/23P01/);
    const booking = await sql(`UPDATE public.bookings SET start_date='2030-01-03 12:00Z',end_date='2030-01-04 12:00Z' WHERE vehicle_id='${vehicle(4)}';`);
    expect(booking.error).toMatch(/23P01/);
  });
  it('serializes a blocked insert against an in-flight reservation', async () => {
    const results = await Promise.all([
      sql(`BEGIN; ${bookingInsert(vehicle(5),'2030-01-01 10:00Z','2030-01-02 10:00Z')} SELECT pg_sleep(0.2); COMMIT;`),
      sql(`BEGIN; INSERT INTO public.vehicle_blocked_dates(team_id,vehicle_id,start_date,end_date) VALUES('${testTeam}','${vehicle(5)}','2030-01-01 10:00Z','2030-01-02 10:00Z'); SELECT pg_sleep(0.2); COMMIT;`),
    ]); expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
  it('rejects vehicle moves into occupied inventory and locks DELETE until commit', async () => {
    expect((await sql(`${bookingInsert(vehicle(6),'2030-01-01 10:00Z','2030-01-02 10:00Z')}${bookingInsert(vehicle(7),'2030-01-01 10:00Z','2030-01-02 10:00Z')}`)).ok).toBe(true);
    expect((await sql(`UPDATE public.bookings SET vehicle_id='${vehicle(7)}' WHERE vehicle_id='${vehicle(6)}';`)).error).toMatch(/23P01/);
    const removing = sql(`BEGIN; DELETE FROM public.bookings WHERE vehicle_id='${vehicle(6)}'; SELECT pg_sleep(0.5); COMMIT;`);
    const attempt = sql(`SELECT pg_sleep(0.1); ${bookingInsert(vehicle(6),'2030-01-01 10:00Z','2030-01-02 10:00Z')}`);
    const results = await Promise.all([removing,attempt]); expect(results[0].ok).toBe(true); expect(results[1].error).toMatch(/40001/);
    expect((await sql(bookingInsert(vehicle(6),'2030-01-01 10:00Z','2030-01-02 10:00Z'))).ok).toBe(true);
  });
  it('covers every blocking state including imported historical flags', async () => {
    for (const [i,status] of ['requested','pending_documents','pending_payment','pending','confirmed','active'].entries()) {
      expect((await sql(bookingInsert(vehicle(10+i),'2030-01-01 10:00Z','2030-01-02 10:00Z','import',status))).ok).toBe(true);
      expect((await sql(`UPDATE public.bookings SET is_historical=true WHERE vehicle_id='${vehicle(10+i)}';`)).ok).toBe(true);
      expect((await sql(bookingInsert(vehicle(10+i),'2030-01-01 10:00Z','2030-01-02 10:00Z'))).error).toMatch(/23P01/);
    }
  });
  it('does not expose safety-definer helpers to public roles', async () => {
    const result = await sql(`SELECT bool_and(NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('agent_inventory_lock','agent_inventory_booking_guard','agent_inventory_blocked_guard');`);
    expect(result.output).toMatch(/\nt$/);
  });
  it('rolls back an entire multi-row INSERT and repeated same-transaction overlaps', async () => {
    const insert = bookingInsert(vehicle(18),'2030-01-01 10:00Z','2030-01-02 10:00Z');
    const result = await sql(`BEGIN; ${insert} ${insert} COMMIT;`);
    expect(result.error).toMatch(/23P01/);
    expect((await sql(`SELECT count(*) FROM public.bookings WHERE vehicle_id='${vehicle(18)}';`)).output).toMatch(/\n0$/);
    const many = await sql(`INSERT INTO public.bookings(vehicle_id,team_id,customer_name,pickup_location,daily_rate,total_value,start_date,end_date,status,booking_source)
      SELECT '${vehicle(19)}','${testTeam}','agent-test-inventory','synthetic',100,100,'2030-01-01 10:00Z'::timestamptz,'2030-01-02 10:00Z'::timestamptz,'requested','import' FROM generate_series(1,2);`);
    expect(many.error).toMatch(/23P01/);
    expect((await sql(`SELECT count(*) FROM public.bookings WHERE vehicle_id='${vehicle(19)}';`)).output).toMatch(/\n0$/);
  });
  it('rejects competing updates without a row-lock/advisory-lock cycle', async () => {
    expect((await sql(`${bookingInsert(vehicle(20),'2030-01-01 10:00Z','2030-01-02 10:00Z')}${bookingInsert(vehicle(20),'2030-01-03 10:00Z','2030-01-04 10:00Z')}`)).ok).toBe(true);
    const results = await Promise.all([
      sql(`BEGIN; UPDATE public.bookings SET status='cancelled' WHERE vehicle_id='${vehicle(20)}' AND start_date='2030-01-01 10:00Z'; SELECT pg_sleep(0.3); UPDATE public.bookings SET status='cancelled' WHERE vehicle_id='${vehicle(20)}' AND start_date='2030-01-03 10:00Z'; COMMIT;`),
      sql(`BEGIN; SELECT pg_sleep(0.1); UPDATE public.bookings SET start_date='2030-01-03 11:00Z' WHERE vehicle_id='${vehicle(20)}' AND start_date='2030-01-03 10:00Z'; COMMIT;`),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)?.error).toMatch(/40001/);
    expect(results.some((r) => /40P01|57014/.test(r.error))).toBe(false);
  });
  it('allows payment metadata while an unrelated reservation holds the vehicle lock',async()=>{
    expect((await sql(bookingInsert(vehicle(29),'2030-01-01 10:00Z','2030-01-02 10:00Z'))).ok).toBe(true);
    const holder=sql(`BEGIN; ${bookingInsert(vehicle(29),'2030-01-03 10:00Z','2030-01-04 10:00Z')} SELECT pg_sleep(0.4); COMMIT;`);
    const metadata=sql(`SELECT pg_sleep(0.1); UPDATE public.bookings SET customer_phone='+15550000123' WHERE vehicle_id='${vehicle(29)}' AND start_date='2030-01-01 10:00Z';`);
    const results=await Promise.all([holder,metadata]);
    expect(results[0].ok).toBe(true); expect(results[1].ok).toBe(true);
  });
  it('checks final intervals and buffer after a later BEFORE trigger rewrites input',async()=>{
    expect((await sql(bookingInsert(vehicle(21),'2030-01-01 10:00Z','2030-01-02 10:00Z'))).ok).toBe(true);
    const late=await sql(`BEGIN;
      CREATE FUNCTION public.agent_test_late() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.start_date='2030-01-01 10:00Z'; NEW.end_date='2030-01-02 10:00Z'; RETURN NEW; END $$;
      CREATE TRIGGER b_agent_test_late BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.agent_test_late();
      ${bookingInsert(vehicle(21),'2030-01-03 10:00Z','2030-01-04 10:00Z')} COMMIT;`);
    expect(late.error).toMatch(/23P01/);
    const buffer=await sql(`BEGIN;
      CREATE FUNCTION public.agent_test_late() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.inventory_buffer_minutes=0; RETURN NEW; END $$;
      CREATE TRIGGER b_agent_test_late BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.agent_test_late();
      ${bookingInsert(vehicle(22),'2030-01-03 10:00Z','2030-01-04 10:00Z')} COMMIT;`);
    expect(buffer.error).toMatch(/22023/);
  });
  it('serializes blocked UPDATE with booking creation and validates blocked vehicle moves',async()=>{
    expect((await sql(`INSERT INTO public.vehicle_blocked_dates(team_id,vehicle_id,start_date,end_date) VALUES('${testTeam}','${vehicle(23)}','2030-01-03 10:00Z','2030-01-04 10:00Z');`)).ok).toBe(true);
    const results=await Promise.all([
      sql(`BEGIN; UPDATE public.vehicle_blocked_dates SET start_date='2030-01-01 10:00Z',end_date='2030-01-02 10:00Z' WHERE vehicle_id='${vehicle(23)}'; SELECT pg_sleep(0.3); COMMIT;`),
      sql(`BEGIN; ${bookingInsert(vehicle(23),'2030-01-01 10:00Z','2030-01-02 10:00Z')} SELECT pg_sleep(0.3); COMMIT;`),
    ]);
    expect(results.filter((r)=>r.ok)).toHaveLength(1); expect(results.find((r)=>!r.ok)?.error).toMatch(/40001|23P01/);
    expect((await sql(`${bookingInsert(vehicle(24),'2030-01-01 10:00Z','2030-01-02 10:00Z')}
      INSERT INTO public.vehicle_blocked_dates(team_id,vehicle_id,start_date,end_date) VALUES('${testTeam}','${vehicle(25)}','2030-01-01 10:00Z','2030-01-02 10:00Z');`)).ok).toBe(true);
    expect((await sql(`UPDATE public.vehicle_blocked_dates SET vehicle_id='${vehicle(24)}' WHERE vehicle_id='${vehicle(25)}';`)).error).toMatch(/23P01/);
  });
  it('locks blocked DELETE and both old/new vehicle keys during reservation moves',async()=>{
    expect((await sql(`INSERT INTO public.vehicle_blocked_dates(team_id,vehicle_id,start_date,end_date) VALUES('${testTeam}','${vehicle(26)}','2030-01-01 10:00Z','2030-01-02 10:00Z');`)).ok).toBe(true);
    const deleting=sql(`BEGIN; DELETE FROM public.vehicle_blocked_dates WHERE vehicle_id='${vehicle(26)}'; SELECT pg_sleep(0.4); COMMIT;`);
    const insertion=sql(`SELECT pg_sleep(0.1); ${bookingInsert(vehicle(26),'2030-01-01 10:00Z','2030-01-02 10:00Z')}`);
    const results=await Promise.all([deleting,insertion]);expect(results[0].ok).toBe(true);expect(results[1].error).toMatch(/40001/);
    expect((await sql(bookingInsert(vehicle(27),'2030-01-01 10:00Z','2030-01-02 10:00Z'))).ok).toBe(true);
    const moving=sql(`BEGIN; UPDATE public.bookings SET vehicle_id='${vehicle(28)}' WHERE vehicle_id='${vehicle(27)}'; SELECT pg_sleep(0.4); COMMIT;`);
    const oldAttempt=sql(`SELECT pg_sleep(0.1); ${bookingInsert(vehicle(27),'2030-01-01 10:00Z','2030-01-02 10:00Z')}`);
    const newAttempt=sql(`SELECT pg_sleep(0.1); ${bookingInsert(vehicle(28),'2030-01-01 10:00Z','2030-01-02 10:00Z')}`);
    const moveResults=await Promise.all([moving,oldAttempt,newAttempt]);expect(moveResults[0].ok).toBe(true);expect(moveResults[1].error).toMatch(/40001/);expect(moveResults[2].error).toMatch(/40001/);
  });
});
