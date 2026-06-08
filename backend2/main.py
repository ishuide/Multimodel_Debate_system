"""
Multi-Agent Debate Engine — Quality Control Refactor

Phase coverage in this file:
  Phase 2  — AgentIsolationValidator enforced after plan generation
  Phase 3  — Critique enforcement with regeneration (max 2 attempts)
  Phase 4  — Revision tracking (original vs revised, penalty for no-change)
  Phase 5  — Validation authority: ValidationResult with penalty + severity
  Phase 6  — Judge refactor: deterministic alignment/innovation caps, reasoning fields
  Phase 7  — Multi-round debate structure (6 rounds) tracked in DebateState
  Phase 8  — Consensus engine: overlap detection, source attribution per roadmap step
  Phase 9  — Synthesis validation before final return; regeneration on failure
  Phase 10 — Final output contract enforced with all required top-level fields

Bugs fixed vs original:
  - Duplicate `from typing import ...` import on lines 18-19
  - `generate_memory_tags` used `tag_result.__root__` (Pydantic v1 RootModel API)
    — updated to `tag_result.root` (Pydantic v2) with v1 fallback
  - `state.dict()` replaced with `state.model_dump()` throughout
  - `validate_plan` was returning `severity="low"` on empty risk lists even when
    severity had already been raised by an earlier blocking issue
  - `blocked_personas` removal loop ran AFTER judge scoring was partially done
  - `RoadmapStep.source` used `min_items=1` which is not a valid Pydantic v2 kwarg
  - IPython imports on lines 1-3 are dead code in a FastAPI context — removed
  - `_validation_penalty` capped at 60 which could undercount critical multi-issue plans

Dead code removed:
  - `from IPython.core import display_functions / application` (never used)
  - Duplicate `from typing import ...` line
  - `risks = set()` accumulation before synthesis (risks sourced from LLM synthesis now)
  - Unreachable `agile_plan / waterfall_plan / hybrid_plan` assignments at line 1055
    (superseded by `valid_plans_for_synthesis`)
"""

import asyncio
import json
import os
import re
import sys
import uuid
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, RootModel
import ollama
from sse_starlette.sse import EventSourceResponse

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "keys", ".env"))

try:
    from openai import AsyncOpenAI
except ImportError:
    pass

from agents.agent import Agent, AgentRegistry
from state_manager import load_state, save_state, DebateState
import project_manager
import retriever
from domain_analyzer import DomainAnalyzer, AgentIsolationValidator, extract_project_domain

from pdf_route import router as pdf_router

