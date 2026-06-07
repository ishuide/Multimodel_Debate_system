"""
Domain Analyzer: Extract and compare project domains for memory filtering and judge validation.

Purpose: Deterministic domain analysis to prevent memory contamination and ensure
judge scores properly reflect alignment with user ideas.

Changes in this refactor:
- PHASE 1: Expanded DOMAIN_KEYWORDS with more coverage (voice, language, crm, saas)
- PHASE 1: extract_domain_from_idea / extract_domain_from_plan now return richer metadata
- PHASE 6: domain_match_score tuned to handle partial overlaps more precisely
- PHASE 2: AgentIsolationValidator added — detects persona methodology leakage
- Bug fix: extract_domain_from_plan was silently returning empty key_terms for short plans
- Dead code removed: DomainAnalyzer was never instantiated as an object; all methods are static
"""

import re
from typing import List, Set, Tuple, Optional, Dict, Any
import json


# ---------------------------------------------------------------------------
# Forbidden methodology vocabulary used by AgentIsolationValidator (Phase 2)
# ---------------------------------------------------------------------------
AGILE_FORBIDDEN_IN_WATERFALL: List[str] = [
    "scrum", "sprint", "backlog", "standup", "velocity", "user story",
    "kanban", "retro", "retrospective", "daily standup", "iteration",
    "burn-down", "burndown", "burnup", "story points",
]

WATERFALL_FORBIDDEN_IN_AGILE: List[str] = [
    "waterfall phase", "requirements phase", "design phase",
    "implementation phase", "verification phase", "deployment phase",
    "sign-off", "gate review", "sequential phase",
]

HYBRID_REQUIRED_SIGNALS: List[str] = [
    "agile", "waterfall", "iterative", "phase", "sprint",
    "requirements", "mvp", "milestone",
]


class AgentIsolationValidator:
    """Validates that each persona's plan does not leak methodology vocabulary (Phase 2)."""

    @staticmethod
    def validate_agile(plan_text: str) -> List[str]:
        """Return list of violations if Waterfall vocabulary appears in an Agile plan."""
        text_lower = plan_text.lower()
        return [
            f"Agile plan uses Waterfall terminology: '{term}'"
            for term in WATERFALL_FORBIDDEN_IN_AGILE
            if term in text_lower
        ]

    @staticmethod
    def validate_waterfall(plan_text: str) -> List[str]:
        """Return list of violations if Agile vocabulary appears in a Waterfall plan."""
        text_lower = plan_text.lower()
        return [
            f"Waterfall plan uses Agile terminology: '{term}'"
            for term in AGILE_FORBIDDEN_IN_WATERFALL
            if term in text_lower
        ]

    @staticmethod
    def validate_hybrid(plan_text: str) -> List[str]:
        """Return violations if Hybrid plan does not explicitly reference BOTH methodologies."""
        text_lower = plan_text.lower()
        has_agile = any(t in text_lower for t in ["agile", "sprint", "iteration", "mvp", "backlog"])
        has_waterfall = any(t in text_lower for t in ["waterfall", "phase", "requirements", "design", "deployment"])
        violations = []
        if not has_agile:
            violations.append("Hybrid plan is missing Agile methodology signals (sprint, iteration, MVP, backlog)")
        if not has_waterfall:
            violations.append("Hybrid plan is missing Waterfall methodology signals (phase, requirements, design, deployment)")
        return violations

    @classmethod
    def validate(cls, persona_type: str, plan_text: str) -> Dict[str, Any]:
        """Run methodology isolation check for the given persona type.

        Returns:
            {
                "persona_type": str,
                "violations": List[str],
                "is_isolated": bool
            }
        """
        violations: List[str] = []
        if persona_type == "agile":
            violations = cls.validate_agile(plan_text)
        elif persona_type == "waterfall":
            violations = cls.validate_waterfall(plan_text)
        elif persona_type == "hybrid":
            violations = cls.validate_hybrid(plan_text)

        return {
            "persona_type": persona_type,
            "violations": violations,
            "is_isolated": len(violations) == 0,
        }


