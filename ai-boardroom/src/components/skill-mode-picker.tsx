import { ALL_MODES, type SkillModeId } from "@/lib/skill-modes";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface Props {
  selected: SkillModeId | null;
  onSelect: (id: SkillModeId) => void;
  onContinue: () => void;
}

export function SkillModePicker({ selected, onSelect, onContinue }: Props) {
  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ALL_MODES.map(m => {
          const active = selected === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="text-left"
            >
              <Card
                className={`glass-card p-5 h-full transition-all hover:-translate-y-0.5 ${
                  active
                    ? "border-primary shadow-[0_0_30px_oklch(0.82_0.14_80/0.3)]"
                    : "border-border/50 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div
                    className={`h-10 w-10 rounded-lg grid place-items-center ${
                      active ? "bg-primary/25 text-primary" : "bg-secondary text-foreground"
                    }`}
                  >
                    <m.Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.tagline}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Agents: {m.agents.map(a => a.name).join(" · ")}
                </div>
              </Card>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <button
          disabled={!selected}
          onClick={onContinue}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-gradient-to-r from-primary to-[oklch(0.7_0.16_50)] text-primary-foreground shadow-[0_0_30px_oklch(0.82_0.14_80/0.35)] disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] transition-all"
        >
          Continue to brief <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
