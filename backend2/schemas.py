from pydantic import BaseModel, Field, RootModel
from typing import List, Optional

class AgileTask(BaseModel):
    week: int
    description: str

class AgileMilestone(BaseModel):
    week: int
    deliverable: str

class RevisionNotes(BaseModel):
    changes_made: List[str] = Field(default_factory=list)
    criticisms_addressed: List[str] = Field(default_factory=list)
    remaining_limitations: List[str] = Field(default_factory=list)
    model_config = {"extra": "ignore"}

class AgilePlan(BaseModel):
    tasks: List[AgileTask]
    milestones: List[AgileMilestone]
    totalDays: int
    risks: Optional[List[str]] = Field(default_factory=list)
    revision_notes: Optional[RevisionNotes] = None
    model_config = {"extra": "ignore"}

class WaterfallPhase(BaseModel):
    phase: str
    days: int

class WaterfallPlan(BaseModel):
    phases: List[WaterfallPhase]
    totalDays: int
    risks: Optional[List[str]] = Field(default_factory=list)
    revision_notes: Optional[RevisionNotes] = None
    model_config = {"extra": "ignore"}

class HybridTask(BaseModel):
    week: int
    description: str

class HybridPlan(BaseModel):
    mvpTasks: List[HybridTask]
    totalDays: int
    risks: Optional[List[str]] = Field(default_factory=list)
    revision_notes: Optional[RevisionNotes] = None
    model_config = {"extra": "ignore"}

class Critique(BaseModel):
    weakness_1: str = Field(min_length=1)
    weakness_2: str = Field(min_length=1)
    impact: str = Field(min_length=1)
    recommendation: str = Field(min_length=1)
    model_config = {"extra": "ignore"}

class JudgeScore(BaseModel):
    feasibility: int
    completeness: int
    risk_awareness: int
    alignment: int
    innovation: int
    confidence: int = 0
    execution_difficulty: int = 0
    factuality: int = 0
    alignment_reason: Optional[str] = ""
    feasibility_reason: Optional[str] = ""
    innovation_reason: Optional[str] = ""
    model_config = {"extra": "ignore"}

class RoadmapStep(BaseModel):
    week: int
    task: str
    source: List[str] = Field(default_factory=list)
    objective: Optional[str] = None
    tasks: List[str] = Field(default_factory=list)
    deliverables: List[str] = Field(default_factory=list)
    artifacts: List[str] = Field(default_factory=list)
    success_criteria: Optional[str] = None

class BoardDecision(BaseModel):
    startup_viability: int
    execution_difficulty: str
    expected_mvp_duration: str
    recommended_methodology: str
    primary_risk: str
    first_step: str
    board_confidence: int
    consensus_reasoning: str

class UnifiedPlan(BaseModel):
    summary: str = Field(..., min_length=20)
    consensus_reasoning: str = Field(default="")
    roadmap: List[RoadmapStep] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    board_decision: Optional[BoardDecision] = None
    model_config = {"extra": "ignore"}

class TagList(RootModel[List[str]]):
    pass
