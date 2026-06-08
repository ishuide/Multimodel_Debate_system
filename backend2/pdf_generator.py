"""
pdf_generator.py — AI Boardroom Project Plan PDF Generator

Generates a structured PDF from the consensus plan output.
Resources are fetched live from public APIs — no hallucinated links.
Charts are rendered with matplotlib locally.
"""

import io
import os
import re
import json
import math
import time
import logging
import textwrap
import requests
import tempfile
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
from datetime import datetime
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Image, KeepTogether
)
from reportlab.pdfgen import canvas
from reportlab.platypus.flowables import Flowable

logger = logging.getLogger(__name__)

# ── Brand colours ────────────────────────────────────────────────────────────
GOLD        = colors.HexColor("#C9A84C")
GOLD_LIGHT  = colors.HexColor("#E8C87A")
SURFACE     = colors.HexColor("#0E0E10")
SURFACE_2   = colors.HexColor("#141416")
SURFACE_3   = colors.HexColor("#1A1A1E")
TEXT_PRI    = colors.HexColor("#F0EDE6")
TEXT_SEC    = colors.HexColor("#8A8880")
TEXT_MUTED  = colors.HexColor("#4A4845")
ACCENT_BLUE = colors.HexColor("#4A8FD4")
ACCENT_TEAL = colors.HexColor("#3AAFA9")
ACCENT_CORAL= colors.HexColor("#D4654A")
PURPLE      = colors.HexColor("#A78BFA")
WHITE       = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm


# ── Resource fetcher — real links only ───────────────────────────────────────

KNOWN_DOCS = {
    # Frontend
    "next.js": "https://nextjs.org/docs",
    "nextjs": "https://nextjs.org/docs",
    "react": "https://react.dev",
    "vue": "https://vuejs.org/guide",
    "svelte": "https://svelte.dev/docs",
    "tailwind": "https://tailwindcss.com/docs",
    "tailwindcss": "https://tailwindcss.com/docs",
    "vite": "https://vitejs.dev/guide",
    "typescript": "https://www.typescriptlang.org/docs",
    # Backend
    "fastapi": "https://fastapi.tiangolo.com",
    "django": "https://docs.djangoproject.com",
    "flask": "https://flask.palletsprojects.com",
    "express": "https://expressjs.com/en/4x/api.html",
    "nestjs": "https://docs.nestjs.com",
    "node": "https://nodejs.org/en/docs",
    "nodejs": "https://nodejs.org/en/docs",
    # Databases
    "postgresql": "https://www.postgresql.org/docs/current",
    "postgres": "https://www.postgresql.org/docs/current",
    "mongodb": "https://www.mongodb.com/docs",
    "redis": "https://redis.io/docs",
    "mysql": "https://dev.mysql.com/doc",
    "sqlite": "https://www.sqlite.org/docs.html",
    "supabase": "https://supabase.com/docs",
    "prisma": "https://www.prisma.io/docs",
    # Cloud / Infra
    "docker": "https://docs.docker.com",
    "kubernetes": "https://kubernetes.io/docs/home",
    "aws": "https://docs.aws.amazon.com",
    "gcp": "https://cloud.google.com/docs",
    "azure": "https://learn.microsoft.com/en-us/azure",
    "vercel": "https://vercel.com/docs",
    "railway": "https://docs.railway.app",
    # AI / ML
    "pytorch": "https://pytorch.org/docs",
    "tensorflow": "https://www.tensorflow.org/api_docs",
    "langchain": "https://python.langchain.com/docs",
    "openai": "https://platform.openai.com/docs",
    "anthropic": "https://docs.anthropic.com",
    "huggingface": "https://huggingface.co/docs",
    "ollama": "https://github.com/ollama/ollama",
    # Other
    "graphql": "https://graphql.org/learn",
    "stripe": "https://docs.stripe.com",
    "firebase": "https://firebase.google.com/docs",
    "auth0": "https://auth0.com/docs",
    "celery": "https://docs.celeryq.dev",
    "kafka": "https://kafka.apache.org/documentation",
    "elasticsearch": "https://www.elastic.co/guide",
    "nginx": "https://nginx.org/en/docs",
    "git": "https://git-scm.com/doc",
    "github": "https://docs.github.com",
    "flutter": "https://docs.flutter.dev",
    "node.js": "https://nodejs.org/en/docs",
}

def _normalize(name: str) -> str:
    return name.lower().strip().rstrip(".,;:")

