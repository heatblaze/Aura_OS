"""
Markdown Brain — Persistent file-based memory system.
Each .md file in the brain/ directory is a memory node.
The AI reads these files on every interaction to maintain
perfect long-term context, just like the "Neuralink Brain"
concept from the reference videos.

File structure:
  backend/brain/
    memory.md       — Ongoing facts and learnings
    tasks.md        — Active and completed tasks
    personality.md  — User preferences and personality
    context.md      — Current project/business context
    [custom].md     — Any user-created memory files
"""

import os
import re
from pathlib import Path
from datetime import datetime
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)

# The brain directory sits at the root of the backend
BRAIN_DIR = Path(__file__).parent.parent / "brain"


def ensure_brain_dir():
    """Create the brain directory and default memory files if they don't exist."""
    BRAIN_DIR.mkdir(exist_ok=True)

    defaults = {
        "memory.md": (
            "# Ongoing Memory\n\n"
            "This file stores facts, learnings, and information that AURA discovers over time.\n\n"
            "## Key Facts\n- (Will be populated as you interact)\n\n"
            "## Learnings\n- (Will be populated as AURA learns)\n"
        ),
        "tasks.md": (
            "# Active Tasks\n\n"
            "This file tracks tasks and to-dos that AURA is managing.\n\n"
            "## Active\n- (No active tasks)\n\n"
            "## Completed\n- (No completed tasks yet)\n"
        ),
        "personality.md": (
            "# User Preferences & Personality\n\n"
            "This file stores what AURA knows about the user's preferences, style, and working patterns.\n\n"
            "## Communication Style\n- Prefers direct, actionable responses\n\n"
            "## Work Preferences\n- (Will be populated over time)\n\n"
            "## Known Interests\n- Building AI systems\n- Premium UI design\n- Automation\n"
        ),
        "context.md": (
            "# Current Project Context\n\n"
            "This file stores the current project state and business context.\n\n"
            "## Active Projects\n"
            "- **Aura OS**: A cinematic AI operating system frontend built with Next.js\n"
            "- **OpenJarvis Backend**: A FastAPI multi-agent AI backend with Ollama LLM support\n\n"
            "## Tech Stack\n"
            "- Frontend: Next.js, React, Framer Motion, TypeScript, Tailwind\n"
            "- Backend: FastAPI, Python, Ollama (local LLM), Redis, PostgreSQL, ChromaDB\n"
            "- Architecture: Multi-agent pipeline (Commander → Planner → Executor → Critic)\n\n"
            "## Current Goals\n"
            "- Wire Aura OS frontend into OpenJarvis backend via WebSockets\n"
            "- Implement Markdown Brain memory system\n"
            "- Build Neural Brain Graph visualization\n"
        ),
        "registry.md": (
            "# Tool Registry Manifest\n\n"
            "Configuration and credentials mapping for registered agent capabilities.\n\n"
            "## Tools\n"
            "- WebSearchTool: Configured and active [[registry]]\n"
            "- BrowserTool: Local Playwright sandbox active\n"
            "- LocalSystemTool: Command line execution enabled\n"
        ),
        "proactive.md": (
            "# Proactive Background Initiatives\n\n"
            "Scheduler logs, trigger constraints, and contextual scanners.\n\n"
            "## Triggers\n"
            "- MorningBriefTrigger: Fires at 09:00 UTC\n"
            "- InboxScanTrigger: Scans mail queues dynamically [[registry]]\n"
            "- MemoryConsolidationTrigger: Active on system idle [[memory]]\n"
            "- KRONOSCompilerTrigger: Compiles learned experience nodes [[learned_experience]]\n"
        ),
        "sessions.md": (
            "# Chat Session History\n\n"
            "Index of recent conversations and channel summaries.\n\n"
            "## Active Channels\n"
            "- #general-chat: Primary AI operational feed [[context]]\n"
            "- #business-operations: Growth and outreach [[memory]]\n"
        ),
        "calibration.md": (
            "# Calibration Telemetry & Performance\n\n"
            "Inference logs, queue congestion levels, and model calibration states.\n\n"
            "## Diagnostic State\n"
            "- Ollama Link: Connected and stable\n"
            "- Scheduler State: Operational [[proactive]]\n"
        ),
        "skills.md": (
            "# Learned Agent Skills\n\n"
            "Learned procedures, query filters, and custom routine templates.\n\n"
            "## Routines\n"
            "- Layout adjustments for Next.js layout engine [[personality]]\n"
            "- File scanner routines for code directories [[registry]]\n"
            "- Performance indexing and success compilation [[learned_experience]]\n"
        ),
        "learned_experience.md": (
            "# KRONOS Learned Experience\n\n"
            "Summary of AURA's operational wins and learnings from task executions.\n\n"
            "## Successes (Wins)\n"
            "- Successfully completed layout optimizations in [[context]].\n"
            "- Successfully consolidated tools interface inside [[registry]].\n\n"
            "## Failures (Learnings)\n"
            "- Connection timeout with external API calibration [[calibration]].\n"
        ),
    }

    for filename, content in defaults.items():
        filepath = BRAIN_DIR / filename
        if not filepath.exists():
            filepath.write_text(content, encoding="utf-8")
            logger.info(f"Created brain file: {filename}")