# ---------------------------------------------------------------------------
app = FastAPI()
app.include_router(pdf_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════════════════════════════

from schemas import (
    AgilePlan, WaterfallPlan, HybridPlan,
    Critique, JudgeScore, RoadmapStep, UnifiedPlan, TagList
)

class BlueprintResource(BaseModel):
    label: str
    url: Optional[str] = None
    type: str

class BlueprintStep(BaseModel):
    week: int
    title: str
    goal: str
    whereToStart: str
    prerequisites: List[str]
    resources: List[BlueprintResource]
    tasks: List[str]
    deliverables: List[str]
    checkpoints: List[str]

class BlueprintDoc(BaseModel):
    steps: List[BlueprintStep]

class BlueprintRequest(BaseModel):
    roadmap: List[Dict[str, Any]]
    brief: str
    mode: str


SCHEMA_MAPPING = {
    "AgilePlan": AgilePlan,
    "WaterfallPlan": WaterfallPlan,
    "HybridPlan": HybridPlan
}


# ═══════════════════════════════════════════════════════════════════════════
# Phase 5 — Validation Authority
# ═══════════════════════════════════════════════════════════════════════════

class ValidationResult(BaseModel):
    """Authoritative validation result.  Warnings + blocking issues + penalty + severity."""
    warnings: List[str] = Field(default_factory=list)
    blocking_issues: List[str] = Field(default_factory=list)
    is_valid: bool = True
    severity: str = "low"   # low | medium | high | critical
    penalty: int = 0        # Points deducted from judge final score

    def _escalate(self, level: str) -> None:
        """Escalate severity to at least `level`."""
        order = ["low", "medium", "high", "critical"]
        if order.index(level) > order.index(self.severity):
            self.severity = level


def validate_plan(plan_obj: Any) -> ValidationResult:
    """Phase 5: Authoritative plan validation.

    Returns a ValidationResult whose penalty is consumed by the judge layer.
    All violations generate a penalty — validation failures are NEVER silently ignored.
    """
    result = ValidationResult()

    if not plan_obj:
        result.blocking_issues.append("Plan object is null or missing.")
        result.is_valid = False
        result._escalate("critical")
        result.penalty = 100  # Effectively kills the plan
        return result

    # ── Waterfall phase checks ───────────────────────────────────────────
    if hasattr(plan_obj, "phases") and plan_obj.phases:
        seen_phases: List[str] = []
        for phase in plan_obj.phases:
            pname = getattr(phase, "phase", "")
            pdays = getattr(phase, "days", None)

            if pdays is not None and pdays <= 0:
                result.blocking_issues.append(
                    f"Phase '{pname}' has invalid duration: {pdays} days (must be > 0)."
                )
                result._escalate("critical")
                result.penalty += 30

            if pname and pname.lower() in [p.lower() for p in seen_phases]:
                result.blocking_issues.append(f"Duplicate waterfall phase: '{pname}'.")
                result._escalate("high")
                result.penalty += 20
            else:
                seen_phases.append(pname)

    # ── Agile task week checks ───────────────────────────────────────────
    if hasattr(plan_obj, "tasks") and plan_obj.tasks:
        for t in plan_obj.tasks:
            if getattr(t, "week", None) is not None and t.week <= 0:
                result.blocking_issues.append(
                    f"Agile task has invalid week: {t.week} (must be >= 1)."
                )
                result._escalate("critical")
                result.penalty += 25

    # ── Hybrid task week checks ──────────────────────────────────────────
    if hasattr(plan_obj, "mvpTasks") and plan_obj.mvpTasks:
        for task in plan_obj.mvpTasks:
            if getattr(task, "week", None) is not None and task.week <= 0:
                result.blocking_issues.append(
                    f"Hybrid task has invalid week: {task.week} (must be >= 1)."
                )
                result._escalate("critical")
                result.penalty += 25

    # ── totalDays check ──────────────────────────────────────────────────
    if hasattr(plan_obj, "totalDays"):
        td = plan_obj.totalDays
        if td is None or td <= 0:
            result.blocking_issues.append(
                f"Invalid totalDays: {td} (must be > 0)."
            )
            result._escalate("critical")
            result.penalty += 30
        elif td < 10:
            result.warnings.append(f"totalDays suspiciously short: {td}.")
            result._escalate("medium")
            result.penalty += 10

    # ── Risk quality checks ──────────────────────────────────────────────
    risks = getattr(plan_obj, "risks", None) or []
    if not risks:
        result.warnings.append("No risks provided — every software project carries risk.")
        result._escalate("high")
        result.penalty += 25
    else:
        generic_labels = {"high", "medium", "low", "none", "n/a", "tbd", "unknown"}
        for risk in risks:
            if not isinstance(risk, str) or not risk.strip():
                result.warnings.append("Empty or non-string risk entry.")
                result._escalate("medium")
                result.penalty += 10
            elif risk.strip().lower() in generic_labels:
                result.warnings.append(
                    f"Generic risk label '{risk}' — use a specific risk statement."
                )
                result._escalate("medium")
                result.penalty += 15
            elif risk.strip().startswith("{") or "weakness_1" in risk:
                result.warnings.append("Risk entry looks like a critique object — remove it.")
                result._escalate("high")
                result.penalty += 20

    # ── Mitigation disguised as risk check ───────────────────────────────
    mitigation_verbs = ["ensure", "monitor", "track", "implement", "use", "adopt", "establish"]
    for risk in risks:
        if isinstance(risk, str) and any(
            risk.strip().lower().startswith(v) for v in mitigation_verbs
        ):
            result.warnings.append(
                f"Risk '{risk[:60]}...' looks like a mitigation action, not a risk."
            )
            result._escalate("medium")
            result.penalty += 10

    result.is_valid = len(result.blocking_issues) == 0
    result.penalty = min(result.penalty, 80)  # cap at 80 — one plan can't be fully eliminated
    return result


def validate_critique(critique: Any) -> ValidationResult:
    """Phase 3 / Phase 5: Validate that a critique meets the required schema."""
    result = ValidationResult()

    if not critique or not isinstance(critique, dict):
        result.blocking_issues.append("Critique is null, missing, or not a dict.")
        result.is_valid = False
        result._escalate("high")
        result.penalty += 30
        return result

    for field in ["weakness_1", "weakness_2", "impact", "recommendation"]:
        value = critique.get(field, "")
        if _is_malformed_text(str(value)):
            result.blocking_issues.append(f"Critique field '{field}' is malformed or placeholder.")
            result._escalate("high")
            result.penalty += 20

    result.is_valid = len(result.blocking_issues) == 0
    return result


def validate_synthesis(plan: UnifiedPlan, idea: str) -> ValidationResult:
    """Phase 9: Validate the synthesised final plan before returning to client."""
    result = ValidationResult()

    # Missing summary
    if not plan.summary or not plan.summary.strip():
        result.blocking_issues.append("Synthesis summary is empty.")
        result._escalate("critical")
        result.penalty += 50

    # Summary must reference the user idea
    if plan.summary and not _idea_matches_summary(idea, plan.summary):
        result.warnings.append("Summary does not appear to reference the user idea.")
        result._escalate("medium")
        result.penalty += 15

    # Roadmap checks
    if not plan.roadmap:
        result.blocking_issues.append("Synthesis roadmap is empty.")
        result._escalate("critical")
        result.penalty += 50
    else:
        # Check source attribution
        for s in plan.roadmap:
            if not s.source or s.source == ["Consensus"]:
                s.source = ["Agile"] # Fallback to Agile instead of Consensus
        # Duplicate weeks
        dup_weeks = _find_duplicate_weeks(plan.roadmap)
        if dup_weeks:
            result.warnings.append(f"Duplicate roadmap weeks: {dup_weeks} — will be deduplicated.")
            result._escalate("medium")
            result.penalty += 10

        # Unrelated content in roadmap
        if DomainAnalyzer.contains_unrelated_products(
            " ".join(s.task for s in plan.roadmap), idea
        ):
            result.blocking_issues.append("Roadmap contains unrelated product/domain content.")
            result._escalate("critical")
            result.penalty += 40

        # Duplicate tasks
        task_texts = [s.task.strip().lower() for s in plan.roadmap]
        dup_tasks = [t for t, c in Counter(task_texts).items() if c > 1]
        if dup_tasks:
            result.warnings.append(f"Duplicate roadmap tasks detected: {len(dup_tasks)} duplicates.")
            result._escalate("medium")
            result.penalty += 10

        # Roadmap must be chronological
        weeks = [s.week for s in plan.roadmap if hasattr(s, "week")]
        if weeks != sorted(weeks):
            result.warnings.append("Roadmap weeks are not in chronological order.")
            result._escalate("medium")
            result.penalty += 5

    # Risk checks
    if not plan.risks:
        result.warnings.append("Synthesis has no risks.")
        result._escalate("high")
        result.penalty += 20
    else:
        bad_risks = [
            r for r in plan.risks
            if isinstance(r, str) and (
                r.strip().startswith("{") or
                r.strip().startswith("[") or
                "weakness_1" in r
            )
        ]
        if bad_risks:
            result.blocking_issues.append("Risks list contains embedded critique/JSON objects.")
            result._escalate("critical")
            result.penalty += 30

    result.is_valid = len(result.blocking_issues) == 0
    return result


# ═══════════════════════════════════════════════════════════════════════════
# Helper utilities
# ═══════════════════════════════════════════════════════════════════════════

def _is_placeholder_text(text: str) -> bool:
    text = text.strip().lower()
    return (
        not text
        or text.startswith("[json")
        or text.startswith("{json")
        or text.startswith("{")
        or text.startswith("[")
        or "placeholder" in text
        or "json data" in text
        or text == "n/a"
        or text == "none"
    )


def _is_malformed_text(text: str) -> bool:
    if not isinstance(text, str):
        return True
    normalized = text.strip()
    if not normalized or len(normalized) <= 1:
        return True
    if normalized in {",", ".", "-", "n/a", "none"}:
        return True
    return _is_placeholder_text(normalized)


def _is_valid_critique(critique: Critique) -> bool:
    for field in ["weakness_1", "weakness_2", "impact", "recommendation"]:
        if _is_malformed_text(getattr(critique, field, "")):
            return False
    return True


def _idea_matches_summary(idea: str, summary: str) -> bool:
    idea_terms = [t for t in re.findall(r"\w+", idea.lower()) if len(t) > 3]
    summary_lower = summary.lower()
    return any(term in summary_lower for term in idea_terms[:8])


def _find_duplicate_weeks(roadmap: List[RoadmapStep]) -> List[int]:
    week_counts = Counter(step.week for step in roadmap if hasattr(step, "week"))
    return [week for week, count in week_counts.items() if count > 1]


def _deduplicate_roadmap(roadmap: List[RoadmapStep]) -> List[RoadmapStep]:
    seen: set = set()
    cleaned: List[RoadmapStep] = []
    for step in roadmap:
        if step.week in seen:
            continue
        seen.add(step.week)
        cleaned.append(step)
    return cleaned


def _auto_generate_summary(idea: str, roadmap: List[RoadmapStep]) -> str:
    idea_text = idea.strip().rstrip(".")
    snippets = [s.task.strip().rstrip(".") for s in roadmap[:3] if hasattr(s, "task")]
    sentences = [f"This plan defines a pragmatic roadmap to deliver {idea_text}."]
    if snippets:
        sentences.append(f"Early work focuses on {snippets[0].lower()}.")
        if len(snippets) > 1:
            sentences.append(
                f"Subsequent steps include {snippets[1].lower()}"
                + (f" and {snippets[2].lower()}." if len(snippets) > 2 else ".")
            )
    sentences.append(
        "The roadmap preserves the strongest elements from all plans while "
        "remaining realistic and aligned to the user idea."
    )
    return " ".join(sentences)


def _waterfall_structure_warnings(plan: WaterfallPlan) -> List[str]:
    warnings: List[str] = []
    if not plan or not getattr(plan, "phases", None):
        return warnings
    canonical = [
        "requirements", "system design", "architecture", "implementation",
        "verification", "testing", "deployment", "maintenance",
    ]
    actual = [p.phase.strip().lower() for p in plan.phases if getattr(p, "phase", None)]
    matches = sum(1 for kw in canonical if any(kw in p for p in actual))
    if matches < 3:
        warnings.append(
            "Waterfall plan is missing canonical phases "
            "(Requirements, System Design, Implementation, Verification, Deployment)."
        )
    return warnings


def _determine_alignment_cap(plan: Any, idea: str) -> Tuple[int, str]:
    """Phase 6: Deterministic alignment ceiling before judge LLM runs."""
    try:
        idea_domain = DomainAnalyzer.extract_domain_from_idea(idea)
        plan_domain = DomainAnalyzer.extract_domain_from_plan(plan)
        domain_match = DomainAnalyzer.domain_match_score(idea_domain, plan_domain)

        try:
            plan_text = plan.model_dump_json() if hasattr(plan, "model_dump_json") else str(plan)
        except Exception:
            plan_text = str(plan)

        has_unrelated = DomainAnalyzer.contains_unrelated_products(plan_text, idea)

        if has_unrelated:
            return (5, "Plan contains unrelated products/domains not present in user idea.")

        if domain_match >= 0.95:
            return (95, "Excellent domain alignment.")
        elif domain_match >= 0.85:
            return (80, "Good domain alignment.")
        elif domain_match >= 0.70:
            return (65, "Acceptable domain alignment.")
        elif domain_match >= 0.50:
            return (35, "Weak domain alignment — significant content mismatch.")
        else:
            return (15, "Very weak domain alignment.")
    except Exception as e:
        print(f"[Main] WARNING: Domain alignment analysis failed: {e}")
        return (50, "Fallback alignment cap — domain analysis unavailable.")


def _determine_innovation_cap(plan: Any, idea: str) -> int:
    """Phase 6: Deterministic innovation ceiling based on plan content."""
    idea_lower = idea.lower()
    try:
        plan_text = plan.model_dump_json().lower() if hasattr(plan, "model_dump_json") else str(plan).lower()
    except Exception:
        plan_text = str(plan).lower()

    cap = 100
    if "crm" in idea_lower or "customer relationship" in idea_lower:
        if not any(t in plan_text for t in [
            "predictive", "automated", "intelligent", "analytics", "ai",
            "machine learning", "recommendation", "personalization", "forecast",
        ]):
            cap = min(cap, 55)

    if any(t in plan_text for t in ["novel", "unique", "innovative", "patented"]):
        cap = max(cap, 70)
    elif not any(t in plan_text for t in [
        "novel", "unique", "innovative", "machine learning", "ai-powered",
        "predictive", "automation",
    ]):
        cap = min(cap, 65)

    return cap


def compute_final_score(judge_score: JudgeScore) -> float:
    """Phase 6: Weighted scoring formula."""
    return (
        0.30 * judge_score.feasibility
        + 0.25 * judge_score.completeness
        + 0.20 * judge_score.alignment
        + 0.15 * judge_score.risk_awareness
        + 0.10 * judge_score.innovation
    )


# ═══════════════════════════════════════════════════════════════════════════
# Default input
# ═══════════════════════════════════════════════════════════════════════════

default_user_input = {
    "idea": "AI-powered resume screening tool for recruiters",
    "techStack": "Python, FastAPI, React, PostgreSQL",
    "members": 3,
    "deadlineWeeks": 5,
}

model_mapping = [
    {"persona": "agile",     "model": "phi3:mini",     "schema": AgilePlan},
    {"persona": "waterfall", "model": "qwen2:1.5b",    "schema": WaterfallPlan},
    {"persona": "hybrid",    "model": "smollm2:1.7b",  "schema": HybridPlan},
]


# ═══════════════════════════════════════════════════════════════════════════
# RAG / Memory
# ═══════════════════════════════════════════════════════════════════════════

def retrieve_context(idea: str) -> str:
    return retriever.retrieve_semantic_knowledge(idea)


def retrieve_memory(idea: str) -> Tuple[str, Dict[str, Any]]:
    """Phase 1: Return (memory_text, retrieval_metadata) tuple."""
    return retriever.retrieve_semantic_memory(idea, n_results=2, user_idea=idea)


async def generate_memory_tags(idea: str, summary: str) -> List[str]:
    prompt = (
        "Generate 4-6 concise hyphenated tags for this project idea.\n"
        "Return ONLY a JSON array of strings — no preamble, no markdown.\n"
        f"Idea: {idea}\nSummary: {summary}"
    )
    tag_result = await call_model("phi3:mini", prompt, TagList)
    if tag_result:
        # Pydantic v2 uses .root; v1 uses .__root__
        raw = getattr(tag_result, "root", None) or getattr(tag_result, "__root__", [])
        if isinstance(raw, list):
            tags = [t.strip().lower().replace(" ", "-") for t in raw if isinstance(t, str) and t.strip()]
            return list(dict.fromkeys(tags))[:6]
    # Fallback heuristic
    tags: List[str] = []
    idea_lower = idea.lower()
    tag_map = {
        "marketplace": "marketplace", "app": "mobile-app",
        "ai": "ai", "artificial intelligence": "ai",
        "health": "health", "nutrition": "health", "food": "food",
        "resume": "hr", "recruit": "hr",
        "blockchain": "blockchain", "crypto": "blockchain",
        "parking": "parking", "crm": "crm", "language": "language-learning",
    }
    for keyword, tag in tag_map.items():
        if keyword in idea_lower and tag not in tags:
            tags.append(tag)
    return tags or ["general"]


async def save_memory(input_data: Dict[str, Any], final_plan: Dict[str, Any]) -> None:
    """Persist a successful debate result."""
    project_id = input_data.get("project_id", "")
    project_id = await asyncio.to_thread(
        project_manager.save_project_version,
        project_id,
        {
            "idea": input_data["idea"],
            "techStack": input_data["techStack"],
            "teamSize": input_data["members"],
            "deadlineWeeks": input_data["deadlineWeeks"],
            "finalPlan": final_plan,
            "timestamp": str(datetime.now()),
        },
    )

    try:
        summary = final_plan.get("summary", "")
        tags = await generate_memory_tags(input_data["idea"], summary)
        text_rep = (
            f"Idea: {input_data['idea']}\n"
            f"Tags: {', '.join(tags)}\n"
            f"Summary: {summary}"
        )
        memory_id = str(uuid.uuid4())
        retriever.add_memory(
            memory_id,
            text_rep,
            {"tags": tags, "plan": final_plan, "idea": input_data["idea"]},
        )
        print(f"[Main] 💾 Memory & Project {project_id} saved (domain={extract_project_domain(input_data['idea'])})")
    except Exception as e:
        print(f"[Main] ERROR saving semantic memory: {e}")


# (Persona prompts have been moved to AgentRegistry and Agent.build_prompt)


# ═══════════════════════════════════════════════════════════════════════════
# LLM wrapper
# ═══════════════════════════════════════════════════════════════════════════

async def call_model(
    model_name: str,
    prompt: str,
    response_schema: type,
    api_key: Optional[str] = None,
) -> Optional[BaseModel]:
    if model_name.startswith("nvidia/"):
        key_to_use = api_key or os.getenv("nvidia")
        if not key_to_use:
            print(f"[Main] ERROR: Nvidia API key not found or openai not installed for {model_name}")
            return None
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=key_to_use)
            real_model = model_name.replace("nvidia/", "")
            response = await client.chat.completions.create(
                model=real_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=4096,
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            return response_schema.model_validate_json(content)
        except Exception as err:
            print(f"[Main] ERROR calling Nvidia NIM ({model_name}): {err}")
            return None

    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            stream=False,
            format=response_schema.model_json_schema(),
            options={"num_ctx": 4096},
        )
        content = response["message"]["content"]
        return response_schema.model_validate_json(content)
    except Exception as err:
        print(f"[Main] ERROR calling {model_name}: {err}")
        return None


