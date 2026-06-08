'use client'

import { useMemo, useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Sparkles, Layers, Scale, GitMerge, MapIcon, Play, AlertTriangle,
  CheckCircle2, MessageSquareQuote, Shield, Trophy, Download, Wand2, Boxes, Info,
} from "lucide-react";
import { SkillModePicker } from "@/components/skill-mode-picker";
import { DebateVizPanel, type DebateRound } from "@/components/debate-viz";
import { BlueprintPanel } from "@/components/blueprint-panel";
import { SKILL_MODES, type SkillModeId } from "@/lib/skill-modes";
import { getNvidiaKey } from "@/lib/ollama";
import {
  downloadRoadmapMarkdown, downloadRoadmapPdf,
  type RoadmapDoc, type BlueprintDoc,
} from "@/lib/export";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const stages = [
  { id: "mode", label: "Skill Mode", Icon: Boxes },
  { id: "input", label: "Project Input", Icon: MessageSquareQuote },
  { id: "debate", label: "Debate Arena", Icon: Sparkles },
  { id: "judge", label: "Judge", Icon: Scale },
  { id: "consensus", label: "Consensus", Icon: GitMerge },
  { id: "roadmap", label: "Roadmap", Icon: MapIcon },
  { id: "blueprint", label: "Blueprint", Icon: Wand2 },
] as const;
type StageId = (typeof stages)[number]["id"];

