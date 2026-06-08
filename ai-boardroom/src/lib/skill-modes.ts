import {
  Rocket, FileSearch, Code2, MessagesSquare, ShieldCheck, Layout, GraduationCap,
  type LucideIcon,
} from "lucide-react";

export type SkillModeId =
  | "startup" | "research" | "coding" | "interviewer"
  | "patent" | "product" | "learning";

export interface AgentRole { name: string; tone: "agile" | "waterfall" | "hybrid"; role: string; focus?: string; debateStyle?: string; }

export interface SkillMode {
  id: SkillModeId;
  label: string;
  tagline: string;
  Icon: LucideIcon;
  primaryFieldLabel: string;
  primaryFieldPlaceholder: string;
  secondaryFieldLabel: string;
  secondaryFieldPlaceholder: string;
  agents: [AgentRole, AgentRole, AgentRole];
  debateSystem: string;
  roadmapSystem: string;
  blueprintSystem: string;
}

const baseDebateRules = `
You are participating in a structured multi-agent boardroom debate.
Respond STRICTLY as JSON matching the requested schema. No prose outside JSON.
Each agent must: (a) propose, (b) critique the other agents, (c) self-report a confidence in [0,1].
Critique strength is 0..1. Be specific and decisive.`;

const baseRoadmapRules = `
Synthesize the debate into an executable weekly roadmap.
Return STRICT JSON. Each week: { week, task, sources[] } where sources are agent names that contributed.
Also include risks[] (strings).`;

const baseBlueprintRules = `
Expand each week of the roadmap into a detailed implementation step.
Return STRICT JSON: { steps: BlueprintStep[] }. Each BlueprintStep:
{ week, title, goal, whereToStart, prerequisites[], resources[{label,url?,type}], tasks[], deliverables[], checkpoints[] }.
resources.type ∈ "doc"|"course"|"video"|"repo". Be concrete and beginner-friendly.`;

