"""
Knowledge Memory — ChromaDB vector store for semantic search.
Stores learned workflows, user-relevant info, and past action summaries.
"""
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)


class KnowledgeMemory:
    """
    ChromaDB-backed semantic memory.
    Falls back to a simple list if ChromaDB is unavailable.
    """

    def __init__(self):
        self._client = None
        self._collection = None
        self._available = False
        self._fallback: list[dict] = []

    async def connect(self):
        try:
            import chromadb
            from backend.config.settings import settings
            import asyncio

            max_retries = 5
            retry_delay = 2.0

            for attempt in range(1, max_retries + 1):
                try:
                    self._client = chromadb.HttpClient(
                        host=settings.CHROMA_HOST,
                        port=settings.CHROMA_PORT,
                    )
                    self._client.heartbeat()
                    self._collection = self._client.get_or_create_collection(
                        name=settings.CHROMA_COLLECTION,
                        metadata={"hnsw:space": "cosine"},
                    )
                    self._available = True
                    logger.info("KnowledgeMemory connected to ChromaDB")
                    return
                except Exception as attempt_err:
                    if attempt < max_retries:
                        logger.warning(
                            f"ChromaDB connection attempt {attempt}/{max_retries} failed. Retrying in {retry_delay}s...",
                            error=str(attempt_err)
                        )
                        await asyncio.sleep(retry_delay)
                    else:
                        raise attempt_err
        except Exception as e:
            logger.warning("ChromaDB unavailable, using list fallback", error=str(e))
            self._available = False

    async def store(
        self,
        doc_id: str,
        text: str,
        metadata: Optional[dict] = None,
    ):
        """Store a document in the vector store."""
        if not self._available:
            self._fallback.append({"id": doc_id, "text": text, "metadata": metadata or {}})
            return
        try:
            self._collection.upsert(
                ids=[doc_id],
                documents=[text],
                metadatas=[metadata or {}],
            )
        except Exception as e:
            logger.error("ChromaDB store failed", error=str(e))

    async def search(self, query: str, n_results: int = 5) -> list[dict]:
        """Semantic search for relevant memories."""
        if not self._available:
            # Simple substring fallback
            query_lower = query.lower()
            results = [
                item for item in self._fallback
                if query_lower in item["text"].lower()
            ]
            return results[:n_results]
        try:
            results = self._collection.query(
                query_texts=[query],
                n_results=min(n_results, self._collection.count() or 1),
                include=["documents", "metadatas", "distances"],
            )
            docs = results.get("documents", [[]])[0]
            metas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]
            return [
                {
                    "text": doc,
                    "metadata": meta,
                    "similarity": 1 - dist,
                }
                for doc, meta, dist in zip(docs, metas, distances)
            ]
        except Exception as e:
            logger.error("ChromaDB search failed", error=str(e))
            return []

    async def store_action_summary(self, session_id: str, action_summary: str, metadata: dict):
        """Store a summary of a completed action for future recall."""
        doc_id = f"action:{session_id}:{metadata.get('timestamp', 'unknown')}"
        await self.store(doc_id, action_summary, metadata)

    async def recall_similar_tasks(self, task_description: str, n: int = 3) -> list[dict]:
        """Find similar past tasks for context injection."""
        return await self.search(task_description, n_results=n)

    def get_stats(self) -> dict:
        if not self._available:
            return {"available": False, "doc_count": len(self._fallback)}
        try:
            count = self._collection.count()
            return {"available": True, "doc_count": count}
        except Exception:
            return {"available": False, "doc_count": 0}


# Singleton
knowledge_memory = KnowledgeMemory()
