from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class Agent(BaseModel):
    """Unified representation of an AI agent driven by configuration instead of hardcoded logic."""
    name: str
    role: str
    expertise: str
    model: str
    schema_name: Optional[str] = None
    prompt_template: Optional[str] = None
    
    # Permissions
    can_debate: bool = False
    can_judge: bool = False
    can_synthesize: bool = False
    can_use_memory: bool = False
    
    def build_prompt(self, idea: str, members: int, deadline: int, context: str = "", **kwargs) -> str:
        """Dynamically build the agent's prompt based on its configuration."""
        if self.prompt_template:
            # We use a simple string replacement approach to avoid issues with JSON curly braces in format()
            prompt = self.prompt_template
            replacements = {
                "{idea}": str(idea),
                "{members}": str(members),
                "{deadline}": str(deadline),
                "{context}": str(context)
            }
            for k, v in kwargs.items():
                replacements[f"{{{k}}}"] = str(v)
            
            for k, v in replacements.items():
                prompt = prompt.replace(k, v)
            return prompt

        ctx_block = ""
        if context and self.can_use_memory:
            ctx_block = (
                "\nSupporting retrieved knowledge "
                "(use only as guidance — do not override the user idea):\n"
                f"{context}\n"
            )

        instruction = (
            "IMPORTANT: The USER IDEA is the primary objective. "
            "If retrieved knowledge conflicts with the user idea, ignore it. "
            "Use retrieved knowledge only as supporting guidance.\n"
        )

        return f"""You ARE the {self.role}.

RULES (mandatory):
1. Output a plan solely about: {idea}
2. Apply your specific expertise: {self.expertise}
3. Every task/phase must relate to this idea — do not introduce unrelated domains.
{instruction}{ctx_block}
Project Idea: {idea}
Team: {members}
Deadline: {deadline} weeks

Output ONLY valid JSON."""


