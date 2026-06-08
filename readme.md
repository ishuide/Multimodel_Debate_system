<div align="center">

```
 ██████╗  ██████╗  █████╗ ██████╗ ██████╗  ██████╗  ██████╗ ███╗   ███╗
 ██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║
 ██████╔╝██║   ██║███████║██████╔╝██║  ██║██║   ██║██║   ██║██╔████╔██║
 ██╔══██╗██║   ██║██╔══██║██╔══██╗██║  ██║██║   ██║██║   ██║██║╚██╔╝██║
 ██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║
 ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝  ╚═════╝╚═╝     ╚═╝
```

**Multi-Agent Decision Intelligence for Project Planning**

*Not one AI opinion. A boardroom of experts.*

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Ollama](https://img.shields.io/badge/Ollama-Local_LLMs-FF6B35?style=flat-square)](https://ollama.ai)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-orange?style=flat-square)](https://www.trychroma.com)
[![License](https://img.shields.io/badge/License-MIT-gold?style=flat-square)](LICENSE)

</div>

---

## What Is AI Boardroom?

AI Boardroom is a **multi-agent project planning platform** that simulates a real executive boardroom. Instead of generating a single AI response, three specialized AI agents independently analyse your project idea, debate each other's approaches, defend their plans, revise based on criticism, and collaboratively build a single consensus execution roadmap.

The result is a **week-by-week project plan** with judge scoring, risk identification, methodology attribution, and a downloadable PDF — generated through structured disagreement, not artificial consensus.

```
Your Idea  →  RAG + Memory  →  [Agile | Waterfall | Hybrid]
                                         ↓
                               Critique  →  Defense  →  Revision
                                         ↓
                               Validation  →  Judge  →  Consensus
                                         ↓
                               Execution Roadmap  +  PDF Export
```

### Why It Works Differently

Most AI planning tools ask one model to produce one plan. AI Boardroom forces **structured disagreement** — three agents with opposing methodologies must compete, get critiqued, defend their positions, and revise before any output reaches you. The judge scoring system applies hard caps from domain analysis so scores can't be inflated by methodology-domain mismatches. The final roadmap is built from the strongest elements of all three plans, with source attribution on every milestone.

---

## The Debate Algorithm — 10 Phases

Every session runs through a deterministic 10-phase pipeline. Here is exactly what happens:

### Phase 1 — Context Retrieval
Before any agent generates a plan, the system retrieves two things in parallel:
- **RAG (Retrieval-Augmented Generation):** Semantic search against a curated knowledge base using `sentence-transformers/all-MiniLM-L6-v2` embeddings stored in ChromaDB. Only chunks with cosine similarity ≥ 0.85 are injected.
- **Memory Recall:** Past debate results are retrieved using the same embedding model, filtered through four gates before injection: semantic similarity, domain confidence (≥ 0.65), domain match score (≥ 0.30), and keyword overlap (≥ 0.10). Bad memory is discarded entirely — contamination is worse than no context.

### Phase 2 — Parallel Plan Generation + Isolation Enforcement
Three agents generate independent plans **simultaneously** via `asyncio.gather`:

| Agent | Model | Methodology | Schema |
|---|---|---|---|
| Agile PM | `phi3:mini` | Sprints, MVP, velocity, user stories | `AgilePlan` |
| Waterfall PM | `qwen2:1.5b` | Sequential phases, requirements, sign-offs | `WaterfallPlan` |
| Hybrid PM | `smollm2:1.7b` | Combined Waterfall phases + Agile iterations | `HybridPlan` |

After generation, `AgentIsolationValidator` scans each plan for **methodology vocabulary leakage** — Agile plans that mention Waterfall phases get flagged and penalised. Contaminated plans are blocked from proceeding unmodified.

### Phase 3 — Critique Round (Enforced)
Each agent critiques the other two plans. The critique schema requires four non-empty fields: `weakness_1`, `weakness_2`, `impact`, and `recommendation`. Generic or malformed critiques are rejected and regenerated (up to 2 attempts). A plan that receives no valid critique cannot proceed.

### Phase 4 — Defense Round
Each agent receives the critiques directed at its plan and generates a structured defense. This forces agents to either justify their decisions with reasoning or implicitly acknowledge weaknesses before revision.

### Phase 5 — Validation Authority
Every plan is independently validated against a `ValidationResult` schema that assigns:
- **Severity level:** `low` | `medium` | `high` | `critical`
- **Penalty points** (capped at 80 per plan — no plan is completely eliminated by validation alone)
- **Blocking issues vs warnings** — blocking issues must be resolved, warnings feed into judge scoring

Checks include: invalid week/day values, duplicate phases, missing risk statements, generic risk labels, mitigations disguised as risks, and domain contamination in roadmap content.

### Phase 6 — Judge Evaluation
An independent judge agent (`qwen2:1.5b`) scores each plan across five dimensions:

| Dimension | What It Measures |
|---|---|
| **Feasibility** | Can this realistically be built with the given team and deadline? |
| **Completeness** | Does it cover all requirements without missing critical phases? |
| **Alignment** | How closely does it match the user's stated idea? |
| **Risk Awareness** | Are execution risks specific, realistic, and actionable? |
| **Innovation** | Is there a novel approach? Standard CRUD scores below 75. |

Two hard caps enforced by `DomainAnalyzer`:
- **Alignment cap**: derived from domain analysis — a plan about the wrong domain can't score above the cap no matter how well-structured it is
- **Innovation cap**: derived from plan content analysis — standard implementation patterns can't score above 75

Final score = judge score − validation penalty.

### Phase 7 — Round Tracking
All six debate rounds (proposals → critiques → defenses → revisions → judge → consensus) are stored in `DebateState` and persisted to disk via JSON. Every session is replayable.

### Phase 8 — Consensus Formation
The Chief Strategy Officer agent (`phi3:mini`) receives the **top-scoring revised plans** (not all three — only plans that passed validation and judge evaluation). It:
- Identifies overlapping tasks across plans
- Weights roadmap contributions by final score — the highest-scoring plan's milestones form the primary backbone
- Merges, deduplicates, and attributes every roadmap milestone to its source methodology
- Must generate one milestone per week for the full project duration

### Phase 9 — Synthesis Validation
The consensus plan is validated before returning to the client. If validation fails, one regeneration attempt is made with the failure reason appended. If that also fails, a deterministic fallback roadmap is applied rather than returning an invalid response.

### Phase 10 — Final Output Contract
The final SSE event (`event: final`) returns a fully-typed output including:
- `summary`, `roadmap`, `risks`, `boardDecision`
- `judgeScores` (per-agent metrics)
- `debateSummary` (round history, critiques, revision tracking)
- `validationReport` (per-agent penalties and warnings)
- `session_id` for memory persistence

---

## Tech Stack

### Backend
| Component | Technology | Purpose |
|---|---|---|
| API Framework | FastAPI | REST + SSE streaming endpoint |
| LLM Runtime | Ollama | Runs local models without API keys |
| Planning Models | phi3:mini, qwen2:1.5b, smollm2:1.7b | The three debating agents + judge |
| Vector Database | ChromaDB | RAG knowledge base + memory store |
| Embeddings | sentence-transformers / all-MiniLM-L6-v2 | Semantic similarity for retrieval |
| Schema Validation | Pydantic v2 | Typed plan schemas, enforced JSON output |
| Session State | JSON (file-based) | Persistent debate round history |
| PDF Generation | ReportLab + Matplotlib | Project plan export with charts |

### Frontend
| Component | Technology | Purpose |
|---|---|---|
| Framework | Next.js 14 (App Router) | Multi-page routing, SSR |
| Styling | Tailwind CSS | Utility-first layout and theming |
| Language | TypeScript | Type-safe component development |
| SSE Streaming | Native Fetch API + ReadableStream | Live debate progress display |
| Fonts | Playfair Display + DM Sans | Display and body typography |

### Project Structure
```
ai-boardroom/
├── backend/
│   ├── main.py               # FastAPI app + 10-phase debate engine
│   ├── agents/
│   │   └── agent.py          # Agent + AgentRegistry (config-driven)
│   ├── domain_analyzer.py    # Domain extraction + isolation validator
│   ├── retriever.py          # ChromaDB RAG + memory (4-gate filtering)
│   ├── state_manager.py      # DebateState persistence
│   ├── project_manager.py    # Versioned project JSON storage
│   ├── schemas.py            # Pydantic schemas for all plan types
│   ├── pdf_generator.py      # PDF export with charts + live resource links
│   ├── pdf_route.py          # /generate-pdf FastAPI endpoint
│   ├── chroma_db/            # ChromaDB persistence (auto-created)
│   ├── state/                # Session state JSON files (auto-created)
│   └── projects/             # Versioned project files (auto-created)
│
└── frontend/                 # Next.js 14 app
    └── src/
        ├── app/
        │   ├── page.tsx              # Landing page
        │   ├── boardroom/page.tsx    # Main session interface
        │   ├── methodologies/page.tsx
        │   ├── architecture/page.tsx
        │   └── resources/page.tsx
        └── components/
            ├── Navbar.tsx
            └── PDFDownloadPanel.tsx
```

---

## How It Was Built — 3 Weeks

This project was built from scratch over three weeks as a solo project.

**Week 1 — Backend Core**
The initial goal was a proof of concept: three Ollama models responding to the same prompt. By end of week 1, the debate loop worked — proposal generation, critique round, defense round, and a basic consensus agent. No validation, no scoring, no memory. Plans frequently hallucinated unrelated domains. This was the most frustrating phase because small models frequently ignored schema constraints.

**Week 2 — Intelligence Layer**
The validation system was the biggest engineering effort. Plans needed to be checked for domain contamination, methodology leakage, duplicate weeks, and malformed risk entries — programmatically, not by the LLM. `DomainAnalyzer` and `AgentIsolationValidator` were built to make these checks deterministic. The judge scoring system came next, with hard caps to prevent inflated alignment scores. ChromaDB was integrated for RAG retrieval, and the 4-gate memory filtering system was built after early tests showed contaminated memories actively harmed plan quality.

**Week 3 — Frontend + Output**
The Next.js frontend was built with a dark luxury aesthetic to match the "boardroom" metaphor. The SSE streaming display shows the debate in real time. The PDF export was the last piece — ReportLab for layout, Matplotlib for charts, and live resource link resolution against npm/PyPI to avoid hallucinated URLs.

---

## Prerequisites

Before cloning, ensure you have:

- **Python 3.10+** — `python --version`
- **Node.js 18+** — `node --version`
- **Ollama** — installed and running: [https://ollama.ai](https://ollama.ai)
- **Git** — `git --version`

---

## Running the Project

### 1 — Clone the repository

```bash
git clone https://github.com/ishuide/isheyme.git
cd isheyme
```

### 2 — Pull the required Ollama models

The debate engine uses three small models. Pull all of them before starting:

```bash
ollama pull phi3:mini
ollama pull qwen2:1.5b
ollama pull smollm2:1.7b
```

Verify they downloaded:

```bash
ollama list
```

### 3 — Set up the Python backend

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate it
# macOS / Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

If `requirements.txt` is not yet present, install manually:

```bash
pip install fastapi uvicorn sse-starlette ollama \
            chromadb sentence-transformers \
            pydantic reportlab matplotlib requests
```

### 4 — Start the backend server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:

```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Verify it's healthy:

```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

### 5 — Set up the frontend

Open a second terminal:

```bash
cd frontend   # or wherever your Next.js project lives

npm install
```

Create the environment file:

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
```

### 6 — Start the frontend dev server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 7 — Run a test session via API (optional)

You can test the debate engine directly without the frontend:

```bash
curl "http://localhost:8000/debate?idea=Task+management+app+for+remote+teams&members=4&deadlineWeeks=10&techStack=Next.js%2C+FastAPI%2C+PostgreSQL"
```

The response will be a stream of SSE events. The final event has `event: final` and contains the full plan as JSON.

---

## API Reference

### `GET /debate`

Starts a multi-agent debate session. Returns a Server-Sent Events stream.

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `idea` | string | Yes | Project description |
| `members` | int | Yes | Team size |
| `deadlineWeeks` | int | Yes | Target deadline in weeks |
| `techStack` | string | No | Comma-separated tech stack |
| `session_id` | string | No | Resume an existing session |

**SSE Event Types**

| Event | Description |
|---|---|
| `progress` | Status update with a `step` string (phase name, memory stats, warnings) |
| `final` | Complete plan JSON with roadmap, scores, validation report, board decision |

**Final event payload shape:**

```json
{
  "summary": "...",
  "boardDecision": {
    "startup_viability": 82,
    "execution_difficulty": "Medium",
    "recommended_methodology": "Hybrid",
    "primary_risk": "...",
    "first_step": "..."
  },
  "roadmap": [
    {
      "week": 1,
      "task": "...",
      "source": ["Agile"],
      "objective": "...",
      "tasks": ["..."],
      "deliverables": ["..."],
      "artifacts": ["..."],
      "success_criteria": "..."
    }
  ],
  "judgeScores": { "agile": {}, "waterfall": {}, "hybrid": {} },
  "risks": ["..."],
  "session_id": "uuid",
  "debateSummary": {},
  "validationReport": {}
}
```

### `POST /generate-pdf`

Generates and returns a downloadable project plan PDF.

**Request Body**

```json
{
  "idea": "string",
  "stack": "string",
  "team": 5,
  "deadline": 12,
  "project_id": "string",
  "consensus_plan": {},
  "judge_scores": {},
  "methodology_weights": { "Agile": 40, "Waterfall": 25, "Hybrid": 35 }
}
```

**Response:** Binary PDF with `Content-Disposition: attachment`.

### `GET /health`

Returns `{"status": "ok"}`. Use this to verify the server is up before starting a session.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL for the frontend |

---

## Forking — What Else Can Be Done

If you fork this project, here are the most valuable directions to explore:

### Swap or add LLM agents
The `AgentRegistry` in `agents/agent.py` is fully config-driven. Adding a new agent requires no changes to the debate engine — register a new `Agent` with a `schema_name`, set `can_debate=True`, and it will be included in future rounds automatically. Strong candidates to add:
- **Risk Analyst agent** — focused exclusively on identifying execution risks
- **DevOps agent** — specialising in CI/CD, infra, and deployment strategy
- **Cost Estimator agent** — translating the roadmap into budget estimates

### Replace Ollama with a cloud API
The `call_model` function in `main.py` wraps `ollama.chat`. Replacing it with an OpenAI, Anthropic, or Groq client changes nothing else in the pipeline. Larger models will produce significantly higher-quality plans — especially for the judge and consensus agents.

### Add a scoring dashboard
The `judgeScores`, `validationReport`, and `debateSummary` fields in the final event payload contain rich per-agent data that the current frontend only partially displays. A dedicated scoring dashboard showing per-round score progression would make the debate process more transparent.

### Expand the RAG knowledge base
The `retriever.py` `ingest_knowledge` function loads documents from a directory. Adding domain-specific knowledge files (software architecture patterns, industry-specific planning frameworks, tech stack guides) directly improves plan quality for those domains without changing any model.

### Build a project history browser
`project_manager.py` already implements versioned project storage with `save_project_version` and `get_project_history`. A `/projects` page that lists past sessions and lets you diff roadmaps across versions is a natural next feature.

### Export to other formats
The PDF generator uses ReportLab. The same structured output (`roadmap`, `judgeScores`, `risks`) could also be exported to:
- **Notion** via the Notion API — import the roadmap as a database
- **Linear / Jira** — create issues from roadmap tasks automatically
- **Google Slides** — generate a pitch deck from the board decision and summary

### Deploy it
For production deployment:
- Frontend: deploy to Vercel (`vercel deploy` from the `frontend/` directory)
- Backend: containerise with Docker and deploy to Railway, Render, or a VPS
- Replace Ollama with a cloud LLM API (the local models are only for running offline)
- Replace file-based state with PostgreSQL + Redis for concurrent sessions

---

## Known Limitations

- **Small model quality:** `smollm2:1.7b` and `qwen2:1.5b` occasionally produce malformed JSON or ignore schema constraints. The validation and regeneration layers handle most of these cases, but complex ideas sometimes trigger fallback responses.
- **Session concurrency:** State is stored as JSON files. Multiple simultaneous sessions work but are not optimised for high concurrency.
- **Memory cold start:** The first session has no memory to retrieve. Quality of memory-assisted sessions improves after 3–5 sessions on related topics.
- **PDF resource links:** npm and PyPI lookups have a 5-second timeout per package. Unusual stack names may not resolve and are omitted rather than guessed.

---

## Contributing

Pull requests are welcome. If you're adding a new agent, a new export format, or an alternative LLM backend — open an issue first to describe the change. The core debate pipeline phases are numbered and documented; any change to phase behaviour should maintain the numbered phase comments in `main.py`.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built by [ishuide](https://github.com/ishuide/isheyme) · 3 weeks · 100% local LLMs

</div>
Javascript for we are focused on a fast, lightweight server with simple SSE streaming.