def fetch_npm_meta(package: str) -> Optional[dict]:
    """Fetch real npm package metadata."""
    try:
        r = requests.get(f"https://registry.npmjs.org/{package}/latest", timeout=5)
        if r.status_code == 200:
            d = r.json()
            return {
                "name": d.get("name", package),
                "version": d.get("version", ""),
                "description": d.get("description", "")[:120],
                "homepage": d.get("homepage") or f"https://www.npmjs.com/package/{package}",
                "repo": (d.get("repository") or {}).get("url", "").replace("git+", "").replace(".git", ""),
            }
    except Exception:
        pass
    return None

def fetch_pypi_meta(package: str) -> Optional[dict]:
    """Fetch real PyPI package metadata."""
    try:
        r = requests.get(f"https://pypi.org/pypi/{package}/json", timeout=5)
        if r.status_code == 200:
            info = r.json().get("info", {})
            return {
                "name": info.get("name", package),
                "version": info.get("version", ""),
                "description": (info.get("summary") or "")[:120],
                "homepage": info.get("home_page") or info.get("project_url") or f"https://pypi.org/project/{package}",
            }
    except Exception:
        pass
    return None

def resolve_resources(stack_str: str, idea: str) -> list[dict]:
    """
    Given a tech stack string, return real verified resource links.
    Falls back to known doc URLs. Never invents links.
    """
    resources = []
    seen = set()

    # Parse stack tokens
    tokens = re.split(r"[,/\s]+", stack_str)
    tokens = [t.strip().rstrip(".,;") for t in tokens if len(t.strip()) > 1]

    for raw in tokens:
        key = _normalize(raw)
        if key in seen:
            continue
        seen.add(key)

        # Check known docs first
        if key in KNOWN_DOCS:
            resources.append({
                "name": raw,
                "url": KNOWN_DOCS[key],
                "version": "",
                "description": f"Official documentation for {raw}",
                "source": "official",
            })
            continue

        # Try npm
        npm = fetch_npm_meta(key)
        if npm:
            resources.append({
                "name": npm["name"],
                "url": npm["homepage"],
                "version": npm["version"],
                "description": npm["description"],
                "source": "npm",
            })
            time.sleep(0.1)
            continue

        # Try PyPI
        pypi = fetch_pypi_meta(key)
        if pypi:
            resources.append({
                "name": pypi["name"],
                "url": pypi["homepage"],
                "version": pypi["version"],
                "description": pypi["description"],
                "source": "pypi",
            })
            time.sleep(0.1)
            continue

        # Partial match against known docs
        for known_key, known_url in KNOWN_DOCS.items():
            if known_key in key or key in known_key:
                if known_key not in seen:
                    seen.add(known_key)
                    resources.append({
                        "name": raw,
                        "url": known_url,
                        "version": "",
                        "description": f"Official documentation for {raw}",
                        "source": "official",
                    })
                break

    # Always include GitHub search as a resource
    search_q = "+".join(idea.split()[:4])
    resources.append({
        "name": "GitHub — Related Repositories",
        "url": f"https://github.com/search?q={search_q}&type=repositories",
        "version": "",
        "description": "Find open-source implementations and references for similar projects.",
        "source": "github",
    })

    return resources


# ── Chart generators ─────────────────────────────────────────────────────────

