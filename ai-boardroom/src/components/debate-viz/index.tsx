import { useState } from "react";
import { Card } from "@/components/ui/card";
import { AttackArrows } from "./attack-arrows";
import { ContradictionGraph } from "./contradiction-graph";
import { ConfidenceHeatmap } from "./confidence-heatmap";
import type { DebateRound } from "./types";

export type { DebateRound, DebateTurn } from "./types";

type Tab = "arrows" | "contradictions" | "confidence" | "maps" | "timeline" | "branching";

const TABS: { id: Tab; label: string; soon?: boolean }[] = [
  { id: "arrows", label: "Attack Arrows" },
  { id: "contradictions", label: "Contradiction Graph" },
  { id: "confidence", label: "Confidence Heatmap" },
  { id: "maps", label: "Augmented Maps", soon: true },
  { id: "timeline", label: "Timeline Reasoning", soon: true },
  { id: "branching", label: "Branching Thoughts", soon: true },
];

interface Props { rounds: DebateRound[]; agents: { name: string; tone: string }[] }

export function DebateVizPanel({ rounds, agents }: Props) {
  const [tab, setTab] = useState<Tab>("arrows");
  return (
    <Card className="glass-card border-border/50 p-5 mb-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-primary">Debate Visualizations</div>
          <div className="text-sm text-muted-foreground">Live structural view of the argument graph.</div>
        </div>
        <div className="flex flex-wrap gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => !t.soon && setTab(t.id)}
              disabled={t.soon}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : t.soon ? "text-muted-foreground/60 cursor-not-allowed"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t.label}{t.soon && " ·  soon"}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-[300px] grid place-items-center">
        {tab === "arrows" && <AttackArrows rounds={rounds} agents={agents} />}
        {tab === "contradictions" && <ContradictionGraph rounds={rounds} />}
        {tab === "confidence" && <ConfidenceHeatmap rounds={rounds} agents={agents} />}
        {(tab === "maps" || tab === "timeline" || tab === "branching") && (
          <div className="text-sm text-muted-foreground py-12">Coming soon.</div>
        )}
      </div>
    </Card>
  );
}
