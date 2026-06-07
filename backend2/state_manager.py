"""
State Manager: Persistent debate session state.

Changes in this refactor:
- PHASE 4: Added revision_tracking dict to record original_score, revised_score, changes per persona
- PHASE 7: Added debate_rounds list to store all round outputs (proposals → critiques → defenses → revisions → judge → consensus)
- PHASE 10: Added final_output dict to cache the validated final output contract
- Bug fix: quality_warnings was typed as list[str] (lowercase) — changed to List[str] for Python 3.8 compat
- Bug fix: DebateState.dict() is deprecated in Pydantic v2; replaced with model_dump() with v1 compat shim
"""

import os
import json
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

STATE_DIR = os.path.join(os.path.dirname(__file__), "state")
os.makedirs(STATE_DIR, exist_ok=True)


class DebateRound(BaseModel):
    """Stores a single round's output for the multi-round debate (Phase 7)."""
    round_number: int
    round_name: str  # e.g. "proposals", "critiques", "defenses", "revisions", "judge", "consensus"
    data: Dict[str, Any] = Field(default_factory=dict)


class RevisionTracking(BaseModel):
    """Tracks original vs. revised plan for each persona (Phase 4)."""
    original_score: Optional[float] = None
    revised_score: Optional[float] = None
    changes: List[str] = Field(default_factory=list)
    # True if the revision added no meaningful changes (triggers penalty in judge)
    no_meaningful_change: bool = False


class DebateState(BaseModel):
    """Persistent state for a multi-round debate session.

    Attributes:
        session_id:         Unique identifier for the debate session.
        round_number:       Current debate round (starting at 1).
        agents:             List of agent names participating.
        messages:           Structured messages (e.g., proposals, critiques, revisions) per agent.
        validations:        Mapping of agent name to validation result dicts.
        scores:             Mapping of agent name to judge score dicts.
        quality_warnings:   List of quality control warnings accumulated during session.
        revision_tracking:  Per-agent revision comparison data (Phase 4).
        rounds:             Ordered list of all debate round outputs (Phase 7).
        final_output:       The validated final output contract (Phase 10).
    """
    session_id: str = Field(default_factory=lambda: "")
    round_number: int = 1

    agents: List[str] = Field(default_factory=list)
    messages: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    validations: Dict[str, Any] = Field(default_factory=dict)
    scores: Dict[str, Any] = Field(default_factory=dict)

    quality_warnings: List[str] = Field(default_factory=list)

    # Phase 4 — revision comparison
    revision_tracking: Dict[str, RevisionTracking] = Field(default_factory=dict)

    # Phase 7 — full debate round history
    rounds: List[DebateRound] = Field(default_factory=list)

    # Phase 10 — cached final output
    final_output: Dict[str, Any] = Field(default_factory=dict)

    def add_round(self, round_name: str, data: Dict[str, Any]) -> None:
        """Append a completed round to the debate history."""
        self.rounds.append(
            DebateRound(
                round_number=len(self.rounds) + 1,
                round_name=round_name,
                data=data,
            )
        )

    def record_revision(
        self,
        persona: str,
        changes: List[str],
        original_score: Optional[float] = None,
        revised_score: Optional[float] = None,
    ) -> None:
        """Record revision tracking data for a persona (Phase 4)."""
        no_meaningful = len(changes) == 0 or all(
            c.strip().lower() in {"", "no changes", "none", "n/a"} for c in changes
        )
        self.revision_tracking[persona] = RevisionTracking(
            original_score=original_score,
            revised_score=revised_score,
            changes=changes,
            no_meaningful_change=no_meaningful,
        )


def _state_filepath(session_id: str) -> str:
    """Return the file path for a given session's state JSON file."""
    safe_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", session_id)
    return os.path.join(STATE_DIR, f"{safe_id}.json")


def load_state(session_id: str) -> DebateState:
    """Load the DebateState for the given session ID.

    Falls back to a fresh state if the file is absent or corrupted.
    """
    path = _state_filepath(session_id)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return DebateState(**data)
        except Exception:
            pass
    return DebateState(session_id=session_id)


def save_state(state: DebateState) -> None:
    """Persist the given DebateState to disk."""
    path = _state_filepath(state.session_id)
    with open(path, "w", encoding="utf-8") as f:
        # model_dump() is Pydantic v2; fall back to dict() for v1
        try:
            payload = state.model_dump()
        except AttributeError:
            payload = state.dict()
        json.dump(payload, f, indent=2)


# ---------------------------------------------------------------------------
# Lazy import to avoid circular dependency (state_manager ← domain_analyzer)
# ---------------------------------------------------------------------------
import re  # noqa: E402  (needed for _state_filepath sanitisation above)