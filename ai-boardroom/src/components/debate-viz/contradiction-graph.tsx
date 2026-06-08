import type { DebateRound } from "./types";

interface Props { rounds: DebateRound[] }

export function ContradictionGraph({ rounds }: Props) {
  // Collect unique claims + contradictions
  const claims = new Map<string, { id: string; label: string; agent: string }>();
  const edges: { a: string; b: string }[] = [];
  for (const r of rounds) {
    for (const t of r.turns) {
      const id = `${t.agent}-r${r.round}`;
      if (!claims.has(id)) claims.set(id, { id, label: t.claim.slice(0, 64), agent: t.agent });
    }
    for (const c of r.contradictions || []) edges.push(c);
  }
  const nodes = [...claims.values()];
  const w = 560, h = 360;
  const positioned = nodes.map((n, i) => {
    const angle = (i * 2 * Math.PI) / Math.max(1, nodes.length);
    const r = 130 + (i % 2) * 20;
    return { ...n, x: w / 2 + r * Math.cos(angle), y: h / 2 + r * Math.sin(angle) };
  });
  const toneFor = (agent: string) => {
    const idx = [...new Set(nodes.map(n => n.agent))].indexOf(agent);
    return ["agile", "waterfall", "hybrid"][idx % 3];
  };

  return (
    <div className="w-full grid place-items-center">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-2xl">
        {edges.map((e, i) => {
          const a = positioned.find(p => p.label.includes(e.a) || p.id === e.a);
          const b = positioned.find(p => p.label.includes(e.b) || p.id === e.b);
          if (!a || !b) return null;
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="oklch(0.62 0.22 25)" strokeOpacity={0.6} strokeDasharray="4 4" strokeWidth={1.5} />
          );
        })}
        {positioned.map(p => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r={9} fill={`var(--${toneFor(p.agent)})`} />
            <text x={p.x + 12} y={p.y + 4} fontSize="10" fill="oklch(0.97 0.005 240)">
              {p.label.length > 28 ? p.label.slice(0, 28) + "…" : p.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-xs text-muted-foreground mt-2">
        Nodes = claims · dashed red lines = contradictions detected between rounds.
      </p>
    </div>
  );
}