class DomainAnalyzer:
    """Analyzes and compares project domains to prevent contamination."""

    # ---------------------------------------------------------------------------
    # Phase 1 enhancement: expanded domain keywords to cover all 5 success criteria
    # and common adjacent domains that cause cross-contamination.
    # ---------------------------------------------------------------------------
    DOMAIN_KEYWORDS: Dict[str, List[str]] = {
        "blockchain": [
            "blockchain", "cryptocurrency", "crypto", "bitcoin", "ethereum",
            "smart contract", "distributed ledger", "nft", "defi", "web3",
            "token", "wallet", "mining", "consensus", "decentralized",
        ],
        "certificate": [
            "certificate", "certification", "credential", "verification",
            "badge", "accreditation", "diploma", "attestation",
        ],
        "parking": [
            "parking", "vehicle", "car", "lot", "space", "transportation",
            "garage", "valet", "spot finder", "sensor", "occupancy",
        ],
        "medical": [
            "medical", "doctor", "patient", "hospital", "clinic", "diagnosis",
            "symptom", "disease", "health", "medicine", "prescription",
            "telemedicine", "ehr", "electronic health record", "radiology",
        ],
        "fruit": [
            "fruit", "bowl", "recipe", "ingredient", "cooking",
            "food preparation", "meal", "nutrition", "diet",
        ],
        "resume": [
            "resume", "cv", "recruitment", "recruiter", "hiring",
            "applicant", "candidate", "hr", "talent acquisition",
            "job posting", "ats", "applicant tracking",
        ],
        "ai": [
            "ai", "artificial intelligence", "machine learning", "neural",
            "algorithm", "ml model", "deep learning", "nlp",
            "natural language processing", "computer vision",
        ],
        "marketplace": [
            "marketplace", "e-commerce", "ecommerce", "store", "shop",
            "seller", "buyer", "listing", "auction",
        ],
        "social": [
            "social", "social media", "facebook", "twitter", "instagram",
            "network", "feed", "follower", "post", "like",
        ],
        "mobile": [
            "mobile", "ios", "android", "smartphone", "flutter",
            "react native", "push notification",
        ],
        # --- NEW domains added for success criteria coverage ---
        "language_learning": [
            "language learning", "language app", "voice based", "speech",
            "pronunciation", "vocabulary", "grammar", "translation",
            "bilingual", "polyglot", "lingua", "duolingo",
        ],
        "crm": [
            "crm", "customer relationship", "sales pipeline", "lead",
            "contact management", "deal", "opportunity", "account management",
            "saas crm", "salesforce", "hubspot",
        ],
        "saas": [
            "saas", "software as a service", "subscription", "tenant",
            "multi-tenant", "b2b", "enterprise software",
        ],
        "fintech": [
            "fintech", "payment", "transaction", "invoice", "billing",
            "wallet", "bank", "finance", "loan", "credit",
        ],
    }

    @staticmethod
    def extract_domain_keywords(text: str) -> Set[str]:
        """Extract domain keywords from text, returning matching domain categories."""
        text_lower = text.lower()
        keywords: Set[str] = set()

        for domain, terms in DomainAnalyzer.DOMAIN_KEYWORDS.items():
            for term in terms:
                if term in text_lower:
                    keywords.add(domain)
                    break

        return keywords

    @staticmethod
    def extract_domain_from_idea(idea: str) -> Dict[str, Any]:
        """Extract domain information from user idea.

        Returns:
            {
                "primary_domain": str | None,
                "all_domains": Set[str],
                "key_terms": List[str],
                "confidence": float (0-1)
            }
        """
        domains = DomainAnalyzer.extract_domain_keywords(idea)

        # Extract meaningful key terms (> 3 chars)
        key_terms = [t.strip() for t in re.findall(r"\b[a-z]\w+\b", idea.lower()) if len(t) > 3]

        # Determine primary domain using priority ordering
        priority_order = [
            "blockchain", "certificate", "parking", "medical", "language_learning",
            "crm", "saas", "resume", "marketplace", "fintech",
            "ai", "mobile", "social", "fruit",
        ]
        primary = None
        for domain in priority_order:
            if domain in domains:
                primary = domain
                break

        # Higher confidence when a specific primary domain is detected
        confidence = 0.9 if primary else 0.4

        return {
            "primary_domain": primary,
            "all_domains": domains,
            "key_terms": key_terms[:10],
            "confidence": confidence,
        }

    @staticmethod
    def extract_domain_from_plan(plan: Any) -> Dict[str, Any]:
        """Extract domain information from a generated plan."""
        # Safely serialise plan to text
        try:
            plan_json = plan.model_dump_json() if hasattr(plan, "model_dump_json") else str(plan)
        except Exception:
            plan_json = str(plan)

        domains = DomainAnalyzer.extract_domain_keywords(plan_json)

        key_terms = [t.strip() for t in re.findall(r"\b[a-z]\w+\b", plan_json.lower()) if len(t) > 3]

        priority_order = [
            "blockchain", "certificate", "parking", "medical", "language_learning",
            "crm", "saas", "resume", "marketplace", "fintech",
            "ai", "mobile", "social", "fruit",
        ]
        primary = None
        for domain in priority_order:
            if domain in domains:
                primary = domain
                break

        return {
            "primary_domain": primary,
            "all_domains": domains,
            "key_terms": key_terms[:10],
            "confidence": 0.8 if primary else 0.4,
        }

    @staticmethod
    def domain_match_score(idea_domain: Dict[str, Any], plan_domain: Dict[str, Any]) -> float:
        """Calculate domain match score (0.0 – 1.0).

        Scoring:
            1.0  — same specific primary domain
            0.7+ — partial overlap (shared domains)
            0.3  — one side has no detected domain
            0.0  — completely unrelated specific domains
        """
        idea_domains: Set[str] = idea_domain.get("all_domains", set())
        plan_domains: Set[str] = plan_domain.get("all_domains", set())
        idea_primary = idea_domain.get("primary_domain")
        plan_primary = plan_domain.get("primary_domain")

        # If either side has no domain detected we cannot confirm alignment
        if not idea_domains or not plan_domains:
            return 0.5

        # Perfect match on primary domain
        if idea_primary and idea_primary == plan_primary:
            return 1.0

        # Partial overlap
        overlap = idea_domains & plan_domains
        if overlap:
            jaccard = len(overlap) / max(len(idea_domains), len(plan_domains))
            return round(0.65 + 0.35 * jaccard, 4)

        # No overlap between two specific domains = contamination
        return 0.0

    @staticmethod
    def contains_unrelated_products(text: str, idea: str) -> bool:
        """Return True when text contains domain signals absent from the idea.

        A plan is contaminated if it references a specific product domain
        that was never part of the user idea.
        """
        idea_lower = idea.lower()
        text_lower = text.lower()

        # Detect domains present in the generated text
        detected_in_text: Set[str] = set()
        for domain, terms in DomainAnalyzer.DOMAIN_KEYWORDS.items():
            for term in terms:
                if term in text_lower:
                    detected_in_text.add(domain)
                    break

        # Detect domains present in the idea
        idea_domains: Set[str] = set()
        for domain, terms in DomainAnalyzer.DOMAIN_KEYWORDS.items():
            for term in terms:
                if term in idea_lower:
                    idea_domains.add(domain)
                    break

        # --- Hard forbidden pairings that should NEVER mix ---
        forbidden_pairs: List[Tuple[str, str]] = [
            ("fruit", "blockchain"),
            ("fruit", "medical"),
            ("fruit", "parking"),
            ("fruit", "resume"),
            ("fruit", "crm"),
            ("medical", "blockchain"),
            ("medical", "parking"),
            ("medical", "fruit"),
            ("parking", "fruit"),
            ("resume", "medical"),
            ("resume", "fruit"),
        ]
        idea_info = DomainAnalyzer.extract_domain_from_idea(idea)

        plan_info = DomainAnalyzer.extract_domain_from_plan(text)

        score = DomainAnalyzer.domain_match_score(
            idea_info,
            plan_info
        )

        if score >= 0.6:
            return False
        
        for domain_a, domain_b in forbidden_pairs:
            if domain_a in detected_in_text and domain_b in detected_in_text:
                if domain_a not in idea_domains and domain_b not in idea_domains:
                    print("\n===== DOMAIN CHECK =====")
                    print("MATCH SCORE:", score)
                    print("Idea Domains:", idea_domains)
                    print("Detected Domains:", detected_in_text)
                    print("Difference:", detected_in_text - idea_domains)
                    print("========================\n")
                    return True

        # --- Unrelated major domain injected into the plan but absent from idea ---
        high_risk_injection_domains = {"medical", "fruit"}
        for domain in detected_in_text - idea_domains:
            if domain in high_risk_injection_domains:
                print("\n===== DOMAIN CHECK =====")
                print("MATCH SCORE:", score)
                print("Idea Domains:", idea_domains)
                print("Detected Domains:", detected_in_text)
                print("Difference:", detected_in_text - idea_domains)
                print("========================\n")
                return True

        return False

    @staticmethod
    def get_domain_metadata(idea: str, plan: Any) -> Dict[str, Any]:
        """Get comprehensive domain metadata for storage and filtering."""
        idea_domain = DomainAnalyzer.extract_domain_from_idea(idea)
        plan_domain = DomainAnalyzer.extract_domain_from_plan(plan)

        match_score = DomainAnalyzer.domain_match_score(idea_domain, plan_domain)

        try:
            plan_text = plan.model_dump_json() if hasattr(plan, "model_dump_json") else str(plan)
        except Exception:
            plan_text = str(plan)

        return {
            "idea_domain": idea_domain,
            "plan_domain": plan_domain,
            "alignment_score": match_score,
            "is_contaminated": DomainAnalyzer.contains_unrelated_products(plan_text, idea),
        }


def extract_project_domain(idea: str) -> str:
    """Simple helper to get primary domain string."""
    domain_info = DomainAnalyzer.extract_domain_from_idea(idea)
    return domain_info["primary_domain"] or "general"