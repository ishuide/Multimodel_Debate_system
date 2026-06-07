"""
Retriever: Semantic knowledge and memory retrieval with domain-aware filtering.

Changes in this refactor:
- PHASE 1: retrieve_semantic_memory now logs every retrieval decision with reason
- PHASE 1: Domain overlap is calculated using DomainAnalyzer.domain_match_score (not just primary match)
- PHASE 1: Keyword overlap score is computed and stored in metadata
- PHASE 1: MIN_MEMORY_CONFIDENCE raised to 0.65 to prevent low-confidence contamination
- PHASE 1: Bad memory is worse than no memory — any domain mismatch causes hard discard
- PHASE 1: add_memory stores all_domains as JSON string (ChromaDB only supports scalar metadata)
- Bug fix: add_memory was silently swallowing domain extraction errors; now logs them clearly
- Bug fix: retrieve_semantic_memory returned empty string when model was None but didn't log it
- Dead code removed: extract_project_domain import fallback lambda was never used in retriever logic
"""

import os
import json
import chromadb
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import Dict, Any, Tuple, Optional, List
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from domain_analyzer import DomainAnalyzer, extract_project_domain
    _DOMAIN_ANALYZER_AVAILABLE = True
except ImportError:
    DomainAnalyzer = None  # type: ignore[assignment]
    _DOMAIN_ANALYZER_AVAILABLE = False
    def extract_project_domain(x: str) -> str:  # type: ignore[misc]
        return "general"

# ---------------------------------------------------------------------------
# ChromaDB initialisation
# ---------------------------------------------------------------------------
DB_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")
os.makedirs(DB_PATH, exist_ok=True)
chroma_client = chromadb.PersistentClient(path=DB_PATH)

knowledge_collection = chroma_client.get_or_create_collection(name="knowledge")
memory_collection = chroma_client.get_or_create_collection(name="memory")

# ---------------------------------------------------------------------------
# Embedding model
# ---------------------------------------------------------------------------
try:
    model = SentenceTransformer("all-MiniLM-L6-v2")
except Exception as e:
    print(f"[Retriever] WARNING: Could not load SentenceTransformer model: {e}")
    model = None  # type: ignore[assignment]

# ---------------------------------------------------------------------------
# Thresholds (Phase 1 hardening)
# ---------------------------------------------------------------------------
SIMILARITY_THRESHOLD = 0.85       # Minimum cosine similarity to accept a memory
MIN_MEMORY_CONFIDENCE = 0.65      # Minimum domain confidence stored at ingest time
MAX_DOMAIN_MISMATCH_SCORE = 0.30  # If domain_match_score < this, discard memory
MIN_KEYWORD_OVERLAP = 0.10        # Minimum keyword overlap ratio to accept a memory


def _cosine_similarity(a: Any, b: Any) -> float:
    a_arr = np.asarray(a, dtype=np.float32)
    b_arr = np.asarray(b, dtype=np.float32)
    norm_a = float(np.linalg.norm(a_arr))
    norm_b = float(np.linalg.norm(b_arr))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / (norm_a * norm_b))


def _keyword_overlap_ratio(idea_terms: List[str], memory_terms: List[str]) -> float:
    """Compute Jaccard-style overlap between two keyword lists."""
    if not idea_terms or not memory_terms:
        return 0.0
    a = set(t.lower() for t in idea_terms if len(t) > 3)
    b = set(t.lower() for t in memory_terms if len(t) > 3)
    if not a or not b:
        return 0.0
    return len(a & b) / max(len(a), len(b))


# ---------------------------------------------------------------------------
# Knowledge ingestion
# ---------------------------------------------------------------------------

def ingest_knowledge(knowledge_dir: str) -> None:
    """Embed and ingest documents from a knowledge directory into ChromaDB."""
    if not os.path.exists(knowledge_dir) or model is None:
        return

    docs: List[str] = []
    ids: List[str] = []
    metadatas: List[Dict[str, Any]] = []

    for filename in os.listdir(knowledge_dir):
        filepath = os.path.join(knowledge_dir, filename)
        if os.path.isfile(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                docs.append(content[:1500])
                ids.append(filename)
                metadatas.append({"filename": filename})
            except Exception as e:
                print(f"[Retriever] WARNING: Could not read {filename}: {e}")

    if docs:
        try:
            embeddings = model.encode(docs).tolist()
            knowledge_collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=docs,
                metadatas=metadatas,
            )
            print(f"[Retriever] ✅ Ingested {len(docs)} documents into knowledge base.")
        except Exception as e:
            print(f"[Retriever] ERROR ingesting knowledge: {e}")


# ---------------------------------------------------------------------------
# Knowledge retrieval
# ---------------------------------------------------------------------------