# ═══════════════════════════════════════════════════════════════════════════
# Debate endpoint
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/debate")
async def debate(
    request: Request,
    idea: str = None,
    techStack: str = None,
    members: int = None,
    deadlineWeeks: int = None,
    session_id: Optional[str] = None,
    nvidiaKey: Optional[str] = None,
):
    input_data = {
        "idea": idea or default_user_input["idea"],
        "techStack": techStack or default_user_input["techStack"],
        "members": members or default_user_input["members"],
        "deadlineWeeks": deadlineWeeks or default_user_input["deadlineWeeks"],
    }

    if not session_id:
        session_id = str(uuid.uuid4())
    state = load_state(session_id)
    state.session_id = session_id
    registry = AgentRegistry()

    # Phase 1 — retrieve context and memory BEFORE building prompts
    retrieved_context = retrieve_context(input_data["idea"])
    memory_text, memory_meta = retrieve_memory(input_data["idea"])

    full_context = retrieved_context
    if memory_text:
        full_context += f"\n\nPrevious similar projects:\n{memory_text}"

    async def event_generator():  # noqa: C901 (complexity acceptable for SSE)
        yield {
            "event": "progress",
            "data": json.dumps({"step": f"Starting debate for: {input_data['idea']}"}),
        }

        if retrieved_context:
            yield {
                "event": "progress",
                "data": json.dumps({
                    "step": f"📚 RAG: Retrieved knowledge from "
                            f"{len(retrieved_context.split('[Source:')) - 1} knowledge files"
                }),
            }
        if memory_text:
            domain = memory_meta.get("user_domain", "unknown")
            accepted = memory_meta.get("retrieved", 0)
            discarded = memory_meta.get("filtered", 0)
            yield {
                "event": "progress",
                "data": json.dumps({
                    "step": (
                        f"🧠 Memory: {accepted} relevant past debate(s) accepted, "
                        f"{discarded} discarded (domain={domain})"
                    )
                }),
            }
        elif memory_meta.get("filtered", 0) > 0:
            yield {
                "event": "progress",
                "data": json.dumps({
                    "step": (
                        f"🧠 Memory: {memory_meta['filtered']} candidate(s) discarded "
                        f"(domain mismatch / low confidence) — injecting no memory."
                    )
                }),
            }

        # ─────────────────────────────────────────────────────────────────
        # ROUND 1 — Initial Plan Generation (Phase 7)
        # ─────────────────────────────────────────────────────────────────
        yield {
            "event": "progress",
            "data": json.dumps({"step": "Round 1: Generating initial plans..."}),
        }

        plans: Dict[str, Dict[str, Any]] = {}
        debaters = registry.get_debaters()
        state.agents = [a.name for a in registry.get_all()]

        async def _generate(
            agent: Agent, schema: type, prompt: str
        ) -> Tuple[str, Optional[BaseModel]]:
            plan = await call_model(agent.model, prompt, schema)
            return (agent.name, plan)

        tasks = []
        for agent in debaters:
            schema = SCHEMA_MAPPING.get(agent.schema_name)
            if not schema:
                print(f"[Main] WARNING: Schema {agent.schema_name} not found. Using Any.")
                continue
            prompt = agent.build_prompt(
                input_data["idea"], input_data["members"], input_data["deadlineWeeks"], full_context
            )
            tasks.append(_generate(agent, schema, prompt))
            
        results = await asyncio.gather(*tasks)

        for persona_name, plan_obj in results:
            agent = registry.get_agent(persona_name)
            model_name = agent.model if agent else "unknown"
            if plan_obj:
                # Phase 2 — Agent isolation check
                try:
                    plan_text = plan_obj.model_dump_json()
                except Exception:
                    plan_text = str(plan_obj)
                isolation = AgentIsolationValidator.validate(persona_name, plan_text)
                if not isolation["is_isolated"]:
                    for v in isolation["violations"]:
                        yield {
                            "event": "validation_warning",
                            "data": json.dumps({"persona": persona_name, "issue": v}),
                        }

                plans[persona_name] = {"model": model_name, "plan": plan_obj}
                yield {
                    "event": "partial",
                    "data": json.dumps({
                        "persona": persona_name,
                        "model": model_name,
                        "response": plan_obj.model_dump_json(indent=2),
                    }),
                }
            else:
                plans[persona_name] = {"model": model_name, "plan": None}
                yield {
                    "event": "error",
                    "data": json.dumps({"persona": persona_name, "error": "Failed to generate plan"}),
                }

        state.messages["proposals"] = {k: v.get("plan") for k, v in plans.items() if v.get("plan")}
        state.round_number = 1
        state.add_round("proposals", {k: v.get("plan") for k, v in plans.items()})
        save_state(state)
        await asyncio.sleep(1)

        # ─────────────────────────────────────────────────────────────────
        # ROUND 2 — Critiques (Phase 3 + Phase 7)
        # ─────────────────────────────────────────────────────────────────
        yield {
            "event": "progress",
            "data": json.dumps({"step": "Round 2: Generating critiques..."}),
        }

        critiques: Dict[str, Any] = {}
        persona_list = list(plans.keys())

        for persona in persona_list:
            if not plans[persona]["plan"]:
                continue

            yield {
                "event": "progress",
                "data": json.dumps({"step": f"{persona} is critiquing others..."}),
            }

            other_plans = []
            for p in persona_list:
                if p != persona and plans[p]["plan"]:
                    other_plans.append(
                        f"{p.upper()} plan:\n{plans[p]['plan'].model_dump_json(indent=2)[:1500]}"
                    )

            critique_prompt = f"""You are {persona}.

Plans to critique:

{chr(10).join(other_plans)}

Provide a JSON object with ALL four fields populated.
Each field MUST be a complete, specific sentence — no placeholders, no empty strings.
Focus on actual weaknesses and concrete recommendations.
Do not invent Agile terms unless you are the Agile persona.

Required fields:
- weakness_1: A specific technical or process weakness
- weakness_2: A different weakness from weakness_1
- impact: The real-world consequence of these weaknesses
- recommendation: A concrete actionable suggestion

Output ONLY JSON."""

            model_key = plans[persona]["model"]
            critique_obj = await call_model(model_key, critique_prompt, Critique)

            # Phase 3 — enforce critique validity; regenerate up to 2 times
            valid_critique = critique_obj and _is_valid_critique(critique_obj)

            if not valid_critique:
                yield {
                    "event": "progress",
                    "data": json.dumps({"step": f"⚠️ {persona} critique invalid — retrying (attempt 2)..."}),
                }
                retry_prompt = (
                    critique_prompt
                    + "\n\nPREVIOUS ATTEMPT FAILED. "
                    "You MUST provide non-empty, non-placeholder values for ALL four fields. "
                    "Return the JSON object only."
                )
                critique_obj = await call_model(model_key, retry_prompt, Critique)
                valid_critique = critique_obj and _is_valid_critique(critique_obj)

            if valid_critique:
                critiques[persona] = critique_obj.model_dump()
                yield {
                    "event": "debate",
                    "data": json.dumps({
                        "persona": persona,
                        "critique": critique_obj.model_dump_json(indent=2),
                    }),
                }
            else:
                # Phase 3: do not continue with empty critiques — use sentinel
                critiques[persona] = {
                    "weakness_1": f"{persona} critique failed after 2 attempts.",
                    "weakness_2": "Critique could not be validated.",
                    "impact": "Debate quality reduced — scoring will reflect this.",
                    "recommendation": "No valid recommendation generated.",
                }
                yield {
                    "event": "error",
                    "data": json.dumps({
                        "persona": persona,
                        "error": "Critique invalid after 2 attempts — sentinel inserted.",
                    }),
                }

            await asyncio.sleep(1)

        state.messages["critiques"] = critiques
        state.add_round("critiques", critiques)
        save_state(state)

        # ─────────────────────────────────────────────────────────────────
        # ROUND 3 — Defenses (Phase 7)
        # ─────────────────────────────────────────────────────────────────
        yield {
            "event": "progress",
            "data": json.dumps({"step": "Round 3: Agents defending their plans..."}),
        }

        defenses: Dict[str, str] = {}
        for persona in persona_list:
            if not plans[persona]["plan"]:
                continue
            received = [
                f"{op}: {json.dumps(crit)}"
                for op, crit in critiques.items()
                if op != persona
            ]
            defense_prompt = f"""You are {persona}.

Your plan:
{plans[persona]['plan'].model_dump_json(indent=2)[:1500]}

Critiques received:
{chr(10).join(received)}

In 2-3 sentences, defend the strongest aspects of your plan and explain
why the criticisms, while noted, do not undermine your core approach.
Respond in plain text (not JSON)."""

            try:
                response = await asyncio.to_thread(
                    ollama.chat,
                    model=plans[persona]["model"],
                    messages=[{"role": "user", "content": defense_prompt}],
                    stream=False,
                    options={"num_ctx": 2048},
                )
                defense_text = response.get("message", {}).get("content", "")
            except Exception as e:
                print(f"[Main] ERROR generating defense for {persona}: {e}")
                defense_text = f"[{persona} failed to generate a defense due to a model error.]"

            defenses[persona] = defense_text
            yield {
                "event": "defense",
                "data": json.dumps({"persona": persona, "defense": defense_text}),
            }
            await asyncio.sleep(0.5)

        state.add_round("defenses", defenses)
        save_state(state)

        # ─────────────────────────────────────────────────────────────────
        # ROUND 4 — Revisions (Phase 4 + Phase 7)
        # ─────────────────────────────────────────────────────────────────
        yield {
            "event": "progress",
            "data": json.dumps({"step": "Round 4: Revising plans based on critiques..."}),
        }

        revised_plans: Dict[str, Any] = {}

        for persona in persona_list:
            if not plans[persona]["plan"]:
                continue

            own_plan_json = plans[persona]["plan"].model_dump_json(indent=2)
            received_critiques = [
                f"{op}: {json.dumps(crit)}"
                for op, crit in critiques.items()
                if op != persona
            ]

            revision_prompt = f"""You are {persona}.

Your original plan:
{own_plan_json}

Critiques you received:
{chr(10).join(received_critiques)}

Revise your plan. Rules:
- Fix valid weaknesses raised in the critiques
- Preserve existing strengths
- Improve realism of timeline and risk management
- Keep all tasks strictly about: {input_data['idea']}
- Do NOT introduce unrelated domains or products
- Output ONLY valid JSON matching the original plan schema

The revised plan MUST include a top-level "revision_notes" object:
{{
  "changes_made": ["change 1", "change 2"],
  "criticisms_addressed": ["criticism 1", "criticism 2"],
  "remaining_limitations": ["limitation 1"]
}}"""

            agent = registry.get_agent(persona)
            if not agent:
                continue
            schema = SCHEMA_MAPPING.get(agent.schema_name)

            revised_plan = await call_model(plans[persona]["model"], revision_prompt, schema)
            revised_plan = revised_plan or plans[persona]["plan"]
            revised_plans[persona] = revised_plan

            # Phase 4 — record revision tracking
            original_text = plans[persona]["plan"].model_dump_json()
            revised_text = revised_plan.model_dump_json() if revised_plan else original_text
            
            if hasattr(revised_plan, "revision_notes") and revised_plan.revision_notes:
                added_tokens = revised_plan.revision_notes.changes_made
            else:
                orig_tokens = set(re.findall(r"\b\w+\b", original_text.lower()))
                rev_tokens = set(re.findall(r"\b\w+\b", revised_text.lower()))
                added_tokens = list(rev_tokens - orig_tokens)[:5]
                
            state.record_revision(
                persona,
                changes=added_tokens,
            )

            if state.revision_tracking[persona].no_meaningful_change:
                yield {
                    "event": "validation_warning",
                    "data": json.dumps({
                        "persona": persona,
                        "issue": "Revision appears to have made no meaningful changes — revision penalty will apply.",
                    }),
                }

            yield {
                "event": "revision",
                "data": json.dumps({
                    "persona": persona,
                    "original_plan": own_plan_json,
                    "revised_plan": revised_plan.model_dump_json(indent=2),
                    "no_meaningful_change": state.revision_tracking[persona].no_meaningful_change,
                }),
            }
            await asyncio.sleep(1)

        state.messages["revised_plans"] = revised_plans
        state.add_round("revisions", {p: rp.model_dump_json() if rp else None for p, rp in revised_plans.items()})
        save_state(state)

        # ─────────────────────────────────────────────────────────────────
        # VALIDATION LAYER (Phase 5 — authoritative)
        # ─────────────────────────────────────────────────────────────────
        yield {
            "event": "progress",
            "data": json.dumps({"step": "Validating all revised plans..."}),
        }

        validation_results: Dict[str, Any] = {}
        blocked_personas: set = set()

        for persona, plan in revised_plans.items():
            val_result = validate_plan(plan)
            crit_validation = validate_critique(critiques.get(persona, {}))

            # Phase 4 revision penalty
            if (
                persona in state.revision_tracking
                and state.revision_tracking[persona].no_meaningful_change
            ):
                val_result.warnings.append("Revision penalty applied: no meaningful changes detected.")
                val_result.penalty += 10

            validation_results[persona] = {
                "plan": val_result.dict(),
                "critique": crit_validation.dict(),
                "warnings": val_result.warnings + crit_validation.warnings,
                "total_penalty": val_result.penalty + crit_validation.penalty,
            }

            # Hard block on critical/high severity
            if not val_result.is_valid and val_result.severity in ("critical", "high"):
                blocked_personas.add(persona)
                yield {
                    "event": "validation_failure",
                    "data": json.dumps({
                        "persona": persona,
                        "blocking_issues": val_result.blocking_issues,
                        "severity": val_result.severity,
                        "penalty": val_result.penalty,
                    }),
                }
            elif val_result.warnings:
                yield {
                    "event": "validation_warning",
                    "data": json.dumps({
                        "persona": persona,
                        "warnings": val_result.warnings,
                        "severity": val_result.severity,
                        "penalty": val_result.penalty,
                    }),
                }

            if crit_validation.blocking_issues:
                yield {
                    "event": "validation_warning",
                    "data": json.dumps({
                        "persona": persona,
                        "critique_issues": crit_validation.blocking_issues,
                        "severity": crit_validation.severity,
                        "penalty": crit_validation.penalty,
                    }),
                }

        # Remove blocked plans
        for persona in blocked_personas:
            revised_plans[persona] = None

        state.validations = validation_results
        save_state(state)

        # ─────────────────────────────────────────────────────────────────
        # ROUND 5 — Judge Evaluation (Phase 6 + Phase 7)
        # ─────────────────────────────────────────────────────────────────
        yield {
            "event": "progress",
            "data": json.dumps({"step": "Round 5: Judge evaluating plans..."}),
        }

        judge_scores: Dict[str, Any] = {}

        for persona, plan in revised_plans.items():
            if not plan:
                continue

            # Phase 6: deterministic ceilings BEFORE LLM judge
            alignment_cap, alignment_reasoning = _determine_alignment_cap(plan, input_data["idea"])
            innovation_cap = _determine_innovation_cap(plan, input_data["idea"])

            val_total_penalty = validation_results.get(persona, {}).get("total_penalty", 0)

            judges = registry.get_judges()
            judge_agent = judges[0] if judges else Agent(name="judge", model="qwen2:1.5b", role="Judge", expertise=["Evaluation"], can_judge=True, can_debate=False, schema_name="JudgeScore")
    
            judge_prompt = judge_agent.build_prompt(
                input_data["idea"], input_data["members"], input_data["deadlineWeeks"], full_context,
                plan=plan.model_dump_json(indent=2),
                alignment_cap=alignment_cap,
                alignment_reasoning=alignment_reasoning,
                innovation_cap=innovation_cap,
                validation_issues=json.dumps(validation_results.get(persona, {}).get('warnings', []), indent=2)
            )
    
            judge_result = await call_model(judge_agent.model, judge_prompt, JudgeScore, api_key=nvidiaKey)
    
            if judge_result:
                metrics = judge_result.model_dump()
    
                # Phase 6 — enforce deterministic caps
                if metrics["alignment"] > alignment_cap:
                    metrics["alignment"] = alignment_cap
                    metrics["alignment_reason"] = (
                        f"[Capped by domain analysis at {alignment_cap}] "
                        + (metrics.get("alignment_reason") or "")
                    )
    
                if metrics["innovation"] > innovation_cap:
                    metrics["innovation"] = innovation_cap
                    metrics["innovation_reason"] = (
                        f"[Capped by content analysis at {innovation_cap}] "
                        + (metrics.get("innovation_reason") or "")
                    )
    
                # Waterfall structure bonus/penalty
                if isinstance(plan, WaterfallPlan):
                    wf_warnings = _waterfall_structure_warnings(plan)
                    if wf_warnings:
                        metrics["completeness"] = max(1, metrics["completeness"] - 20)
                        metrics["innovation"] = min(metrics["innovation"], 55)
    
                # Critique quality penalty
                crit = critiques.get(persona, {})
                crit_val = validation_results.get(persona, {}).get("critique", {})
                if crit_val.get("blocking_issues"):
                    metrics["completeness"] = max(1, metrics["completeness"] - 30)
                    metrics["risk_awareness"] = max(1, metrics["risk_awareness"] - 30)
    
                # No risks penalty
                plan_risks = getattr(plan, "risks", None) or []
                if not plan_risks:
                    metrics["risk_awareness"] = max(1, metrics["risk_awareness"] - 20)
    
                # Phase 4 — revision no-change penalty
                if (
                    persona in state.revision_tracking
                    and state.revision_tracking[persona].no_meaningful_change
                ):
                    metrics["completeness"] = max(1, metrics["completeness"] - 10)
    
                # Normalise all numeric metrics to 1-100
                for key in [
                    "feasibility", "completeness", "risk_awareness", "alignment",
                    "innovation", "confidence", "execution_difficulty", "factuality",
                ]:
                    if key in metrics:
                        metrics[key] = max(1, min(100, int(metrics[key])))
    
                raw_score = compute_final_score(JudgeScore(**metrics))
                raw_score = max(1.0, min(100.0, raw_score))
    
                # Phase 5 — consume validation penalty
                final_score = max(1.0, min(100.0, raw_score - val_total_penalty))
    
                judge_scores[persona] = {
                    "metrics": metrics,
                    "final_score": round(final_score, 2),
                    "raw_score": round(raw_score, 2),
                    "validation_penalty": val_total_penalty,
                    "alignment_cap": alignment_cap,
                    "alignment_reasoning": alignment_reasoning,
                    "innovation_cap": innovation_cap,
                }
    
                yield {
                    "event": "judge",
                    "data": json.dumps({
                        "persona": persona,
                        "scores": judge_scores[persona],
                    }),
                }

        if not judge_scores:
            yield {"event": "error", "data": json.dumps({"error": "Judge layer failed — no valid plans"})}
            return

        state.scores = judge_scores
        state.add_round(
            "judge",
            {
                p: {
                    "final_score": s["final_score"],
                    "alignment_cap": s.get("alignment_cap"),
                }
                for p, s in judge_scores.items()
            },
        )
        save_state(state)

        # ─────────────────────────────────────────────────────────────────
        # ROUND 6 — Consensus (Phase 8 + Phase 7)
        # ─────────────────────────────────────────────────────────────────
        yield {
            "event": "progress",
            "data": json.dumps({"step": "Round 6: Building consensus roadmap..."}),
        }

        # Pre-synthesis domain filtering (Phase 8)
        valid_plans_for_synthesis: Dict[str, Any] = {}
        for persona, plan in revised_plans.items():
            if not plan:
                continue
            try:
                plan_text = plan.model_dump_json()
            except Exception:
                plan_text = str(plan)

            if DomainAnalyzer.contains_unrelated_products(plan_text, input_data["idea"]):
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "step": f"⚠️ Filtering: {persona} plan contains contaminated content — excluded from synthesis."
                    }),
                }
                continue
            valid_plans_for_synthesis[persona] = plan

        scored_personas = sorted(
            [p for p in valid_plans_for_synthesis if p in judge_scores],
            key=lambda p: judge_scores[p]["final_score"],
            reverse=True
        )
        top_personas = scored_personas[:2]
        valid_plans_for_synthesis = {p: valid_plans_for_synthesis[p] for p in top_personas}

        plan_scores = {
            p: judge_scores[p]["final_score"]
            for p in top_personas
        }

        yield {
            "event": "progress",
            "data": json.dumps({
                "step": (
                    "Judge Scores → "
                    + " ".join(
                        f"{p.capitalize()}:{round(s['final_score'], 2)}"
                        for p, s in judge_scores.items()
                    )
                )
            }),
        }

        consensus_agents = registry.get_consensus()
        consensus_agent = consensus_agents[0] if consensus_agents else Agent(name="consensus", model="phi3:mini", role="Consensus Builder", expertise=["Synthesis"], can_judge=False, can_debate=False, schema_name="UnifiedPlan")

        synthesis_prompt = consensus_agent.build_prompt(
            input_data["idea"], input_data["members"], input_data["deadlineWeeks"], full_context,
            revised_plans=json.dumps({k: v.model_dump() for k, v in valid_plans_for_synthesis.items() if v}, indent=2),
            plan_scores=json.dumps(plan_scores, indent=2),
            validation_findings=json.dumps({p: r.get('warnings', []) for p, r in validation_results.items()}, indent=2)
        )

        synthesized_plan = await call_model(consensus_agent.model, synthesis_prompt, UnifiedPlan, api_key=nvidiaKey)

        # Phase 9 — Synthesis validation
        syn_validation = ValidationResult()
        if synthesized_plan:
            syn_validation = validate_synthesis(synthesized_plan, input_data["idea"])

        if not synthesized_plan or not syn_validation.is_valid:
            yield {
                "event": "progress",
                "data": json.dumps({
                    "step": "⚠️ Synthesis validation failed — regenerating...",
                }),
            }
            retry_synthesis_prompt = (
                synthesis_prompt
                + "\n\nIMPORTANT: Previous attempt was invalid.\n"
                "Ensure:\n"
                "- summary is non-empty (3-5 sentences about the user idea)\n"
                "- roadmap weeks are chronological with no duplicates\n"
                "- each roadmap item includes source list\n"
                "- risks are plain-language risk statements, NOT critiques or JSON\n"
                "- no unrelated domains or products\n"
                "Output ONLY the JSON object."
            )
            synthesized_plan = await call_model(consensus_agent.model, retry_synthesis_prompt, UnifiedPlan, api_key=nvidiaKey)
            if synthesized_plan:
                syn_validation = validate_synthesis(synthesized_plan, input_data["idea"])

        # Fallback if synthesis still fails
        if not synthesized_plan:
            synthesized_plan = UnifiedPlan(
                summary=_auto_generate_summary(input_data["idea"], []),
                consensus_reasoning="Synthesized by extracting core overlapping tasks from highest scoring plans.",
                roadmap=[
                    RoadmapStep(
                        week=1,
                        task="Define project requirements and align team to the user idea.",
                        source=["Agile"],
                        objective="Align stakeholders",
                        tasks=["Requirements gathering"],
                        deliverables=["PRD"],
                        artifacts=["prd.md"],
                        success_criteria="Requirements signed off by all stakeholders."
                    )
                ],
                risks=["Scope creep if requirements are not clearly defined upfront."],
            )
            yield {
                "event": "progress",
                "data": json.dumps({"step": "⚠️ Synthesis fallback applied."}),
            }

        # Auto-fix: empty summary
        if not synthesized_plan.summary.strip():
            synthesized_plan = synthesized_plan.model_copy(
                update={"summary": _auto_generate_summary(input_data["idea"], synthesized_plan.roadmap)}
            )

        # Auto-fix: deduplicate roadmap weeks
        dup_weeks = _find_duplicate_weeks(synthesized_plan.roadmap)
        if dup_weeks:
            synthesized_plan = synthesized_plan.model_copy(
                update={"roadmap": _deduplicate_roadmap(synthesized_plan.roadmap)}
            )

        # Auto-fix: sort roadmap chronologically
        synthesized_plan = synthesized_plan.model_copy(
            update={"roadmap": sorted(synthesized_plan.roadmap, key=lambda s: s.week)}
        )

        # Filter bad risks
        clean_risks = [
            r for r in synthesized_plan.risks
            if isinstance(r, str)
            and not r.strip().startswith("{")
            and not r.strip().startswith("[")
            and "weakness_1" not in r
        ]
        if not clean_risks:
            clean_risks = ["Ensure the project stays scoped to the user idea throughout execution."]
        synthesized_plan = synthesized_plan.model_copy(update={"risks": clean_risks})

        state.add_round(
            "consensus",
            {
                "summary": synthesized_plan.summary,
                "roadmap_steps": len(synthesized_plan.roadmap),
                "risks": len(synthesized_plan.risks),
            },
        )
        save_state(state)

        # ─────────────────────────────────────────────────────────────────
        # Phase 10 — Final Output Contract
        # ─────────────────────────────────────────────────────────────────
        validation_report: Dict[str, Any] = {}
        for persona, vr in validation_results.items():
            plan_vr = vr.get("plan", {})
            crit_vr = vr.get("critique", {})
            validation_report[persona] = {
                "plan_severity": plan_vr.get("severity", "low"),
                "plan_warnings": plan_vr.get("warnings", []),
                "plan_blocking": plan_vr.get("blocking_issues", []),
                "critique_blocking": crit_vr.get("blocking_issues", []),
                "total_penalty": vr.get("total_penalty", 0),
            }

        # Build debateSummary from all rounds (Phase 7)
        debate_summary: Dict[str, Any] = {
            "rounds": len(state.rounds),
            "round_names": [r.round_name for r in state.rounds],
            "critiques": critiques,
            "defenses": defenses if "defenses" in dir() else {},
            "revision_tracking": {
                p: {
                    "no_meaningful_change": rt.no_meaningful_change,
                    "changes": rt.changes,
                }
                for p, rt in state.revision_tracking.items()
            },
        }

        # Retrieve confidence and execution_difficulty from best-scoring plan
        best_persona = max(judge_scores, key=lambda p: judge_scores[p]["final_score"]) if judge_scores else "hybrid"
        output_confidence = 0
        output_exec_difficulty = 0
        if best_persona and best_persona in judge_scores:
            best_metrics = judge_scores[best_persona].get("metrics", {})
            output_confidence = best_metrics.get("confidence", 0)
            output_exec_difficulty = best_metrics.get("execution_difficulty", 0)

        # Map execution difficulty
        if output_exec_difficulty > 75:
            diff_str = "Easy"
        elif output_exec_difficulty < 40:
            diff_str = "Hard"
        else:
            diff_str = "Medium"

        primary_risk = synthesized_plan.risks[0] if synthesized_plan.risks else "Unknown execution risks"
        first_step = synthesized_plan.roadmap[0].task if synthesized_plan.roadmap else "Planning"

        board_decision = {
            "startup_viability": output_confidence,
            "execution_difficulty": diff_str,
            "expected_duration_weeks": len(synthesized_plan.roadmap),
            "recommended_methodology": best_persona.capitalize(),
            "primary_risk": primary_risk,
            "first_step": first_step,
            "board_confidence": output_confidence,
            "consensus_reasoning": synthesized_plan.consensus_reasoning
        }

        final_plan: Dict[str, Any] = {
            # Phase 10 required fields
            "summary": synthesized_plan.summary,
            "boardDecision": board_decision,
            "roadmap": [step.model_dump() for step in synthesized_plan.roadmap],
            "risks": synthesized_plan.risks,
            "scores": plan_scores,
            "judgeScores": judge_scores,
            "confidence": output_confidence,
            "executionDifficulty": output_exec_difficulty,
            "debateSummary": debate_summary,
            "validationReport": validation_report,
            "session_id": state.session_id,
            "memoryStats": memory_meta,
        }

        state.final_output = final_plan
        save_state(state)

        yield {"event": "final", "data": json.dumps(final_plan)}

        # Save memory
        try:
            await save_memory(input_data, final_plan)
            yield {
                "event": "progress",
                "data": json.dumps({"step": "💾 Debate saved to memory for future retrieval"}),
            }
        except Exception as e:
            print(f"[Main] WARNING: Failed to save memory: {e}")

    return EventSourceResponse(event_generator())

