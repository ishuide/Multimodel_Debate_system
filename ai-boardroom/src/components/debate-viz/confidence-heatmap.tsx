import type { DebateRound } from "./types";

interface Props { rounds: DebateRound[]; agents: { name: string; tone: string }[] }

export function ConfidenceHeatmap({ rounds, agents }: Props) {
  const matrix = agents.map(a => ({
    name: a.name, tone: a.tone,
    values: rounds.map(r => {
      const t = r.turns.find(x => x.agent === a.name);
      return t?.confidence ?? 0;
    }),
  }));
  const cell = 44;
  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block">
        <div className="flex gap-1 ml-24 mb-1">
          {rounds.map(r => (
            <div key={r.round} style={{ width: cell }} className="text-[10px] text-center text-muted-foreground font-mono">
              R{r.round}
            </div>
          ))}
        </div>
        {matrix.map(row => (
          <div key={row.name} className="flex items-center gap-1 mb-1">
            <div className="w-24 pr-2 text-xs text-right truncate flex items-center justify-end gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: `var(--${row.tone})` }} />
              {row.name}
            </div>
            {row.values.map((v, i) => (
              <div
                key={i}
                style={{
                  width: cell, height: cell,
                  background: `color-mix(in oklab, var(--${row.tone}) ${Math.round(v * 100)}%, transparent)`,
                  border: "1px solid oklch(1 0 0 / 0.08)",
                }}
                className="rounded grid place-items-center text-[10px] font-mono"
                title={`${row.name} R${i + 1}: ${(v * 100).toFixed(0)}%`}
              >
                {(v * 100).toFixed(0)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Self-reported confidence per agent per round. Darker = more confident.
      </p>
    </div>
  );
}
