import { describe,it,expect,beforeAll } from 'vitest';
import { inventorySql,testTeam,vehicle,bookingInsert } from './helpers/inventory-sql.ts';

describe('inventory read/write parity on actual isolated PostgreSQL',()=>{
  let sql:ReturnType<typeof inventorySql>;
  const available=(id:number,start:string,end:string)=>`SELECT public.agent_inventory_available('${vehicle(id)}','${start}','${end}');`;
  beforeAll(async()=>{
    sql=inventorySql();
    const ids=Array.from({length:10},(_,i)=>`'${vehicle(i+30)}'`).join(',');
    expect((await sql(`DELETE FROM public.vehicle_blocked_dates WHERE team_id='${testTeam}' AND vehicle_id IN(${ids}); DELETE FROM public.bookings WHERE team_id='${testTeam}' AND vehicle_id IN(${ids}); UPDATE public.teams SET rental_buffer_minutes=60 WHERE id='${testTeam}';`)).ok).toBe(true);
  });
  it('agrees on exact turnaround boundary without adding a second buffer',async()=>{
    expect((await sql(bookingInsert(vehicle(30),'2030-01-01 15:00Z','2030-01-02 15:00Z'))).ok).toBe(true);
    expect((await sql(available(30,'2030-01-02 15:59Z','2030-01-03 15:59Z'))).output).toMatch(/\nf$/);
    expect((await sql(available(30,'2030-01-02 16:00Z','2030-01-03 16:00Z'))).output).toMatch(/\nt$/);
    expect((await sql(bookingInsert(vehicle(30),'2030-01-02 15:59Z','2030-01-03 15:59Z'))).error).toMatch(/23P01/);
    expect((await sql(bookingInsert(vehicle(30),'2030-01-02 16:00Z','2030-01-03 16:00Z'))).ok).toBe(true);
    const busy=await sql(`SELECT busy_start_at,busy_end_at,buffer_minutes FROM public.public_vehicle_busy_windows('agent-test-inventory','agent-test-30','2030-01-01','2030-01-05');`);
    expect(busy.output).toContain('2030-01-01 15:00:00+00|2030-01-02 16:00:00+00|60');
  });
  it('keeps existing snapshots after tenant buffer changes',async()=>{
    expect((await sql(bookingInsert(vehicle(31),'2030-01-01 15:00Z','2030-01-02 15:00Z'))).ok).toBe(true);
    expect((await sql(`UPDATE public.teams SET rental_buffer_minutes=120 WHERE id='${testTeam}';`)).ok).toBe(true);
    expect((await sql(available(31,'2030-01-02 16:00Z','2030-01-03 16:00Z'))).output).toMatch(/\nt$/);
    expect((await sql(bookingInsert(vehicle(31),'2030-01-02 16:00Z','2030-01-03 16:00Z'))).ok).toBe(true);
    expect((await sql(`SELECT string_agg(inventory_buffer_minutes::text,',' ORDER BY start_date) FROM public.bookings WHERE vehicle_id='${vehicle(31)}';`)).output).toMatch(/\n60,120$/);
    expect((await sql(`UPDATE public.bookings SET inventory_buffer_minutes=0 WHERE vehicle_id='${vehicle(31)}';`)).error).toMatch(/22023/);
    expect((await sql(`UPDATE public.teams SET rental_buffer_minutes=60 WHERE id='${testTeam}';`)).ok).toBe(true);
  });
  it('treats maintenance as a raw half-open range and includes it in precise busy windows',async()=>{
    expect((await sql(`INSERT INTO public.vehicle_blocked_dates(team_id,vehicle_id,start_date,end_date) VALUES('${testTeam}','${vehicle(32)}','2030-01-01 15:00Z','2030-01-02 15:00Z');`)).ok).toBe(true);
    expect((await sql(available(32,'2030-01-02 15:00Z','2030-01-03 15:00Z'))).output).toMatch(/\nt$/);
    expect((await sql(bookingInsert(vehicle(32),'2030-01-02 15:00Z','2030-01-03 15:00Z'))).ok).toBe(true);
    expect((await sql(available(32,'2029-12-31 15:00Z','2030-01-01 14:30Z'))).output).toMatch(/\nf$/);
    expect((await sql(`SELECT buffer_minutes FROM public.public_vehicle_busy_windows('agent-test-inventory','agent-test-32','2030-01-01','2030-01-03') ORDER BY busy_start_at LIMIT 1;`)).output).toMatch(/\n0$/);
  });
  it('uses tenant dates independently of PostgreSQL session timezone for date projections',async()=>{
    expect((await sql(bookingInsert(vehicle(33),'2030-01-02 04:30Z','2030-01-02 05:30Z'))).ok).toBe(true);
    const query=`SELECT busy_start,busy_end FROM public.public_vehicle_availability('agent-test-inventory','agent-test-33','2030-01-01','2030-01-03');`;
    const utc=await sql(`SET TIME ZONE 'UTC'; ${query}`), tokyo=await sql(`SET TIME ZONE 'Asia/Tokyo'; ${query}`);
    expect(utc.output).toContain('2030-01-01|2030-01-02'); expect(tokyo.output).toContain('2030-01-01|2030-01-02');
    expect((await sql(`SELECT vehicle_slug FROM public.public_fleet_busy('2030-01-02','2030-01-02','agent-test-inventory');`)).output).toContain('agent-test-33');
  });
  it('uses elapsed-minute buffers across both DST transitions',async()=>{
    for(const [id,end,next] of [[34,'2030-03-10 01:30-05','2030-03-10 03:30-04'],[35,'2030-11-03 01:30-04','2030-11-03 01:30-05']] as const){
      expect((await sql(bookingInsert(vehicle(id),'2030-01-01 15:00Z',end))).ok).toBe(true);
      expect((await sql(available(id,next,'2030-12-01 15:00Z'))).output).toMatch(/\nt$/);
      expect((await sql(bookingInsert(vehicle(id),next,'2030-12-01 15:00Z'))).ok).toBe(true);
    }
  });
  it('holds elapsed requests until actual transition, protects either financial leg and preserves 24h/72h policy',async()=>{
    expect((await sql(`${bookingInsert(vehicle(36),'2030-01-01 15:00Z','2030-01-02 15:00Z','marketplace','pending_documents')}${bookingInsert(vehicle(37),'2030-01-01 15:00Z','2030-01-02 15:00Z','marketplace','requested')}${bookingInsert(vehicle(38),'2030-01-01 15:00Z','2030-01-02 15:00Z','marketplace','pending_documents')}${bookingInsert(vehicle(39),'2030-01-01 15:00Z','2030-01-02 15:00Z','marketplace','pending_documents')}
      UPDATE public.bookings SET created_at=now()-interval '73 hours' WHERE vehicle_id IN('${vehicle(36)}','${vehicle(37)}','${vehicle(38)}','${vehicle(39)}');
      UPDATE public.bookings SET operator_payment_intent_id='agent-test-partial-operator' WHERE vehicle_id='${vehicle(38)}';
      UPDATE public.bookings SET exotiq_payment_intent_id='agent-test-partial-exotiq' WHERE vehicle_id='${vehicle(39)}';`)).ok).toBe(true);
    expect((await sql(available(36,'2030-01-01 15:00Z','2030-01-02 15:00Z'))).output).toMatch(/\nf$/);
    expect((await sql(`SELECT count(*) FROM public.expire_unverified_holds() WHERE team_id='${testTeam}';`)).output).toMatch(/\n2$/);
    expect((await sql(available(36,'2030-01-01 15:00Z','2030-01-02 15:00Z'))).output).toMatch(/\nt$/);
    expect((await sql(available(38,'2030-01-01 15:00Z','2030-01-02 15:00Z'))).output).toMatch(/\nf$/);
    expect((await sql(available(39,'2030-01-01 15:00Z','2030-01-02 15:00Z'))).output).toMatch(/\nf$/);
    expect((await sql(`SELECT count(*) FROM public.expire_unverified_holds() WHERE team_id='${testTeam}';`)).output).toMatch(/\n0$/);
  });
});