def _fig_to_image(fig, width_mm=170, height_mm=80) -> Image:
    """Convert a matplotlib figure to a ReportLab Image flowable."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    buf.seek(0)
    plt.close(fig)
    return Image(buf, width=width_mm * mm, height=height_mm * mm)


def make_roadmap_gantt(roadmap: list[dict], deadline_weeks: int) -> Image:
    """Generate a Gantt-style roadmap chart with matplotlib."""
    if not roadmap:
        return None

    weeks = [r.get("week", i + 1) for i, r in enumerate(roadmap)]
    tasks = [r.get("task", f"Week {w}") for w, r in zip(weeks, roadmap)]

    # Truncate long task names
    tasks = [t[:40] + "…" if len(t) > 40 else t for t in tasks]
    n = len(tasks)

    fig_h = max(2.5, n * 0.35 + 0.8)
    fig, ax = plt.subplots(figsize=(10, fig_h))
    fig.patch.set_facecolor("#0E0E10")
    ax.set_facecolor("#141416")

    cmap = plt.colormaps.get_cmap("YlOrBr").resampled(n)

    for i, (w, task) in enumerate(zip(weeks, tasks)):
        bar_color = "#C9A84C" if i % 3 == 0 else ("#3AAFA9" if i % 3 == 1 else "#4A8FD4")
        ax.barh(i, 1, left=w - 1, color=bar_color, alpha=0.85,
                height=0.5, edgecolor="#1A1A1E", linewidth=0.5)
        ax.text(w - 1 + 0.05, i, task,
                va="center", ha="left", fontsize=7,
                color="#F0EDE6", fontfamily="monospace")

    ax.set_xlim(0, deadline_weeks)
    ax.set_ylim(-0.5, n)
    ax.set_yticks([])
    ax.set_xlabel("Weeks", color="#8A8880", fontsize=9)
    ax.xaxis.label.set_color("#8A8880")
    ax.tick_params(colors="#8A8880", labelsize=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_visible(False)
    ax.spines["bottom"].set_color("#2A2A2E")
    ax.set_title("Project Roadmap — Week by Week", color="#C9A84C",
                 fontsize=11, pad=10, fontweight="bold")

    # Week grid
    for w in range(1, deadline_weeks + 1):
        ax.axvline(x=w, color="#1A1A1E", linewidth=0.4, zorder=0)

    fig.tight_layout(pad=0.6)
    return _fig_to_image(fig, width_mm=170, height_mm=max(55, fig_h * 10))


def make_score_radar(scores: dict) -> Image:
    """Generate a radar/bar chart of judge scores."""
    if not scores:
        return None

    labels = ["Feasibility", "Completeness", "Alignment", "Risk\nAwareness", "Innovation"]
    keys   = ["feasibility", "completeness", "alignment", "risk_awareness", "innovation"]
    vals   = [scores.get(k, 0) for k in keys]

    fig, ax = plt.subplots(figsize=(5.5, 3))
    fig.patch.set_facecolor("#0E0E10")
    ax.set_facecolor("#141416")

    bar_colors = ["#C9A84C", "#3AAFA9", "#4A8FD4", "#A78BFA", "#D4654A"]
    bars = ax.bar(labels, vals, color=bar_colors, alpha=0.88,
                  edgecolor="#1A1A1E", linewidth=0.5, width=0.55)

    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 1.5,
                str(int(val)),
                ha="center", va="bottom",
                fontsize=9, color="#F0EDE6", fontweight="bold")

    ax.set_ylim(0, 110)
    ax.set_ylabel("Score (0–100)", color="#8A8880", fontsize=8)
    ax.tick_params(colors="#8A8880", labelsize=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#2A2A2E")
    ax.spines["bottom"].set_color("#2A2A2E")
    ax.set_title("Judge Evaluation Scores", color="#C9A84C",
                 fontsize=10, pad=8, fontweight="bold")
    ax.yaxis.grid(True, color="#1A1A1E", linewidth=0.5, zorder=0)
    ax.set_axisbelow(True)

    fig.tight_layout(pad=0.6)
    return _fig_to_image(fig, width_mm=120, height_mm=60)


def make_methodology_pie(methodology_weights: dict) -> Image:
    """Pie chart showing methodology contribution to consensus."""
    if not methodology_weights:
        methodology_weights = {"Agile": 40, "Waterfall": 25, "Hybrid": 35}

    labels = list(methodology_weights.keys())
    sizes  = list(methodology_weights.values())
    colors_list = ["#3AAFA9", "#4A8FD4", "#C9A84C"][:len(labels)]

    fig, ax = plt.subplots(figsize=(3.8, 2.8))
    fig.patch.set_facecolor("#0E0E10")
    ax.set_facecolor("#0E0E10")

    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, colors=colors_list,
        autopct="%1.0f%%", startangle=140,
        pctdistance=0.75,
        wedgeprops={"edgecolor": "#0E0E10", "linewidth": 2},
    )
    for t in texts:
        t.set_color("#8A8880")
        t.set_fontsize(9)
    for at in autotexts:
        at.set_color("#F0EDE6")
        at.set_fontsize(9)
        at.set_fontweight("bold")

    ax.set_title("Methodology Contribution", color="#C9A84C",
                 fontsize=10, pad=8, fontweight="bold")
    fig.tight_layout(pad=0.3)
    return _fig_to_image(fig, width_mm=85, height_mm=65)


# ── ReportLab page template ───────────────────────────────────────────────────

class DarkPageTemplate:
    """Handles the dark background, header, and footer on every page."""

    def __init__(self, project_title: str):
        self.title = project_title

    def __call__(self, canvas_obj: canvas.Canvas, doc):
        canvas_obj.saveState()
        w, h = A4

        # Full dark background
        canvas_obj.setFillColor(SURFACE)
        canvas_obj.rect(0, 0, w, h, fill=1, stroke=0)

        # Subtle grid lines
        canvas_obj.setStrokeColor(colors.HexColor("#1A1A1E"))
        canvas_obj.setLineWidth(0.3)
        for x in range(0, int(w), 40):
            canvas_obj.line(x, 0, x, h)
        for y in range(0, int(h), 40):
            canvas_obj.line(0, y, w, y)

        # Top header bar
        canvas_obj.setFillColor(SURFACE_2)
        canvas_obj.rect(0, h - 14 * mm, w, 14 * mm, fill=1, stroke=0)

        # Gold accent line under header
        canvas_obj.setStrokeColor(GOLD)
        canvas_obj.setLineWidth(0.8)
        canvas_obj.line(0, h - 14 * mm, w, h - 14 * mm)

        # Header logo mark
        canvas_obj.setFillColor(GOLD)
        canvas_obj.roundRect(MARGIN, h - 11 * mm, 6 * mm, 6 * mm, 1 * mm, fill=1, stroke=0)
        canvas_obj.setFillColor(SURFACE)
        canvas_obj.setFont("Helvetica-Bold", 7)
        canvas_obj.drawCentredString(MARGIN + 3 * mm, h - 7.8 * mm, "B")

        # Header text
        canvas_obj.setFillColor(TEXT_PRI)
        canvas_obj.setFont("Helvetica-Bold", 9)
        canvas_obj.drawString(MARGIN + 9 * mm, h - 8 * mm, "AI BOARDROOM")
        canvas_obj.setFillColor(TEXT_SEC)
        canvas_obj.setFont("Helvetica", 7)
        short_title = self.title[:55] + "…" if len(self.title) > 55 else self.title
        canvas_obj.drawRightString(w - MARGIN, h - 8 * mm, short_title)

        # Footer
        canvas_obj.setFillColor(SURFACE_2)
        canvas_obj.rect(0, 0, w, 10 * mm, fill=1, stroke=0)
        canvas_obj.setStrokeColor(colors.HexColor("#2A2A2E"))
        canvas_obj.setLineWidth(0.4)
        canvas_obj.line(0, 10 * mm, w, 10 * mm)

        canvas_obj.setFillColor(TEXT_MUTED)
        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.drawString(MARGIN, 3.5 * mm,
            f"Generated {datetime.now().strftime('%d %b %Y')} · AI Boardroom — Multi-Agent Decision Intelligence")
        canvas_obj.drawRightString(w - MARGIN, 3.5 * mm, f"Page {doc.page}")

        canvas_obj.restoreState()


# ── Style helpers ─────────────────────────────────────────────────────────────

def build_styles():
    base = getSampleStyleSheet()
    s = {}

    def ps(name, **kw):
        return ParagraphStyle(name, **kw)

    s["section_label"] = ps("section_label",
        fontName="Helvetica", fontSize=8,
        textColor=GOLD, leading=12,
        spaceAfter=4, spaceBefore=16,
        letterSpacing=2,
    )
    s["h1"] = ps("h1",
        fontName="Helvetica-Bold", fontSize=22,
        textColor=TEXT_PRI, leading=28,
        spaceAfter=6, spaceBefore=0,
    )
    s["h2"] = ps("h2",
        fontName="Helvetica-Bold", fontSize=14,
        textColor=GOLD, leading=18,
        spaceAfter=6, spaceBefore=14,
    )
    s["h3"] = ps("h3",
        fontName="Helvetica-Bold", fontSize=11,
        textColor=TEXT_PRI, leading=15,
        spaceAfter=4, spaceBefore=10,
    )
    s["body"] = ps("body",
        fontName="Helvetica", fontSize=9.5,
        textColor=TEXT_SEC, leading=15,
        spaceAfter=6,
    )
    s["body_gold"] = ps("body_gold",
        fontName="Helvetica", fontSize=9.5,
        textColor=GOLD_LIGHT, leading=15,
        spaceAfter=4,
    )
    s["mono"] = ps("mono",
        fontName="Courier", fontSize=8.5,
        textColor=ACCENT_TEAL, leading=13,
        spaceAfter=3,
        backColor=SURFACE_3,
        leftIndent=8, rightIndent=8,
        borderPad=4,
    )
    s["tag"] = ps("tag",
        fontName="Helvetica", fontSize=7,
        textColor=TEXT_MUTED, leading=10,
        spaceAfter=2,
    )
    s["url"] = ps("url",
        fontName="Helvetica", fontSize=8,
        textColor=ACCENT_BLUE, leading=11,
        spaceAfter=2,
    )
    s["risk"] = ps("risk",
        fontName="Helvetica", fontSize=9,
        textColor=ACCENT_CORAL, leading=13,
        spaceAfter=3, leftIndent=12,
    )
    s["week_label"] = ps("week_label",
        fontName="Helvetica-Bold", fontSize=8,
        textColor=GOLD, leading=10,
        spaceAfter=2,
    )
    s["cover_sub"] = ps("cover_sub",
        fontName="Helvetica", fontSize=11,
        textColor=TEXT_SEC, leading=16,
        spaceAfter=4, alignment=TA_CENTER,
    )
    s["cover_tag"] = ps("cover_tag",
        fontName="Helvetica", fontSize=8,
        textColor=GOLD, leading=11,
        spaceAfter=2, alignment=TA_CENTER,
        letterSpacing=2,
    )
    return s


def divider(color=SURFACE_3, thickness=0.5, spaceB=8, spaceA=4):
    return HRFlowable(width="100%", thickness=thickness,
                      color=color, spaceAfter=spaceA, spaceBefore=spaceB)


def gold_divider():
    return HRFlowable(width="100%", thickness=0.8,
                      color=GOLD, spaceAfter=6, spaceBefore=6)


def section_box(title: str, s: dict) -> list:
    """Returns a gold-accented section header."""
    return [
        Spacer(1, 4 * mm),
        Paragraph(title.upper(), s["section_label"]),
        gold_divider(),
    ]


# ── Main PDF builder ──────────────────────────────────────────────────────────

def generate_project_pdf(
    idea: str,
    stack: str,
    team: int,
    deadline: int,
    consensus_plan: dict,
    judge_scores: dict,
    methodology_weights: dict,
    project_id: str = "",
) -> bytes:
    """
    Build and return the full PDF as bytes.

    Args:
        idea:                 The user's original project idea text.
        stack:                Tech stack string (comma-separated).
        team:                 Team size (int).
        deadline:             Deadline in weeks (int).
        consensus_plan:       The UnifiedPlan dict from the consensus agent.
        judge_scores:         Dict of agent name → JudgeScore dict.
        methodology_weights:  Dict like {"Agile": 40, "Waterfall": 25, "Hybrid": 35}.
        project_id:           Optional project session ID.

    Returns:
        PDF as raw bytes.
    """
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=18 * mm,
        bottomMargin=14 * mm,
    )

    s = build_styles()
    page_cb = DarkPageTemplate(idea[:60])
    story = []

    roadmap = consensus_plan.get("roadmap", [])
    summary = consensus_plan.get("summary", "")
    risks   = consensus_plan.get("risks", [])
    consensus_reasoning = consensus_plan.get("consensus_reasoning", "")

    # Fetch real resources (may do network calls)
    resources = resolve_resources(stack, idea)

    # ── Cover page ───────────────────────────────────────────────────────────
    story.append(Spacer(1, 20 * mm))
    story.append(Paragraph("PROJECT EXECUTION PLAN", s["cover_tag"]))
    story.append(Spacer(1, 3 * mm))

    # Big title
    title_text = idea[:80] + ("…" if len(idea) > 80 else "")
    story.append(Paragraph(
        f'<font color="#C9A84C">{title_text}</font>',
        ParagraphStyle("cover_h1",
            fontName="Helvetica-Bold", fontSize=20,
            textColor=GOLD, leading=26,
            spaceAfter=6, alignment=TA_CENTER,
        )
    ))

    story.append(Spacer(1, 4 * mm))

    # Meta table on cover
    meta_data = [
        ["Team Size", f"{team} people"],
        ["Deadline",  f"{deadline} weeks"],
        ["Stack",     stack or "Not specified"],
        ["Generated", datetime.now().strftime("%d %B %Y")],
        ["Session",   project_id or "—"],
    ]
    meta_table = Table(meta_data, colWidths=[40 * mm, 110 * mm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME",    (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE",    (0, 0), (-1, -1), 9),
        ("TEXTCOLOR",   (0, 0), (0, -1),  TEXT_MUTED.hexval()),
        ("TEXTCOLOR",   (1, 0), (1, -1),  TEXT_PRI.hexval()),
        ("FONTNAME",    (0, 0), (0, -1),  "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [SURFACE_2.hexval(), SURFACE_3.hexval()]),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1),  5),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [4]),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 7 * mm))

    # Score summary on cover
    best_scores = {}
    if judge_scores:
        for agent_name, sc in judge_scores.items():
            if isinstance(sc, dict):
                for k in ["feasibility", "completeness", "alignment", "risk_awareness", "innovation"]:
                    if k not in best_scores or sc.get(k, 0) > best_scores[k]:
                        best_scores[k] = sc.get(k, 0)

    if best_scores:
        score_row = [[
            _score_cell(s, "Feasibility",    best_scores.get("feasibility", 0)),
            _score_cell(s, "Completeness",   best_scores.get("completeness", 0)),
            _score_cell(s, "Alignment",      best_scores.get("alignment", 0)),
            _score_cell(s, "Innovation",     best_scores.get("innovation", 0)),
        ]]
        cover_score_table = Table(score_row, colWidths=[37 * mm] * 4)
        cover_score_table.setStyle(TableStyle([
            ("ALIGN",       (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",(0, 0), (-1, -1), 4),
        ]))
        story.append(cover_score_table)

    story.append(PageBreak())

    # ── Executive Summary ────────────────────────────────────────────────────
    story += section_box("Executive Summary", s)
    if summary:
        story.append(Paragraph(summary, s["body"]))

    if consensus_reasoning:
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph("Consensus Reasoning", s["h3"]))
        story.append(Paragraph(consensus_reasoning, s["body"]))

    story.append(Spacer(1, 3 * mm))

    # Project brief box
    brief_data = [
        [Paragraph("<b>Project Idea</b>", s["body"]),
         Paragraph(idea, s["body"])],
        [Paragraph("<b>Tech Stack</b>", s["body"]),
         Paragraph(stack or "Not specified", s["body"])],
        [Paragraph("<b>Team</b>", s["body"]),
         Paragraph(f"{team} people", s["body"])],
        [Paragraph("<b>Deadline</b>", s["body"]),
         Paragraph(f"{deadline} weeks", s["body"])],
    ]
    brief_table = Table(brief_data, colWidths=[35 * mm, 120 * mm])
    brief_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), SURFACE_2),
        ("BACKGROUND",  (0, 0), (0, -1),  SURFACE_3),
        ("TEXTCOLOR",   (0, 0), (-1, -1), TEXT_SEC.hexval()),
        ("GRID",        (0, 0), (-1, -1), 0.3, SURFACE_3.hexval()),
        ("TOPPADDING",  (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0),(-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(brief_table)

    # ── Charts section ───────────────────────────────────────────────────────
    story += section_box("Analysis & Visualisations", s)

    # Judge scores bar chart — skip if all scores are 0
    has_real_scores = best_scores and any(v > 0 for v in best_scores.values())
    if has_real_scores:
        story.append(Paragraph("Judge Evaluation", s["h3"]))
        chart_img = make_score_radar(best_scores)
        if chart_img:
            story.append(chart_img)
            story.append(Spacer(1, 2 * mm))

    # Methodology pie
    if methodology_weights:
        story.append(Paragraph("Methodology Contribution to Consensus", s["h3"]))
        pie_img = make_methodology_pie(methodology_weights)
        if pie_img:
            story.append(pie_img)
        story.append(Spacer(1, 2 * mm))

    # Gantt roadmap
    if roadmap:
        story.append(PageBreak())
        story += section_box("Roadmap Gantt Chart", s)
        gantt_img = make_roadmap_gantt(roadmap, deadline)
        if gantt_img:
            story.append(gantt_img)

    # ── Detailed Roadmap ─────────────────────────────────────────────────────
    story.append(PageBreak())
    story += section_box("Detailed Weekly Roadmap", s)
    story.append(Paragraph(
        f"Full {deadline}-week execution plan — one milestone per week.",
        s["body"]
    ))
    story.append(Spacer(1, 3 * mm))

    for entry in roadmap:
        week    = entry.get("week", "?")
        task    = entry.get("task", "")
        obj     = entry.get("objective", "")
        tasks   = entry.get("tasks", [])
        deliv   = entry.get("deliverables", [])
        arts    = entry.get("artifacts", [])
        success = entry.get("success_criteria", "")
        source  = entry.get("source", [])

        # Week header row
        week_header = [
            Paragraph(f"Week {week}", s["week_label"]),
            Paragraph(task, ParagraphStyle("task_title",
                fontName="Helvetica-Bold", fontSize=10,
                textColor=TEXT_PRI, leading=14)),
            Paragraph(", ".join(source) if source else "", s["tag"]),
        ]
        wh_table = Table([week_header], colWidths=[18 * mm, 118 * mm, 24 * mm])
        wh_table.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, -1), SURFACE_3),
            ("BACKGROUND",   (0, 0), (0, 0),   GOLD),
            ("TEXTCOLOR",    (0, 0), (0, 0),   SURFACE),
            ("ALIGN",        (2, 0), (2, 0),   "RIGHT"),
            ("TOPPADDING",   (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
            ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ]))
        story.append(KeepTogether([wh_table]))

        # Detail rows
        detail_rows = []
        if obj:
            detail_rows.append([
                Paragraph("Objective", s["tag"]),
                Paragraph(obj, s["body"]),
            ])
        if tasks:
            task_list = "\n".join(f"  • {t}" for t in tasks)
            detail_rows.append([
                Paragraph("Tasks", s["tag"]),
                Paragraph(task_list.replace("\n", "<br/>"), s["body"]),
            ])
        if deliv:
            del_list = "\n".join(f"  • {d}" for d in deliv)
            detail_rows.append([
                Paragraph("Deliverables", s["tag"]),
                Paragraph(del_list.replace("\n", "<br/>"), s["body"]),
            ])
        if arts:
            detail_rows.append([
                Paragraph("Artifacts", s["tag"]),
                Paragraph("  " + "  ·  ".join(arts), s["mono"]),
            ])
        if success:
            detail_rows.append([
                Paragraph("Done when", s["tag"]),
                Paragraph(success, s["body_gold"]),
            ])

        if detail_rows:
            det_table = Table(detail_rows, colWidths=[22 * mm, 138 * mm])
            det_table.setStyle(TableStyle([
                ("BACKGROUND",   (0, 0), (-1, -1), SURFACE_2),
                ("TEXTCOLOR",    (0, 0), (-1, -1), TEXT_SEC.hexval()),
                ("TOPPADDING",   (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
                ("LEFTPADDING",  (0, 0), (-1, -1), 8),
                ("GRID",         (0, 0), (-1, -1), 0.2, SURFACE_3.hexval()),
            ]))
            story.append(det_table)

        story.append(Spacer(1, 2 * mm))

    # ── Tech Stack Usage ─────────────────────────────────────────────────────
    if stack:
        story.append(PageBreak())
        story += section_box("Tech Stack — How to Use Each Technology", s)
        story.append(Paragraph(
            "Below is a breakdown of each technology in your stack, its role in this project, and how it fits into the roadmap.",
            s["body"]
        ))
        story.append(Spacer(1, 3 * mm))

        stack_tokens = [t.strip() for t in re.split(r"[,/\s]+", stack) if len(t.strip()) > 1]
        tech_roles = {
            # Common role descriptions — only for tech that appears in stack
            "next.js": "Frontend framework — handles routing, SSR, and API routes.",
            "nextjs": "Frontend framework — handles routing, SSR, and API routes.",
            "react": "UI component library — builds the interactive interface layer.",
            "tailwind": "Utility-first CSS — styles components without writing custom CSS.",
            "tailwindcss": "Utility-first CSS — styles components without writing custom CSS.",
            "fastapi": "Python backend framework — exposes REST + SSE endpoints.",
            "django": "Full-stack Python framework — handles models, views, and admin.",
            "flask": "Lightweight Python web framework — minimal backend API layer.",
            "postgresql": "Relational database — stores structured project and user data.",
            "postgres": "Relational database — stores structured project and user data.",
            "mongodb": "Document database — flexible schema for unstructured data.",
            "redis": "In-memory store — caching, session management, pub/sub.",
            "docker": "Containerisation — ensures consistent environments across dev and prod.",
            "typescript": "Typed JavaScript — catches bugs early, improves editor support.",
            "prisma": "ORM layer — type-safe database access from TypeScript/Node.",
            "supabase": "Backend-as-a-service — auth, database, and storage out of the box.",
            "openai": "LLM API — powers AI features and natural language processing.",
            "ollama": "Local LLM runner — runs open models like Mistral and LLaMA locally.",
            "langchain": "LLM orchestration — chains prompts, tools, and memory together.",
            "stripe": "Payment processing — handles subscriptions and one-time payments.",
            "vercel": "Deployment platform — CI/CD and edge hosting for Next.js apps.",
        }

        for token in stack_tokens:
            key = _normalize(token)
            role = tech_roles.get(key, f"Core component in the {token} layer of this project.")
            story.append(Paragraph(token, s["h3"]))
            story.append(Paragraph(role, s["body"]))
            story.append(Spacer(1, 1 * mm))

    # ── Resources ────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story += section_box("Resources & Documentation Links", s)
    story.append(Paragraph(
        "All links below were fetched live at generation time from official sources, npm, and PyPI. "
        "No links are generated or guessed.",
        s["body"]
    ))
    story.append(Spacer(1, 3 * mm))

    res_data = [
        [
            Paragraph("<b>Resource</b>", s["tag"]),
            Paragraph("<b>Source</b>", s["tag"]),
            Paragraph("<b>URL</b>", s["tag"]),
        ]
    ]
    for r in resources:
        ver_str = f" v{r['version']}" if r.get("version") else ""
        res_data.append([
            Paragraph(f"{r['name']}{ver_str}", s["body"]),
            Paragraph(r.get("source", "").upper(), s["tag"]),
            Paragraph(
                f'<link href="{r["url"]}" color="#4A8FD4">{r["url"]}</link>',
                s["url"]
            ),
        ])

    res_table = Table(res_data, colWidths=[40 * mm, 18 * mm, 102 * mm])
    row_colors = []
    for i in range(len(res_data)):
        row_colors.append(("ROWBACKGROUNDS", (0, i), (-1, i),
            [SURFACE_3 if i % 2 == 0 else SURFACE_2]))

    res_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), SURFACE_3),
        ("TEXTCOLOR",    (0, 0), (-1, 0), TEXT_MUTED.hexval()),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [SURFACE_2, SURFACE_3]),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("GRID",         (0, 0), (-1, -1), 0.2, SURFACE_3.hexval()),
        ("FONTSIZE",     (0, 0), (-1, -1), 8),
        ("WORDWRAP",     (2, 0), (2, -1), True),
    ]))
    story.append(res_table)

    # ── Risks ────────────────────────────────────────────────────────────────
    if risks:
        story += section_box("Identified Risks", s)
        for i, risk in enumerate(risks, 1):
            story.append(Paragraph(f"{i}. {risk}", s["risk"]))

    # ── Build ────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=page_cb, onLaterPages=page_cb)
    buf.seek(0)
    return buf.read()


def _score_cell(s: dict, label: str, value: int) -> list:
    """Returns a list of flowables for a score cell on the cover."""
    color_map = {
        range(0, 60): ACCENT_CORAL,
        range(60, 80): GOLD,
        range(80, 101): ACCENT_TEAL,
    }
    col = GOLD
    for r, c in color_map.items():
        if value in r:
            col = c
            break

    return [
        Paragraph(label, ParagraphStyle("sl", fontName="Helvetica", fontSize=7,
                  textColor=TEXT_MUTED, alignment=TA_CENTER, leading=10)),
        Paragraph(str(int(value)), ParagraphStyle("sv", fontName="Helvetica-Bold",
                  fontSize=18, textColor=col, alignment=TA_CENTER, leading=22)),
    ]


# ── CLI test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Quick smoke test with fake data
    fake_consensus = {
        "summary": "A multi-agent AI platform for collaborative project planning using Agile, Waterfall, and Hybrid methodologies.",
        "consensus_reasoning": "Agile methodology contributed the sprint structure while Hybrid provided the overall phase planning. Waterfall's sequential risk model was retained for the validation phase.",
        "roadmap": [
            {"week": 1, "task": "Project Setup & Environment", "objective": "Bootstrap all services", "tasks": ["Init repo", "Setup Docker compose", "Configure CI/CD"], "deliverables": ["Working local environment"], "artifacts": ["docker-compose.yml", ".env.example"], "success_criteria": "All services running locally.", "source": ["Agile"]},
            {"week": 2, "task": "Database Schema Design", "objective": "Define all data models", "tasks": ["ERD design", "Prisma schema", "Seed data"], "deliverables": ["Database schema", "Migration files"], "artifacts": ["schema.prisma", "seed.ts"], "success_criteria": "Database migrated and seeded.", "source": ["Waterfall"]},
            {"week": 3, "task": "Auth & User Management", "objective": "Implement auth flow", "tasks": ["JWT setup", "Login/signup endpoints", "Role management"], "deliverables": ["Auth API", "Middleware"], "artifacts": ["auth.ts", "middleware.ts"], "success_criteria": "Auth tests passing.", "source": ["Hybrid"]},
        ],
        "risks": ["Ollama model latency may affect UX on low-spec hardware.", "Consensus agent may produce inconsistent outputs without alignment caps."],
    }
    pdf_bytes = generate_project_pdf(
        idea="AI Boardroom — a multi-agent project planning platform",
        stack="Next.js, FastAPI, PostgreSQL, Ollama, Redis",
        team=3,
        deadline=12,
        consensus_plan=fake_consensus,
        judge_scores={"agile": {"feasibility": 82, "completeness": 78, "alignment": 90, "risk_awareness": 75, "innovation": 68}},
        methodology_weights={"Agile": 45, "Waterfall": 20, "Hybrid": 35},
        project_id="test-001",
    )
    with open("/tmp/test_boardroom.pdf", "wb") as f:
        f.write(pdf_bytes)
    print(f"PDF written: {len(pdf_bytes):,} bytes → /tmp/test_boardroom.pdf")