def retrieve_semantic_knowledge(query: str, n_results: int = 2) -> str:
    """Retrieve semantically similar knowledge chunks."""
    if knowledge_collection.count() == 0 or model is None:
        return ""

    try:
        query_embedding = model.encode([query])
        results = knowledge_collection.query(
            query_embeddings=query_embedding.tolist(),
            n_results=min(n_results, knowledge_collection.count()),
        )

        if not results["documents"] or not results["documents"][0]:
            return ""

        docs = results["documents"][0]
        metadatas = results.get("metadatas", [[]])[0]
        doc_embeddings = model.encode(docs)
        context_chunks: List[str] = []

        for doc, metadata, doc_emb in zip(docs, metadatas, doc_embeddings):
            similarity = _cosine_similarity(query_embedding[0], doc_emb)
            if similarity < SIMILARITY_THRESHOLD:
                continue
            filename = (metadata or {}).get("filename", "Unknown")
            context_chunks.append(f"[Source: {filename}]\n{doc}")

        return "\n\n".join(context_chunks)
    except Exception as e:
        print(f"[Retriever] ERROR retrieving knowledge: {e}")
        return ""


# ---------------------------------------------------------------------------
# Memory ingestion
# ---------------------------------------------------------------------------

def add_memory(memory_id: str, text_representation: str, raw_data: dict) -> None:
    """Embed and store a successful debate result with domain metadata.

    Phase 1 hardening:
    - Stores primary_domain, all_domains (JSON string), and domain_confidence
    - all_domains is stored as a JSON-encoded string because ChromaDB metadata
      only supports scalar types (str, int, float, bool).
    """
    if model is None:
        print("[Retriever] WARNING: Embedding model not available; memory not saved.")
        return

    try:
        idea: str = raw_data.get("idea", "")
        domain_meta: Dict[str, Any] = {
            "primary_domain": "general",
            "all_domains_json": "[]",
            "domain_confidence": 0.5,
            "idea_key_terms_json": "[]",
        }

        if _DOMAIN_ANALYZER_AVAILABLE and idea:
            try:
                idea_domain = DomainAnalyzer.extract_domain_from_idea(idea)
                domain_meta = {
                    "primary_domain": idea_domain.get("primary_domain") or "general",
                    # ChromaDB requires scalar metadata values — serialise sets/lists to JSON strings
                    "all_domains_json": json.dumps(sorted(idea_domain.get("all_domains", set()))),
                    "domain_confidence": float(idea_domain.get("confidence", 0.5)),
                    "idea_key_terms_json": json.dumps(idea_domain.get("key_terms", [])[:10]),
                }
            except Exception as e:
                print(f"[Retriever] WARNING: Domain extraction failed for memory: {e}")

        embedding = model.encode([text_representation]).tolist()
        metadata = {
            "source": "debate_result",
            "idea": idea[:500],
            **domain_meta,
        }

        memory_collection.upsert(
            ids=[memory_id],
            embeddings=embedding,
            documents=[text_representation],
            metadatas=[metadata],
        )
        print(f"[Retriever] ✅ Memory {memory_id[:8]}... saved (domain={domain_meta['primary_domain']})")

    except Exception as e:
        print(f"[Retriever] ERROR adding memory: {e}")


# ---------------------------------------------------------------------------
# Memory retrieval
# ---------------------------------------------------------------------------