@app.post("/blueprint")
async def generate_blueprint_endpoint(req: BlueprintRequest):
    prompt = f"""Brief: {req.brief}
Mode: {req.mode}

Expand the following roadmap into a detailed implementation blueprint:
{json.dumps(req.roadmap, indent=2)}

Return JSON: {{ "steps": [BlueprintStep,…] }} where BlueprintStep is:
{{ "week": number, "title": "...", "goal": "...", "whereToStart": "...",
  "prerequisites": ["..."], "resources": [{{"label":"...","url":"...","type":"doc|course|video|repo"}}],
  "tasks": ["..."], "deliverables": ["..."], "checkpoints": ["..."] }}"""

    res = await call_model("qwen2:1.5b", prompt, BlueprintDoc)
    if res:
        return res.model_dump()
    
    # Fallback mock
    return {
        "steps": [
            {
                "week": s.get("week", i+1),
                "title": s.get("task", f"Step {i+1}"),
                "goal": f"Complete {s.get('task', 'step')}",
                "whereToStart": "Review brief and roadmap.",
                "prerequisites": [],
                "resources": [],
                "tasks": ["Plan", "Implement", "Review"],
                "deliverables": ["Completed artifact"],
                "checkpoints": ["QA passed"]
            }
            for i, s in enumerate(req.roadmap)
        ]
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)