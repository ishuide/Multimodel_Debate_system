import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, FileText, BookOpen, GraduationCap, Github, Video, CheckSquare, Target, Flag } from "lucide-react";
import type { BlueprintDoc } from "@/lib/export";
import { downloadBlueprintMarkdown, downloadBlueprintPdf } from "@/lib/export";

const typeIcon = {
  doc: BookOpen, course: GraduationCap, video: Video, repo: Github,
} as const;

interface Props { doc: BlueprintDoc; loading?: boolean }

export function BlueprintPanel({ doc, loading }: Props) {
  return (
    <div className="space-y-5">
      <Card className="glass-card border-border/50 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/20 text-accent grid place-items-center"><FileText className="h-5 w-5" /></div>
            <div>
              <h2 className="text-2xl font-semibold">Implementation Blueprint</h2>
              <p className="text-sm text-muted-foreground">
                Step-by-step build guide · what to learn · what to use · how to know you're done.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadBlueprintMarkdown(doc)} disabled={loading || !doc.steps.length}>
              <Download className="h-4 w-4" /> Markdown
            </Button>
            <Button variant="hero" size="sm" onClick={() => downloadBlueprintPdf(doc)} disabled={loading || !doc.steps.length}>
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </Card>

      {loading && !doc.steps.length && (
        <Card className="glass-card border-border/50 p-8 text-center text-sm text-muted-foreground">
          Generating implementation blueprint with your local model…
        </Card>
      )}

      <Card className="glass-card border-border/50 p-2">
        <Accordion type="multiple" className="w-full">
          {doc.steps.map(s => (
            <AccordionItem key={s.week} value={`w${s.week}`} className="border-border/40">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/15 text-primary">W{s.week}</span>
                  <span className="font-medium">{s.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-5 space-y-4">
                <Row Icon={Target} label="Goal" content={s.goal} />
                <Row Icon={Flag} label="Where to start" content={s.whereToStart} />
                {s.prerequisites?.length > 0 && (
                  <List label="Prerequisites" items={s.prerequisites} />
                )}
                {s.resources?.length > 0 && (
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Resources</div>
                    <ul className="space-y-1.5">
                      {s.resources.map((r, i) => {
                        const Icon = typeIcon[r.type] ?? BookOpen;
                        return (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            {r.url ? (
                              <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">{r.label}</a>
                            ) : <span>{r.label}</span>}
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{r.type}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {s.tasks?.length > 0 && <Numbered label="Tasks" items={s.tasks} />}
                {s.deliverables?.length > 0 && <List label="Deliverables" items={s.deliverables} />}
                {s.checkpoints?.length > 0 && (
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <CheckSquare className="h-3 w-3" /> Checkpoints
                    </div>
                    <ul className="space-y-1">
                      {s.checkpoints.map((c, i) => (
                        <li key={i} className="text-sm flex gap-2"><span className="text-primary">✓</span>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}

function Row({ Icon, label, content }: { Icon: typeof Target; label: string; content: string }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-sm">{content}</div>
    </div>
  );
}
function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
      <ul className="space-y-1 text-sm">
        {items.map((it, i) => <li key={i} className="flex gap-2"><span className="text-primary">·</span>{it}</li>)}
      </ul>
    </div>
  );
}
function Numbered({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
      <ol className="space-y-1 text-sm list-decimal pl-5">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ol>
    </div>
  );
}