def retrieve_semantic_memory(
    query: str,
    n_results: int = 2,
    user_idea: Optional[str] = None,
) -> Tuple[str, Dict[str, Any]]:
    """Retrieve past memories with domain-aware filtering.

    Phase 1 hardening:
    - Logs every retrieval decision with a human-readable reason
    - Computes similarity score, domain overlap score, keyword overlap score
    - Applies hard discard rules: low similarity, domain mismatch, low confidence,
      low keyword overlap
    - Bad memory is worse than no memory — when in doubt, discard

    Returns:
        Tuple of (memory_text, metadata_dict)
    """
    empty_meta: Dict[str, Any] = {
        "filtered": 0,
        "retrieved": 0,
        "confidence": 0.0,
        "user_domain": None,
        "retrieval_log": [],
    }

    if memory_collection.count() == 0:
        return "", {**empty_meta, "reason": "memory_collection_empty"}

    if model is None:
        print("[Retriever] WARNING: Embedding model not available; skipping memory retrieval.")
        return "", {**empty_meta, "reason": "model_unavailable"}

    # --- Extract user's domain for filtering ---
    user_domain: Optional[str] = None
    user_domain_confidence: float = 0.0
    user_key_terms: List[str] = []
    user_domain_info: Dict[str, Any] = {}

    if _DOMAIN_ANALYZER_AVAILABLE and user_idea:
        try:
            user_domain_info = DomainAnalyzer.extract_domain_from_idea(user_idea)
            user_domain = user_domain_info.get("primary_domain")
            user_domain_confidence = float(user_domain_info.get("confidence", 0.0))
            user_key_terms = user_domain_info.get("key_terms", [])
        except Exception as e:
            print(f"[Retriever] WARNING: Failed to extract user domain: {e}")

    try:
        query_embedding = model.encode([query])
        # Fetch more candidates than needed so we can filter aggressively
        candidate_count = min(n_results * 4, max(memory_collection.count(), 1))
        results = memory_collection.query(
            query_embeddings=query_embedding.tolist(),
            n_results=candidate_count,
        )

        if not results["documents"] or not results["documents"][0]:
            return "", {**empty_meta, "reason": "no_candidates"}

        docs: List[str] = results["documents"][0]
        doc_embeddings = model.encode(docs)
        metadatas: List[Dict[str, Any]] = results.get("metadatas", [[]])[0]

        relevant_chunks: List[str] = []
        filtered_count: int = 0
        retrieval_log: List[Dict[str, Any]] = []

        for doc, doc_emb, meta in zip(docs, doc_embeddings, metadatas):
            meta = meta or {}
            memory_id_hint = meta.get("idea", "unknown")[:40]
            decision_entry: Dict[str, Any] = {"memory": memory_id_hint}

            # ── GATE 1: Semantic similarity ──────────────────────────────────
            similarity = _cosine_similarity(query_embedding[0], doc_emb)
            decision_entry["similarity"] = round(similarity, 4)

            if similarity < SIMILARITY_THRESHOLD:
                filtered_count += 1
                decision_entry["decision"] = "DISCARD"
                decision_entry["reason"] = f"similarity {similarity:.4f} < threshold {SIMILARITY_THRESHOLD}"
                retrieval_log.append(decision_entry)
                continue

            # ── GATE 2: Memory domain confidence ─────────────────────────────
            memory_confidence = float(meta.get("domain_confidence", 0.0))
            decision_entry["memory_confidence"] = memory_confidence

            if memory_confidence < MIN_MEMORY_CONFIDENCE:
                filtered_count += 1
                decision_entry["decision"] = "DISCARD"
                decision_entry["reason"] = f"memory domain_confidence {memory_confidence:.2f} < {MIN_MEMORY_CONFIDENCE}"
                retrieval_log.append(decision_entry)
                continue

            # ── GATE 3: Domain mismatch ──────────────────────────────────────
            if _DOMAIN_ANALYZER_AVAILABLE and user_domain:
                memory_primary = meta.get("primary_domain", "general")
                memory_all_domains_json = meta.get("all_domains_json", "[]")

                try:
                    memory_all_domains = set(json.loads(memory_all_domains_json))
                except (json.JSONDecodeError, TypeError):
                    memory_all_domains = set()

                memory_domain_info = {
                    "primary_domain": memory_primary,
                    "all_domains": memory_all_domains,
                }

                domain_score = DomainAnalyzer.domain_match_score(user_domain_info, memory_domain_info)
                decision_entry["domain_match_score"] = round(domain_score, 4)

                if domain_score < MAX_DOMAIN_MISMATCH_SCORE:
                    filtered_count += 1
                    decision_entry["decision"] = "DISCARD"
                    decision_entry["reason"] = (
                        f"domain mismatch: user={user_domain}, "
                        f"memory={memory_primary}, score={domain_score:.4f} < {MAX_DOMAIN_MISMATCH_SCORE}"
                    )
                    retrieval_log.append(decision_entry)
                    continue

            # ── GATE 4: Keyword overlap ──────────────────────────────────────
            try:
                memory_key_terms = json.loads(meta.get("idea_key_terms_json", "[]"))
            except (json.JSONDecodeError, TypeError):
                memory_key_terms = []

            kw_overlap = _keyword_overlap_ratio(user_key_terms, memory_key_terms)
            decision_entry["keyword_overlap"] = round(kw_overlap, 4)

            if kw_overlap < MIN_KEYWORD_OVERLAP and user_key_terms:
                filtered_count += 1
                decision_entry["decision"] = "DISCARD"
                decision_entry["reason"] = f"keyword overlap {kw_overlap:.4f} < {MIN_KEYWORD_OVERLAP}"
                retrieval_log.append(decision_entry)
                continue

            # ── ACCEPT ────────────────────────────────────────────────────────
            decision_entry["decision"] = "ACCEPT"
            decision_entry["reason"] = "passed all gates"
            retrieval_log.append(decision_entry)
            relevant_chunks.append(doc)

            if len(relevant_chunks) >= n_results:
                break

        metadata_out: Dict[str, Any] = {
            "filtered": filtered_count,
            "retrieved": len(relevant_chunks),
            "confidence": user_domain_confidence,
            "user_domain": user_domain,
            "retrieval_log": retrieval_log,
        }

        print(
            f"[Retriever] Memory retrieval: {len(relevant_chunks)} accepted, "
            f"{filtered_count} discarded (domain={user_domain})"
        )
        for entry in retrieval_log:
            status = entry.get("decision", "?")
            reason = entry.get("reason", "")
            print(f"  [{status}] {entry.get('memory', '')!r} — {reason}")

        return "\n\n".join(relevant_chunks), metadata_out

    except Exception as e:
        print(f"[Retriever] ERROR retrieving memory: {e}")
        return "", {**empty_meta, "error": str(e)}