export const SKILL_MODES: Record<SkillModeId, SkillMode> = {
  startup: {
    id: "startup", label: "Startup Mode", tagline: "Build a startup", Icon: Rocket,
    primaryFieldLabel: "Startup idea", primaryFieldPlaceholder: "A voice-driven AI tutor for high-school physics",
    secondaryFieldLabel: "Technology stack", secondaryFieldPlaceholder: "Next.js, FastAPI, Ollama, ChromaDB",
    agents: [
      { name: "Visionary", tone: "agile", role: "Founder & Strategy" },
      { name: "Operator", tone: "waterfall", role: "Ops & Risk" },
      { name: "Builder", tone: "hybrid", role: "Tech & Product" },
    ],
    debateSystem: `You are a startup boardroom. ${baseDebateRules}`,
    roadmapSystem: `Build a 6-week startup execution plan. ${baseRoadmapRules}`,
    blueprintSystem: `Detail a startup execution roadmap. ${baseBlueprintRules}`,
  },
  research: {
    id: "research", label: "Research Mode", tagline: "Analyze a paper / PDF", Icon: FileSearch,
    primaryFieldLabel: "Paper abstract or pasted text", primaryFieldPlaceholder: "Paste abstract or key passages here…",
    secondaryFieldLabel: "Research domain / keywords", secondaryFieldPlaceholder: "RAG, retrieval augmented generation, benchmarks",
    agents: [
      { name: "Methodologist", tone: "agile", role: "Methods Critic" },
      { name: "Statistician", tone: "waterfall", role: "Validity & Stats" },
      { name: "Synthesizer", tone: "hybrid", role: "Cross-domain Reviewer" },
    ],
    debateSystem: `You are peer reviewers. Critique novelty, methodology, validity. ${baseDebateRules}`,
    roadmapSystem: `Plan a research follow-up program by week. ${baseRoadmapRules}`,
    blueprintSystem: `Detail a research follow-up plan. ${baseBlueprintRules}`,
  },
  coding: {
    id: "coding", label: "Coding Mode", tagline: "Architect software", Icon: Code2,
    primaryFieldLabel: "Software to build", primaryFieldPlaceholder: "Realtime collaborative whiteboard with CRDTs",
    secondaryFieldLabel: "Constraints / stack", secondaryFieldPlaceholder: "TypeScript, edge runtime, Postgres",
    agents: [
      { 
        name: "Architect", tone: "waterfall", role: "Systems Design",
        focus: "Scalability, clean code, abstractions, and structural integrity.",
        debateStyle: "Will advocate for building a robust, future-proof foundation first. They will aggressively critique any plan that relies on \"quick and dirty\" hacks."
      },
      { 
        name: "Pragmatist", tone: "agile", role: "Shipping Engineer",
        focus: "Speed to market, minimum viable products (MVPs), and realistic execution.",
        debateStyle: "Will advocate for using pre-built tools and getting features out the door immediately. They will attack the Architect for over-engineering and wasting time."
      },
      { 
        name: "Reviewer", tone: "hybrid", role: "Quality & DX",
        focus: "Testing, documentation, security, and developer experience.",
        debateStyle: "Will act as the gatekeeper. They will attack both the Architect and the Pragmatist if they propose a plan that lacks a solid QA pipeline, CI/CD, or error-handling strategy."
      },
    ],
    debateSystem: `You are senior engineers architecting a system. ${baseDebateRules}`,
    roadmapSystem: `Plan implementation week by week. ${baseRoadmapRules}`,
    blueprintSystem: `Detail an engineering implementation plan. ${baseBlueprintRules}`,
  },
  interviewer: {
    id: "interviewer", label: "Interviewer Mode", tagline: "Debate interview questions", Icon: MessagesSquare,
    primaryFieldLabel: "Role / topic", primaryFieldPlaceholder: "Senior backend engineer — distributed systems",
    secondaryFieldLabel: "Seniority / format", secondaryFieldPlaceholder: "Staff, system design + behavioural",
    agents: [
      { name: "Technical", tone: "waterfall", role: "Depth Interviewer" },
      { name: "Behavioural", tone: "agile", role: "Culture Fit" },
      { name: "Bar Raiser", tone: "hybrid", role: "Signal Calibrator" },
    ],
    debateSystem: `You are interviewers debating which questions best signal seniority. ${baseDebateRules}`,
    roadmapSystem: `Plan a multi-round interview loop. ${baseRoadmapRules}`,
    blueprintSystem: `Detail an interview-loop plan. ${baseBlueprintRules}`,
  },
  patent: {
    id: "patent", label: "Patent Mode", tagline: "Analyze novelty", Icon: ShieldCheck,
    primaryFieldLabel: "Invention summary", primaryFieldPlaceholder: "A method for routing LLM tool calls via affinity scoring…",
    secondaryFieldLabel: "Prior art keywords", secondaryFieldPlaceholder: "tool routing, function calling, MoE",
    agents: [
      { name: "Patent Attorney", tone: "waterfall", role: "Claims Drafter" },
      { name: "Prior-Art Hunter", tone: "agile", role: "Novelty Critic" },
      { name: "Examiner", tone: "hybrid", role: "Obviousness Test" },
    ],
    debateSystem: `You are patent specialists. Debate novelty, obviousness, and claim scope. ${baseDebateRules}`,
    roadmapSystem: `Plan a patent filing program. ${baseRoadmapRules}`,
    blueprintSystem: `Detail a patent filing plan. ${baseBlueprintRules}`,
  },
  product: {
    id: "product", label: "Product Mode", tagline: "PRD + UX + flows", Icon: Layout,
    primaryFieldLabel: "Product to define", primaryFieldPlaceholder: "Onboarding for a B2B analytics dashboard",
    secondaryFieldLabel: "Audience / platform", secondaryFieldPlaceholder: "SMB ops teams, web + mobile",
    agents: [
      { name: "PM", tone: "agile", role: "Product Manager" },
      { name: "Designer", tone: "hybrid", role: "UX & Flows" },
      { name: "Engineer", tone: "waterfall", role: "Tech Feasibility" },
    ],
    debateSystem: `You are a product team debating PRD scope, UX, and flows. ${baseDebateRules}`,
    roadmapSystem: `Plan a product delivery roadmap by week. ${baseRoadmapRules}`,
    blueprintSystem: `Detail a product delivery plan. ${baseBlueprintRules}`,
  },
  learning: {
    id: "learning", label: "Learning Mode", tagline: "AI tutors debate concepts", Icon: GraduationCap,
    primaryFieldLabel: "Concept to learn", primaryFieldPlaceholder: "How do transformers actually work?",
    secondaryFieldLabel: "Your current level", secondaryFieldPlaceholder: "Familiar with Python and basic ML",
    agents: [
      { name: "Intuition Tutor", tone: "agile", role: "Analogies & Hooks" },
      { name: "Formalist", tone: "waterfall", role: "Math & Rigor" },
      { name: "Practitioner", tone: "hybrid", role: "Code & Examples" },
    ],
    debateSystem: `You are tutors debating the best way to teach a concept. ${baseDebateRules}`,
    roadmapSystem: `Plan a week-by-week learning path. ${baseRoadmapRules}`,
    blueprintSystem: `Detail a learning path. ${baseBlueprintRules}`,
  },
};

export const ALL_MODES: SkillMode[] = Object.values(SKILL_MODES);