class MarkdownBrain:
    """
    Manages the file-based markdown memory system.
    Reads all .md files from the brain/ directory and provides
    their contents for injection into LLM context.
    Also supports writing back to files when the AI learns new things.
    """

    def __init__(self):
        ensure_brain_dir()

    def get_all_files(self) -> list[dict]:
        """Return a list of all brain files with their metadata."""
        files = []
        for filepath in sorted(BRAIN_DIR.glob("*.md")):
            stat = filepath.stat()
            content = filepath.read_text(encoding="utf-8")
            files.append({
                "name": filepath.stem,
                "filename": filepath.name,
                "content": content,
                "size_bytes": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "line_count": content.count("\n"),
            })
        return files

    def get_file(self, name: str) -> Optional[str]:
        """Read a specific brain file by name (without .md extension)."""
        filepath = BRAIN_DIR / f"{name}.md"
        if filepath.exists():
            return filepath.read_text(encoding="utf-8")
        return None

    def write_file(self, name: str, content: str):
        """Write or overwrite a brain file."""
        filepath = BRAIN_DIR / f"{name}.md"
        filepath.write_text(content, encoding="utf-8")
        logger.info(f"Brain file updated: {name}.md")

    def append_to_file(self, name: str, section: str, content: str):
        """Append a new entry to a specific section in a brain file."""
        filepath = BRAIN_DIR / f"{name}.md"
        if not filepath.exists():
            filepath.write_text(f"# {name.title()}\n\n## {section}\n- {content}\n", encoding="utf-8")
            return

        existing = filepath.read_text(encoding="utf-8")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        new_entry = f"- [{timestamp}] {content}"

        # Find the section and append under it
        section_pattern = rf"(## {re.escape(section)}\n)"
        if re.search(section_pattern, existing):
            updated = re.sub(section_pattern, rf"\1{new_entry}\n", existing, count=1)
        else:
            # Section doesn't exist, add it at the end
            updated = existing.rstrip() + f"\n\n## {section}\n{new_entry}\n"

        filepath.write_text(updated, encoding="utf-8")
        logger.info(f"Appended to brain file: {name}.md → {section}")

    def build_context_injection(self, max_chars: int = 4000) -> str:
        """
        Build the full brain context string to inject into LLM system prompts.
        Prioritizes: context.md > personality.md > tasks.md > memory.md > others
        Truncates to max_chars to stay within LLM token limits.
        """
        priority_order = ["context", "personality", "tasks", "memory"]
        all_files = {f["name"]: f["content"] for f in self.get_all_files()}

        # Build ordered content
        ordered_parts = []
        for name in priority_order:
            if name in all_files:
                ordered_parts.append((name, all_files.pop(name)))
        # Append any remaining custom files
        for name, content in all_files.items():
            ordered_parts.append((name, content))

        # Assemble context block
        context_block = "=== AURA BRAIN (Persistent Memory) ===\n\n"
        for name, content in ordered_parts:
            section = f"[{name.upper()}.MD]\n{content.strip()}\n\n"
            if len(context_block) + len(section) > max_chars:
                remaining = max_chars - len(context_block) - 50
                if remaining > 100:
                    context_block += f"[{name.upper()}.MD]\n{content.strip()[:remaining]}...\n\n"
                break
            context_block += section

        context_block += "=== END BRAIN ==="
        return context_block

    def get_graph_data(self) -> dict:
        """
        Build graph data (nodes + edges) representing the brain structure.
        Used by the frontend Neural Brain Graph visualization.
        """
        files = self.get_all_files()
        nodes = []
        edges = []

        for i, f in enumerate(files):
            # Color based on file type
            color_map = {
                "memory": "#00d4ff",
                "tasks": "#10b981",
                "personality": "#8b5cf6",
                "context": "#f59e0b",
            }
            color = color_map.get(f["name"], "#3b82f6")

            # Node size based on content length (normalized)
            size = min(20, max(8, f["size_bytes"] / 100))

            nodes.append({
                "id": f["name"],
                "label": f["name"].replace("_", " ").title(),
                "filename": f["filename"],
                "size": size,
                "color": color,
                "modified_at": f["modified_at"],
                "line_count": f["line_count"],
                "excerpt": f["content"][:200].replace("\n", " ").strip(),
            })

            # Build edges by detecting [[wiki-style]] links between files
            all_names = {ff["name"] for ff in files}
            for match in re.finditer(r"\[\[([^\]]+)\]\]", f["content"]):
                target = match.group(1).lower().replace(" ", "_")
                if target in all_names and target != f["name"]:
                    edges.append({"source": f["name"], "target": target, "type": "wiki_link"})

            # Also add edges for files that share keyword mentions
            for j, other_f in enumerate(files):
                if i >= j:
                    continue
                # Simple heuristic: if a file's name appears in another file's content
                if f["name"] in other_f["content"].lower() or other_f["name"] in f["content"].lower():
                    edges.append({"source": f["name"], "target": other_f["name"], "type": "mention"})

        return {"nodes": nodes, "edges": edges, "file_count": len(files)}


# Singleton
markdown_brain = MarkdownBrain()
