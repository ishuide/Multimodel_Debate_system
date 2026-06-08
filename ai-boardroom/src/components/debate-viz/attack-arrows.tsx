import type { DebateRound } from "./types";

interface Props { rounds: DebateRound[]; agents: { name: string; tone: string }[] }

export function AttackArrows({ rounds, agents }: Props) {
  const w = 560, h = 320, cx = w / 2, cy = h / 2, r = 110;
  const pts = agents.map((a, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / agents.length;
    return { ...a, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  // Aggregate critiques: src -> tgt -> total strength
  const totals = new Map<string, number>();
  for (const round of rounds) for (const t of round.turns) {
    for (const c of t.critiques || []) {
      const k = `${t.agent}→${c.target}`;
      totals.set(k, (totals.get(k) ?? 0) + c.strength);
    }
  }

  return (
    <div className="w-full grid place-items-center">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-xl">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="oklch(0.62 0.22 25)" />
          </marker>
        </defs>
        {[...totals.entries()].map(([k, strength]) => {
          const [srcName, tgtName] = k.split("→");
          const src = pts.find(p => p.name === srcName); const tgt = pts.find(p => p.name === tgtName);
          if (!src || !tgt) return null;
          const dx = tgt.x - src.x, dy = tgt.y - src.y;
          const d = Math.hypot(dx, dy);
          const ux = dx / d, uy = dy / d;
          const x1 = src.x + ux * 38, y1 = src.y + uy * 38;
          const x2 = tgt.x - ux * 38, y2 = tgt.y - uy * 38;
          const mx = (x1 + x2) / 2 - uy * 28, my = (y1 + y2) / 2 + ux * 28;
          return (
            <path
              key={k}
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              fill="none"
              stroke="oklch(0.62 0.22 25)"
              strokeOpacity={Math.min(1, 0.25 + strength * 0.6)}
              strokeWidth={1 + strength * 3}
              markerEnd="url(#arrow)"
              className="animate-[pulse_2s_ease-in-out_infinite]"
            />
          );
        })}
        {pts.map(p => (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r={32} fill={`var(--${p.tone})`} opacity={0.18} />
            <circle cx={p.x} cy={p.y} r={26} fill={`var(--${p.tone})`} opacity={0.85} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="white">
              {p.name}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-xs text-muted-foreground mt-2">
        Red arrows = critiques. Thickness = strength · total across rounds.
      </p>
    </div>
  );
}
