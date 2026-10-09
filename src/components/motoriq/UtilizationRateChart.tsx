import { useMemo } from "react";
import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import type { VehicleFacts } from "@/lib/motoriq/types";

/**
 * Price vs. utilization, compared with the car's OWN PEERS (same type of car in the same market), because a $1,400
 * supercar and a $300 sedan cannot share one price axis. A car is only plotted when it has at least 2 peers.
 *   x: share of the last 30 days it was booked (from bookings)
 *   y: listed rate compared with the median of its peers
 */
interface Point {
  id: string;
  name: string;
  util: number;
  rateVsPeers: number;
  rate: number;
  peers: number;
  zone: "strong" | "headroom" | "priced-out" | "low";
}

const ZONES: Record<Point["zone"], { label: string; color: string; hint: string }> = {
  strong: { label: "Booked more, priced higher", color: "hsl(var(--success))", hint: "Doing well at a premium." },
  headroom: { label: "Booked more, priced lower", color: "hsl(var(--warning))", hint: "Busier than its peers at a lower price: may have room to raise." },
  "priced-out": { label: "Booked less, priced higher", color: "hsl(var(--destructive))", hint: "Priced above its peers and booked less: price may be the barrier." },
  low: { label: "Booked less, priced lower", color: "hsl(var(--muted-foreground))", hint: "Slow even at a lower price: look at availability, photos or location, not price." },
};

const median = (a: number[]) => {
  const b = [...a].sort((x, y) => x - y);
  return b.length ? b[Math.floor(b.length / 2)] : 0;
};

export function peerPoints(vehicles: VehicleFacts[]): Point[] {
  const groups = new Map<string, VehicleFacts[]>();
  for (const v of vehicles.filter((x) => !x.outOfService && x.trailing30.share != null && x.currentRate > 0)) {
    groups.set(`${v.segment}|${v.market}`, [...(groups.get(`${v.segment}|${v.market}`) ?? []), v]);
  }
  const out: Point[] = [];
  for (const list of groups.values()) {
    if (list.length < 3) continue; // a car plus at least 2 peers
    const medRate = median(list.map((v) => v.currentRate));
    const medUtil = median(list.map((v) => v.trailing30.share!));
    for (const v of list) {
      const util = v.trailing30.share!;
      const rateVsPeers = v.currentRate / medRate - 1;
      const busy = util > medUtil;
      const high = rateVsPeers > 0;
      out.push({
        id: v.id, name: v.name, util: Math.round(util * 100), rateVsPeers: Math.round(rateVsPeers * 100), rate: v.currentRate, peers: list.length - 1,
        zone: busy ? (high ? "strong" : "headroom") : high ? "priced-out" : "low",
      });
    }
  }
  return out;
}

interface Props {
  vehicles: VehicleFacts[];
  onSelect?: (vehicleId: string) => void;
}

export const UtilizationRateChart = ({ vehicles, onSelect }: Props) => {
  const isMobile = useIsMobile();
  const points = useMemo(() => peerPoints(vehicles), [vehicles]);
  const counts = useMemo(() => {
    const c: Record<Point["zone"], number> = { strong: 0, headroom: 0, "priced-out": 0, low: 0 };
    for (const p of points) c[p.zone]++;
    return c;
  }, [points]);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough cars of the same type in the same market to compare yet (a car needs at least 2 peers).</p>;
  }

  return (
    <div>
      <div role="img" aria-label="Each car's share of days booked against its listed rate compared with similar cars">
        <ResponsiveContainer width="100%" height={isMobile ? 190 : 220}>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" dataKey="util" unit="%" domain={[0, 100]} name="Booked, last 30 days" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
            <YAxis type="number" dataKey="rateVsPeers" unit="%" name="Rate vs peers" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} width={44} />
            <ZAxis range={isMobile ? [50, 110] : [60, 140]} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
            <Tooltip
              content={({ active, payload }) => {
                const p: Point | undefined = active ? payload?.[0]?.payload : undefined;
                if (!p) return null;
                return (
                  <div className="max-w-[240px] rounded-lg border bg-card p-3 text-xs shadow-lg">
                    <div className="mb-1 text-sm font-semibold">{p.name}</div>
                    <div>Booked {p.util}% of the last 30 days</div>
                    <div>Listed rate ${p.rate.toLocaleString("en-US")} ({p.rateVsPeers >= 0 ? "+" : ""}{p.rateVsPeers}% vs {p.peers} similar cars)</div>
                    <div className="mt-1 text-muted-foreground">{ZONES[p.zone].hint}</div>
                  </div>
                );
              }}
            />
            <Scatter data={points} onClick={(d: any) => d?.payload?.id && onSelect?.(d.payload.id)} style={{ cursor: onSelect ? "pointer" : "default" }}>
              {points.map((p) => <Cell key={p.id} fill={ZONES[p.zone].color} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 grid gap-x-4 gap-y-1 text-xs [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {(Object.keys(ZONES) as Point["zone"][]).map((z) => (
          <li key={z} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ZONES[z].color }} />
            <span className="text-muted-foreground"><span className="font-medium text-foreground">{counts[z]}</span> {ZONES[z].label.toLowerCase()}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Each car is compared with the median of similar cars in the same market (not a fixed price line). Click a car to edit its rate.
      </p>
    </div>
  );
};

export default UtilizationRateChart;
