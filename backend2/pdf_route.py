"""
pdf_route.py — Add this to your FastAPI main.py

Paste the import and the route into your existing main.py.
The endpoint accepts the full session data and returns a downloadable PDF.
"""

# ── Add these imports to your main.py ────────────────────────────────────────
from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import warnings

# Import your pdf_generator (place pdf_generator.py in the same directory as main.py)
from pdf_generator import generate_project_pdf

# ── Request schema ────────────────────────────────────────────────────────────

class PDFRequest(BaseModel):
    idea: str
    stack: str = ""
    team: int = 5
    deadline: int = 12
    project_id: str = ""
    consensus_plan: Dict[str, Any] = {}
    judge_scores: Dict[str, Any] = {}
    methodology_weights: Dict[str, float] = {}

# ── Route ─────────────────────────────────────────────────────────────────────
# If you use APIRouter, add this to your router.
# If you attach directly to `app`, replace `router` with `app`.

router = APIRouter()

@router.post("/generate-pdf")
async def generate_pdf(req: PDFRequest):
    """
    Generate and return a project plan PDF.
    The PDF is returned as a binary response with Content-Disposition: attachment.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pdf_bytes = generate_project_pdf(
            idea=req.idea,
            stack=req.stack,
            team=req.team,
            deadline=req.deadline,
            consensus_plan=req.consensus_plan,
            judge_scores=req.judge_scores,
            methodology_weights=req.methodology_weights,
            project_id=req.project_id,
        )

    safe_name = "".join(c if c.isalnum() or c in "-_ " else "_" for c in req.idea[:40])
    filename = f"AI_Boardroom_{safe_name.strip()}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ── Minimal standalone app for testing ───────────────────────────────────────
# Remove this block once you integrate into your real main.py

if __name__ == "__main__":
    import uvicorn
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(title="AI Boardroom PDF Test")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)

    uvicorn.run(app, host="0.0.0.0", port=8000)
