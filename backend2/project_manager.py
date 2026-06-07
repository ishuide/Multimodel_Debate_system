"""
Project Manager: Versioned project persistence.

Changes in this refactor:
- Minor: added type annotations for clarity
- Minor: os.makedirs uses exist_ok consistently
- No logic changes required — this module is stable
"""

import os
import json
import uuid
from typing import Dict, Any, List

PROJECTS_DIR = os.path.join(os.path.dirname(__file__), "projects")
os.makedirs(PROJECTS_DIR, exist_ok=True)


def save_project_version(project_id: str, data: Dict[str, Any]) -> str:
    """Save a new version of the project. Returns the project_id."""
    if not project_id:
        project_id = str(uuid.uuid4())

    project_dir = os.path.join(PROJECTS_DIR, project_id)
    os.makedirs(project_dir, exist_ok=True)

    existing_versions = [
        f for f in os.listdir(project_dir)
        if f.startswith("v") and f.endswith(".json")
    ]
    version_nums: List[int] = []
    for v in existing_versions:
        try:
            num = int(v[1:-5])
            version_nums.append(num)
        except ValueError:
            pass

    next_v = max(version_nums) + 1 if version_nums else 1
    filename = f"v{next_v}.json"
    filepath = os.path.join(project_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return project_id


def get_project_history(project_id: str) -> List[Dict[str, Any]]:
    """Retrieve all versions of a project in chronological order."""
    project_dir = os.path.join(PROJECTS_DIR, project_id)
    if not os.path.exists(project_dir):
        return []

    files = [
        f for f in os.listdir(project_dir)
        if f.startswith("v") and f.endswith(".json")
    ]
    files.sort(key=lambda x: int(x[1:-5]) if x[1:-5].isdigit() else 0)

    versions: List[Dict[str, Any]] = []
    for filename in files:
        filepath = os.path.join(project_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            try:
                versions.append(json.load(f))
            except json.JSONDecodeError:
                pass
    return versions


def get_all_projects() -> List[str]:
    """Return all known project IDs."""
    return [
        d for d in os.listdir(PROJECTS_DIR)
        if os.path.isdir(os.path.join(PROJECTS_DIR, d))
    ]