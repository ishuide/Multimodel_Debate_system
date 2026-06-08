import jsPDF from "jspdf";

export interface RoadmapStep { week: number; task: string; sources: string[] }
export interface RoadmapDoc {
  title: string;
  mode: string;
  meta: Record<string, string | number>;
  steps: RoadmapStep[];
  risks: string[];
}

export interface BlueprintStep {
  week: number;
  title: string;
  goal: string;
  whereToStart: string;
  prerequisites: string[];
  resources: { label: string; url?: string; type: "doc" | "course" | "video" | "repo" }[];
  tasks: string[];
  deliverables: string[];
  checkpoints: string[];
}
export interface BlueprintDoc {
  title: string;
  mode: string;
  steps: BlueprintStep[];
}

function download(name: string, mime: string, blob: BlobPart) {
  const url = URL.createObjectURL(new Blob([blob], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ts = () => new Date().toISOString().slice(0, 10);

export function roadmapToMarkdown(doc: RoadmapDoc): string {
  const meta = Object.entries(doc.meta).map(([k, v]) => `- **${k}**: ${v}`).join("\n");
  const steps = doc.steps.map(s =>
    `### Week ${s.week}: ${s.task}\n_Sources: ${s.sources.join(", ")}_`
  ).join("\n\n");
  const risks = doc.risks.map(r => `- ${r}`).join("\n");
  return `# ${doc.title}\n\n**Mode:** ${doc.mode}\n\n## Brief\n${meta}\n\n## Roadmap\n\n${steps}\n\n## Risks\n${risks}\n`;
}

export function downloadRoadmapMarkdown(doc: RoadmapDoc) {
  download(`boardroom-roadmap-${doc.mode}-${ts()}.md`, "text/markdown", roadmapToMarkdown(doc));
}

export function blueprintToMarkdown(doc: BlueprintDoc): string {
  const steps = doc.steps.map(s => `### Week ${s.week}: ${s.title}

**Goal:** ${s.goal}

**Where to start:** ${s.whereToStart}

**Prerequisites:**
${s.prerequisites.map(p => `- ${p}`).join("\n")}

**Resources:**
${s.resources.map(r => `- (${r.type}) ${r.label}${r.url ? ` — ${r.url}` : ""}`).join("\n")}

**Tasks:**
${s.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}

**Deliverables:**
${s.deliverables.map(d => `- ${d}`).join("\n")}

**Checkpoints:**
${s.checkpoints.map(c => `- ${c}`).join("\n")}`).join("\n\n---\n\n");
  return `# ${doc.title}\n\n**Mode:** ${doc.mode}\n\n## Implementation Blueprint\n\n${steps}\n`;
}

export function downloadBlueprintMarkdown(doc: BlueprintDoc) {
  download(`boardroom-blueprint-${doc.mode}-${ts()}.md`, "text/markdown", blueprintToMarkdown(doc));
}

// ---------- PDF helpers ----------

function newPdf(title: string, subtitle: string) {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(22);
  pdf.text(title, 56, 80);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
  pdf.setTextColor(120);
  pdf.text(subtitle, 56, 100);
  pdf.setDrawColor(200); pdf.line(56, 112, 556, 112);
  pdf.setTextColor(20);
  return pdf;
}

function writeBlock(pdf: jsPDF, y: number, label: string, body: string | string[]): number {
  const lines = Array.isArray(body) ? body : [body];
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
  pdf.text(label, 56, y); y += 14;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  for (const ln of lines) {
    const wrapped = pdf.splitTextToSize(ln, 500) as string[];
    for (const w of wrapped) {
      if (y > 760) { pdf.addPage(); y = 60; }
      pdf.text(w, 64, y); y += 13;
    }
  }
  return y + 6;
}

export function downloadRoadmapPdf(doc: RoadmapDoc) {
  const pdf = newPdf(doc.title, `Mode: ${doc.mode} · Generated ${new Date().toLocaleString()}`);
  let y = 140;
  y = writeBlock(pdf, y, "Brief",
    Object.entries(doc.meta).map(([k, v]) => `${k}: ${v}`));
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text("Roadmap", 56, y); y += 18;
  for (const s of doc.steps) {
    y = writeBlock(pdf, y, `Week ${s.week} — ${s.task}`, `Sources: ${s.sources.join(", ")}`);
  }
  if (doc.risks.length) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text("Risks", 56, y); y += 18;
    y = writeBlock(pdf, y, "", doc.risks.map(r => `• ${r}`));
  }
  pdf.save(`boardroom-roadmap-${doc.mode}-${ts()}.pdf`);
}

export function downloadBlueprintPdf(doc: BlueprintDoc) {
  const pdf = newPdf(doc.title, `Implementation Blueprint · Mode: ${doc.mode}`);
  let y = 140;
  for (const s of doc.steps) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13);
    if (y > 740) { pdf.addPage(); y = 60; }
    pdf.text(`Week ${s.week}: ${s.title}`, 56, y); y += 18;
    y = writeBlock(pdf, y, "Goal", s.goal);
    y = writeBlock(pdf, y, "Where to start", s.whereToStart);
    if (s.prerequisites.length) y = writeBlock(pdf, y, "Prerequisites", s.prerequisites.map(p => `• ${p}`));
    if (s.resources.length) y = writeBlock(pdf, y, "Resources",
      s.resources.map(r => `• [${r.type}] ${r.label}${r.url ? ` — ${r.url}` : ""}`));
    if (s.tasks.length) y = writeBlock(pdf, y, "Tasks", s.tasks.map((t, i) => `${i + 1}. ${t}`));
    if (s.deliverables.length) y = writeBlock(pdf, y, "Deliverables", s.deliverables.map(d => `• ${d}`));
    if (s.checkpoints.length) y = writeBlock(pdf, y, "Checkpoints", s.checkpoints.map(c => `• ${c}`));
    y += 8;
  }
  pdf.save(`boardroom-blueprint-${doc.mode}-${ts()}.pdf`);
}