class AgentRegistry:
    """Central registry responsible for storing, loading, and filtering agents."""
    
    def __init__(self):
        self._agents: Dict[str, Agent] = {}
        self._load_defaults()
        
    def _load_defaults(self):
        agile = Agent(
            name="agile",
            role="Agile Project Manager",
            expertise="Iteration, MVP, Sprint Planning, Velocity, User Stories. NEVER mention Waterfall phases.",
            model="phi3:mini",
            schema_name="AgilePlan",
            can_debate=True,
            can_use_memory=True
        )
        waterfall = Agent(
            name="waterfall",
            role="Waterfall Project Manager",
            expertise="Sequential Phases, Requirements, System Design, Verification. NEVER mention Agile terms.",
            model="qwen2:1.5b",
            schema_name="WaterfallPlan",
            can_debate=True,
            can_use_memory=True
        )
        hybrid = Agent(
            name="hybrid",
            role="Hybrid Project Manager",
            expertise="Combine Waterfall phases AND Agile iterations explicitly.",
            model="smollm2:1.7b",
            schema_name="HybridPlan",
            can_debate=True,
            can_use_memory=True
        )
        judge = Agent(
            name="judge",
            role="Technical Judge",
            expertise="Evaluation, Scoring, Feasibility Assessment, Alignment Check.",
            model="nvidia/meta/llama-3.1-70b-instruct",
            can_judge=True,
            prompt_template="""Evaluate this project plan.

User Idea: {idea}

Phase 6 Evaluation criteria:
1. Does the plan directly address the user idea?
2. Does it introduce unrelated domains or products? Penalise heavily if yes.
3. Assess feasibility, completeness, risk awareness, alignment, and innovation independently.
4. Do NOT cluster scores — meaningful weaknesses must create meaningful score gaps.
5. Innovation = novel feature or unique capability, NOT standard dev tasks.
   Standard CRUD/features must score below 75 on innovation.
   Reserve 100 for truly exceptional plans.

HARD LIMIT: alignment score CANNOT exceed {alignment_cap} (domain analysis result).
HARD LIMIT: innovation score CANNOT exceed {innovation_cap} (plan content analysis).

Plan:
{plan}

Validation Issues:
{validation_issues}

Return JSON with:
- feasibility (1-100)
- completeness (1-100)
- risk_awareness (1-100)
- alignment (1-100, hard cap = {alignment_cap}: {alignment_reasoning})
- innovation (1-100, hard cap = {innovation_cap})
- confidence (1-100)
- execution_difficulty (1-100, where 1=very difficult, 100=very easy)
- factuality (1-100)
- alignment_reason (string explaining alignment score)
- feasibility_reason (string explaining feasibility score)
- innovation_reason (string explaining innovation score)

Output ONLY JSON."""
        )
        consensus = Agent(
            name="consensus",
            role="Chief Strategy Officer",
            expertise="Synthesis, Roadmapping, Overlap Resolution.",
            model="nvidia/meta/llama-3.1-8b-instruct",
            schema_name="UnifiedPlan",
            can_synthesize=True,
            prompt_template="""You are Chief Strategy Officer building the final consensus plan.

User Idea (MUST be the sole focus): {idea}

Revised Plans (Top Plans):
{revised_plans}

Judge Scores for these Plans:
{plan_scores}

Validation Findings:
{validation_findings}

Phase 8 Consensus Rules:
1. Compare the provided plans — identify overlapping tasks and contradictions.
2. You are provided with plan_scores (which represents the final weighted score = judge_score - validation_penalty). You MUST weight roadmap contributions according to these scores. The highest scoring plan's milestones and timeline should form the primary backbone.
3. ONLY use roadmap items explicitly present in the provided revised_plans. Do NOT invent new tasks. Merge, prioritize, and reorder existing milestones only. Do not create entirely new milestones.
4. Generate a roadmap covering the full project duration.
5. Minimum roadmap entries: {deadline}. One milestone per week. No skipped weeks.
6. Every roadmap item MUST attribute its source explicitly to the original plans (e.g., ["Agile"] or ["Hybrid", "Waterfall"]). NEVER use "Consensus" as a source.
7. Remove duplicate tasks. Remove duplicate weeks. Keep realistic timelines.
8. Risks MUST be concise risk statements — not critiques, not JSON objects, not mitigations.
9. Do NOT introduce new domains or products not in the user idea.
10. Summary MUST be a 3-5 sentence executive summary about this specific idea.
11. You MUST generate a 'consensus_reasoning' field (3-4 sentences) explaining which methodologies were chosen, why they won, and key execution decisions made.
12. For EVERY roadmap week, you MUST provide an objective, a list of tasks, a list of deliverables, a list of mock filenames for generated artifacts, and a success criteria sentence. The mock filenames MUST strictly match the specific domain and technology of the user idea.

Output ONLY this JSON shape:
{{
  "summary": "3-5 sentence executive summary",
  "consensus_reasoning": "Explanation of the merge decisions...",
  "roadmap": [
    {{
      "week": 1, 
      "task": "High level task name", 
      "source": ["Agile"],
      "objective": "Clear goal for the week",
      "tasks": ["Specific sprint task 1", "Specific sprint task 2"],
      "deliverables": ["Business deliverable 1", "Technical deliverable 2"],
      "artifacts": ["schema.sql", "auth_flow.pdf", "main.ts"],
      "success_criteria": "What must be true to mark this week done."
    }}
  ],
  "risks": ["specific risk statement 1", "specific risk statement 2"]
}}

Output ONLY JSON. No preamble. No markdown."""
        )
        
        self.register(agile)
        self.register(waterfall)
        self.register(hybrid)
        self.register(judge)
        self.register(consensus)

    def register(self, agent: Agent):
        self._agents[agent.name.lower()] = agent
        
    def get_agent(self, name: str) -> Optional[Agent]:
        return self._agents.get(name.lower())
        
    def get_all(self) -> List[Agent]:
        return list(self._agents.values())
        
    def get_debaters(self) -> List[Agent]:
        return [a for a in self._agents.values() if a.can_debate]
        
    def get_judges(self) -> List[Agent]:
        return [a for a in self._agents.values() if a.can_judge]
        
    def get_synthesizers(self) -> List[Agent]:
        return [a for a in self._agents.values() if a.can_synthesize]

    def get_consensus(self) -> List[Agent]:
        return self.get_synthesizers()