export default function BoardroomPage() {
  const [stage, setStage] = useState<StageId>("mode");
  const [running, setRunning] = useState(false);
  const [modeId, setModeId] = useState<SkillModeId | null>("startup");
  const [form, setForm] = useState({
    primary: "A voice-driven AI tutor for high-school physics",
    secondary: "Next.js, FastAPI, Ollama, ChromaDB",
    team: 4,
    deadline: 8,
  });

  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [judgeScores, setJudgeScores] = useState<Record<string, any>>({});
  const [roadmap, setRoadmap] = useState<any>({ steps: [], risks: [] });
  const [consensusReasoning, setConsensusReasoning] = useState("");
  const [blueprint, setBlueprint] = useState<BlueprintDoc>({ title: "", mode: "", steps: [] });
  const [blueprintLoading, setBlueprintLoading] = useState(false);

  const mode = modeId ? SKILL_MODES[modeId] : null;
  const agents = useMemo(
    () => mode?.agents ?? [
      { name: "Agile", tone: "agile", role: "Iterative Sprint PM" },
      { name: "Waterfall", tone: "waterfall", role: "Phase-Gate Director" },
      { name: "Hybrid", tone: "hybrid", role: "Adaptive Strategist" },
    ],
    [mode],
  );

  const stageIdx = stages.findIndex(s => s.id === stage);

  const roadmapDoc: RoadmapDoc = {
    title: `${mode?.label ?? "Boardroom"} Roadmap`,
    mode: mode?.label ?? "Default",
    meta: {
      [mode?.primaryFieldLabel ?? "Primary"]: form.primary,
      [mode?.secondaryFieldLabel ?? "Secondary"]: form.secondary,
      "Team size": form.team,
      "Deadline (weeks)": form.deadline,
    },
    steps: roadmap.steps.map((s: any) => {
      const srcStr = s.source || s.sources?.[0] || "Consensus";
      return {
        ...s,
        sources: [srcStr]
      };
    }),
    risks: roadmap.risks,
  };

  async function run() {
    if (!mode) return;
    setRunning(true);
    setStage("debate");
    setRounds([]);
    setJudgeScores({});
    setRoadmap({ steps: [], risks: [] });

    let currentRounds: DebateRound[] = [];
    const _setRounds = (newRounds: DebateRound[]) => {
        currentRounds = newRounds;
        setRounds([...currentRounds]);
    };

    function updateTurn(roundNum: number, agentName: string, updateFn: (t: any) => any) {
      const cloned = JSON.parse(JSON.stringify(currentRounds));
      let r = cloned.find((x: any) => x.round === roundNum);
      if (!r) {
        r = { round: roundNum, turns: [], contradictions: [] };
        cloned.push(r);
      }
      let t = r.turns.find((x: any) => x.agent === agentName);
      if (!t) {
        t = { agent: agentName, claim: "", critiques: [], confidence: 0.8 };
        r.turns.push(t);
      }
      Object.assign(t, updateFn(t));
      _setRounds(cloned);
    }

    try {
      const params = new URLSearchParams({
        idea: form.primary,
        techStack: form.secondary,
        members: form.team.toString(),
        deadlineWeeks: form.deadline.toString(),
      });
      const nk = getNvidiaKey();
      if (nk) params.append("nvidiaKey", nk);
      const res = await fetch(`${API_BASE}/debate?${params.toString()}`);
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'message';
      const BACKEND_PERSONAS = ["agile", "waterfall", "hybrid"];
      
      const mapPersona = (p: string) => {
        const idx = BACKEND_PERSONAS.indexOf(p.toLowerCase());
        if (idx >= 0 && agents[idx]) return agents[idx].name;
        return p;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';

        for (const rawLine of parts) {
          const line = rawLine.trim();
          if (!line) continue;
          
          if (line.startsWith('event:')) {
            currentEvent = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            const dataStr = line.replace('data:', '').trim();
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              const mappedPersona = parsed.persona ? mapPersona(parsed.persona) : undefined;
              
              if (currentEvent === 'partial' && mappedPersona) {
                let claim = "Initial plan proposed.";
                try {
                    const planObj = JSON.parse(parsed.response);
                    if (planObj.phases) claim = "Proposed phase-gated waterfall plan.";
                    else if (planObj.tasks) claim = "Proposed iterative agile sprint plan.";
                    else claim = "Proposed initial implementation plan.";
                } catch(e) {}
                updateTurn(1, mappedPersona, () => ({ claim, confidence: 0.8 }));
              }
              else if (currentEvent === 'debate' && mappedPersona) {
                let critObj: any = {};
                try { critObj = JSON.parse(parsed.critique); } catch(e) {}
                updateTurn(2, mappedPersona, () => ({
                  claim: critObj.weakness_1 || "Critiqued other plans.",
                  confidence: 0.7,
                  critiques: agents.filter(a => a.name !== mappedPersona).map(a => ({ target: a.name, strength: 0.5 }))
                }));
              }
              else if (currentEvent === 'defense' && mappedPersona) {
                updateTurn(3, mappedPersona, () => ({ claim: parsed.defense || "Defended core strategy.", confidence: 0.85 }));
              }
              else if (currentEvent === 'revision' && mappedPersona) {
                updateTurn(4, mappedPersona, () => ({ claim: "Revised plan based on board feedback.", confidence: 0.9 }));
              }
              else if (currentEvent === 'judge' && mappedPersona) {
                setStage(prev => prev === 'debate' ? 'judge' : prev);
                setJudgeScores(prev => ({ ...prev, [mappedPersona]: parsed.scores }));
              }
              else if (currentEvent === 'final') {
                setStage("consensus");
                setConsensusReasoning(parsed.boardDecision?.consensus_reasoning || "Consensus reached.");
                setRoadmap({ steps: parsed.roadmap || [], risks: parsed.risks || [] });
                setTimeout(() => setStage("roadmap"), 1500);
                toast.success("Session complete. Roadmap ready.");
              }
              
            } catch (e) {
                // ignore unparseable data
            }
          }
        }
      }
    } catch (err) {
      toast.error(`Connection failed: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  async function generateBlueprint() {
    if (!mode) return;
    setStage("blueprint");
    setBlueprint({ title: roadmapDoc.title.replace("Roadmap", "Blueprint"), mode: mode.label, steps: [] });
    setBlueprintLoading(true);

    try {
      const res = await fetch(`${API_BASE}/blueprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              roadmap: roadmap.steps,
              brief: form.primary,
              mode: mode.label
          })
      });
      if (!res.ok) throw new Error("Failed to generate blueprint");
      const data = await res.json();
      setBlueprint(b => ({ ...b, steps: data.steps ?? [] }));
      toast.success("Implementation blueprint ready");
    } catch (e) {
      toast.error(`Blueprint failed: ${(e as Error).message}`);
    } finally {
      setBlueprintLoading(false);
    }
  }

  return (
    <PageLayout>
      <section className="mx-auto max-w-7xl px-6 pt-12 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary mb-2">/boardroom</div>
            <h1 className="text-4xl font-semibold">The Boardroom</h1>
            <p className="text-muted-foreground mt-2">
              {mode ? `Mode: ${mode.label} · ${mode.tagline}` : "Pick a skill mode to begin."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {agents.map(a => (
              <Badge key={a.name} variant="outline" className="border-border/60 gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--${a.tone})` }} />
                {a.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Stage stepper */}
        <div className="mt-8 glass-card rounded-2xl p-4 flex flex-wrap items-center gap-2">
          {stages.map((s, i) => {
            const active = s.id === stage;
            const done = i < stageIdx;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => setStage(s.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    active ? "bg-primary text-primary-foreground shadow-[0_0_25px_oklch(0.82_0.14_80/0.4)]" :
                    done ? "text-foreground bg-secondary" : "text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  <s.Icon className="h-4 w-4" />
                  <span className="font-medium hidden sm:inline">{s.label}</span>
                </button>
                {i < stages.length - 1 && <div className="hidden md:block h-px w-4 bg-border" />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        {stage === "mode" && (
          <Card className="glass-card border-border/50 p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">Choose an AI Skill Mode</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Each mode swaps the agents, the brief fields, and the system prompts sent to your local model.
              </p>
            </div>
            <SkillModePicker
              selected={modeId}
              onSelect={setModeId}
              onContinue={() => setStage("input")}
            />
          </Card>
        )}

        {stage === "input" && mode && (
          <Card className="glass-card border-border/50 p-8 grid md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-semibold">Project brief</h2>
              <p className="text-muted-foreground mt-2 text-sm">The board needs four inputs to begin deliberation.</p>
              <div className="mt-6 space-y-4">
                <div>
                  <Label>{mode.primaryFieldLabel}</Label>
                  <Textarea
                    value={form.primary}
                    onChange={e => setForm({ ...form, primary: e.target.value })}
                    placeholder={mode.primaryFieldPlaceholder}
                    className="mt-1.5 min-h-[100px]"
                  />
                </div>
                <div>
                  <Label>{mode.secondaryFieldLabel}</Label>
                  <Input
                    value={form.secondary}
                    onChange={e => setForm({ ...form, secondary: e.target.value })}
                    placeholder={mode.secondaryFieldPlaceholder}
                    className="mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Team size</Label>
                    <Input type="number" min="1" value={form.team} onChange={e => setForm({ ...form, team: Math.max(1, +e.target.value) })} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Deadline (weeks)</Label>
                    <Input type="number" min="1" value={form.deadline} onChange={e => setForm({ ...form, deadline: Math.max(1, +e.target.value) })} className="mt-1.5" />
                  </div>
                </div>
                <Button variant="hero" size="lg" className="w-full mt-2" onClick={run} disabled={running}>
                  <Play className="h-4 w-4" /> Convene the Board
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Pipeline preview</div>
              {[
                `Brief → ${mode.agents.length} ${mode.label} agents`,
                "Run multi-round debate via backend",
                "Visualize attacks · contradictions · confidence",
                "Judge scores · Consensus synthesis",
                "Generate downloadable roadmap (MD + PDF)",
                "Enhance into implementation blueprint",
              ].map((s, i) => (
                <div key={s} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border/50">
                  <div className="h-7 w-7 rounded-md bg-primary/15 text-primary grid place-items-center text-xs font-mono">{i + 1}</div>
                  <span className="text-sm">{s}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {stage === "debate" && (
          <>
            <DebateVizPanel rounds={rounds} agents={agents} />
            
            {rounds.length === 0 ? (
               <div className="mt-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Meet Your Boardroom</h3>
                 <p className="text-muted-foreground text-sm mb-6">The AI models are currently analyzing your project and preparing their initial plans. Here is the persona breakdown for this debate:</p>
                 <div className="grid gap-4 md:grid-cols-3">
                   {agents.map(a => (
                     <div key={a.name} className="p-4 rounded-xl border border-border/50 bg-secondary/20">
                       <div className="flex items-center gap-2 mb-2">
                          <div className="h-6 w-6 rounded flex items-center justify-center" style={{ background: `var(--${a.tone})`, color: '#0E0E10' }}>
                            <Layers className="h-3 w-3" />
                          </div>
                          <span className="font-semibold">{a.name}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{a.role}</span>
                       </div>
                       {a.focus && <div className="text-sm text-muted-foreground mb-2"><strong className="text-foreground">Focus:</strong> {a.focus}</div>}
                       {a.debateStyle && <div className="text-sm text-muted-foreground"><strong className="text-foreground">Style:</strong> {a.debateStyle}</div>}
                     </div>
                   ))}
                 </div>
               </div>
            ) : (
               <div className="flex justify-end mt-2 mb-4">
                 <Dialog>
                   <DialogTrigger asChild>
                     <Button variant="outline" size="sm" className="gap-2">
                       <Info className="h-4 w-4" /> Agent Personas
                     </Button>
                   </DialogTrigger>
                   <DialogContent className="max-w-3xl glass-card border-border/50">
                     <DialogHeader>
                       <DialogTitle>Debate Personas</DialogTitle>
                       <DialogDescription>The competing AI roles evaluating your project.</DialogDescription>
                     </DialogHeader>
                     <div className="grid gap-4 md:grid-cols-3 mt-4">
                       {agents.map(a => (
                         <div key={a.name} className="p-4 rounded-xl border border-border/50 bg-secondary/20">
                           <div className="flex items-center gap-2 mb-2">
                              <div className="h-6 w-6 rounded flex items-center justify-center" style={{ background: `var(--${a.tone})`, color: '#0E0E10' }}>
                                <Layers className="h-3 w-3" />
                              </div>
                              <span className="font-semibold">{a.name}</span>
                           </div>
                           {a.focus && <div className="text-sm text-muted-foreground mb-2"><strong className="text-foreground">Focus:</strong> {a.focus}</div>}
                           {a.debateStyle && <div className="text-sm text-muted-foreground"><strong className="text-foreground">Style:</strong> {a.debateStyle}</div>}
                         </div>
                       ))}
                     </div>
                   </DialogContent>
                 </Dialog>
               </div>
            )}

            <div className="grid lg:grid-cols-3 gap-5 mt-5">
              {agents.map(a => {
                const turns = rounds.flatMap(r => r.turns.filter(t => t.agent === a.name).map(t => ({ ...t, round: r.round })));
                return (
                  <Card key={a.name} className="glass-card border-border/50 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: `color-mix(in oklab, var(--${a.tone}) 18%, transparent)`, color: `var(--${a.tone})` }}>
                          <Layers className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.role}</div>
                        </div>
                      </div>
                      <Badge variant="outline">Rounds {rounds.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {turns.length === 0 && (
                        <div className="text-sm text-muted-foreground">Waiting for turns…</div>
                      )}
                      {turns.map((t, i) => (
                        <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/40">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: `var(--${a.tone})` }} />
                          <div>
                            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                              Round {t.round} · confidence {(t.confidence * 100).toFixed(0)}%
                            </div>
                            <div className="text-sm mt-0.5">{t.claim}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {stage === "judge" && (
          <Card className="glass-card border-border/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary grid place-items-center"><Scale className="h-5 w-5" /></div>
              <div>
                <h2 className="text-2xl font-semibold">Judge evaluation</h2>
                <p className="text-sm text-muted-foreground">Deterministic 5-axis scoring with alignment caps.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border/50">
                    <th className="py-3 px-2 font-medium">Agent</th>
                    {["Feasibility", "Completeness", "Alignment", "Risk", "Innovation", "Total"].map(h => (
                      <th key={h} className="py-3 px-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a, idx) => {
                    const agentScores = judgeScores[a.name] || {};
                    const metrics = agentScores.metrics || {
                        feasibility: 50, completeness: 50, alignment: 50, risk_awareness: 50, innovation: 50
                    };
                    const scores = [metrics.feasibility, metrics.completeness, metrics.alignment, metrics.risk_awareness, metrics.innovation];
                    const total = agentScores.final_score || scores.reduce((ac, cv) => ac + cv, 0);
                    
                    return (
                      <tr key={a.name} className="border-b border-border/30">
                        <td className="py-4 px-2 font-medium flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: `var(--${a.tone})` }} />
                          {a.name}
                        </td>
                        {scores.map((v, i) => (
                          <td key={i} className="py-4 px-2">
                            <div className="flex items-center gap-2">
                              <Progress value={v} className="h-1.5 w-20" />
                              <span className="font-mono text-xs">{v}</span>
                            </div>
                          </td>
                        ))}
                        <td className="py-4 px-2 font-mono font-semibold text-primary">{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-primary" /> Scores derived from backend judge evaluation.
            </div>
          </Card>
        )}

        {stage === "consensus" && (
          <Card className="glass-card border-border/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-accent/20 text-accent grid place-items-center"><GitMerge className="h-5 w-5" /></div>
              <div>
                <h2 className="text-2xl font-semibold">Consensus formation</h2>
                <p className="text-sm text-muted-foreground">Overlap detection with per-step source attribution.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Consensus reasoning</div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {consensusReasoning}
                </p>
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Board decision</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span>{mode?.label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Rounds</span><span className="font-mono">{rounds.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Steps planned</span><span className="font-mono">{roadmap.steps.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Risks identified</span><span className="font-mono">{roadmap.risks.length}</span></div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {stage === "roadmap" && (
          <div className="space-y-6">
            <Card className="glass-card border-border/50 p-8">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary grid place-items-center"><MapIcon className="h-5 w-5" /></div>
                  <div>
                    <h2 className="text-2xl font-semibold">Execution roadmap</h2>
                    <p className="text-sm text-muted-foreground">Validated final contract · sourced per step.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadRoadmapMarkdown(roadmapDoc)}>
                    <Download className="h-4 w-4" /> Markdown
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadRoadmapPdf(roadmapDoc)}>
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                  <Button variant="hero" size="sm" onClick={generateBlueprint}>
                    <Wand2 className="h-4 w-4" /> Enhance & Detail
                  </Button>
                </div>
              </div>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-primary/60 before:via-accent/60 before:to-primary/60">
                {roadmap.steps.map((step: any) => (
                  <div key={step.week} className="relative">
                    <div className="absolute -left-[18px] top-1.5 h-3 w-3 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
                    <div className="flex items-baseline justify-between gap-4 flex-wrap">
                      <div className="font-medium">Week {step.week}: {step.task || step.title}</div>
                      <div className="flex gap-1.5">
                        {(step.sources || step.source || []).map((src: string) => {
                          const agent = agents.find(a => a.name === src);
                          const tone = agent?.tone ?? "hybrid";
                          return (
                            <span key={src} className="text-[10px] font-mono px-2 py-0.5 rounded"
                              style={{ background: `color-mix(in oklab, var(--${tone}) 18%, transparent)`, color: `var(--${tone})` }}>
                              {src}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-5">
              <Card className="glass-card border-border/50 p-6">
                <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4 text-destructive" /><h3 className="font-semibold">Risks identified</h3></div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {roadmap.risks.map((r: string) => <li key={r}>· {r}</li>)}
                </ul>
              </Card>
              <Card className="glass-card border-border/50 p-6">
                <div className="flex items-center gap-2 mb-3"><Shield className="h-4 w-4 text-primary" /><h3 className="font-semibold">Project memory</h3></div>
                <p className="text-sm text-muted-foreground">
                  Mode <span className="font-mono text-foreground">{mode?.id}</span>. Future plans in this domain can inherit the lessons captured here.
                </p>
              </Card>
            </div>
          </div>
        )}

        {stage === "blueprint" && (
          <BlueprintPanel doc={blueprint} loading={blueprintLoading} />
        )}
      </section>
    </PageLayout>
  );
}
