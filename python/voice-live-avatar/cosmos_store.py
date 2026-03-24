"""
Cosmos DB Store — Voice Live Avatar
Persists conversation turns (user questions and AI responses) to Azure Cosmos DB NoSQL.

Required environment variables:
    COSMOS_ENDPOINT   – e.g. https://<account>.documents.azure.com:443/
    COSMOS_KEY        – Primary or secondary key (omit to use DefaultAzureCredential)
    COSMOS_DATABASE   – Database name (default: voice-live)
    COSMOS_CONTAINER  – Container name (default: conversations)

Partition key path: /sessionId  (high cardinality — one logical partition per session)
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


class CosmosConversationStore:
    """
    Async Cosmos DB client wrapper.
    One singleton instance is shared across all active sessions.
    """

    def __init__(
        self,
        endpoint: str,
        key: Optional[str],
        database_name: str = "voice-live",
        container_name: str = "conversations",
    ):
        self.endpoint = endpoint
        self.key = key
        self.database_name = database_name
        self.container_name = container_name
        self._container = None  # lazily initialised

    # ------------------------------------------------------------------
    # Lazy initialisation — avoids blocking at import time
    # ------------------------------------------------------------------

    async def _get_container(self):
        """Return (and lazily create) the async Cosmos container client."""
        if self._container is not None:
            return self._container

        from azure.cosmos.aio import CosmosClient
        from azure.cosmos import PartitionKey, exceptions as cosmos_exc

        if self.key:
            self._client = CosmosClient(self.endpoint, credential=self.key)
        else:
            from azure.identity.aio import DefaultAzureCredential
            self._client = CosmosClient(
                self.endpoint, credential=DefaultAzureCredential()
            )

        # Create database + container if they don't exist
        try:
            db = await self._client.create_database_if_not_exists(id=self.database_name)
            logger.info(f"[Cosmos] Using database: {self.database_name}")
        except Exception as exc:
            logger.error(f"[Cosmos] Failed to create/access database: {exc}")
            raise

        try:
            container = await db.create_container_if_not_exists(
                id=self.container_name,
                partition_key=PartitionKey(path="/avatar"),
                offer_throughput=400,
            )
            logger.info(
                f"[Cosmos] Using container: {self.container_name} "
                f"(partition key: /avatar)"
            )
            self._container = container
        except Exception as exc:
            logger.error(f"[Cosmos] Failed to create/access container: {exc}")
            raise

        return self._container

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def save_turn(
        self,
        *,
        session_id: str,
        role: str,           # "user" | "assistant"
        content: str,
        avatar: str = "default",               # partition key value
        turn_type: str = "audio_transcript",   # "audio_transcript" | "text"
        item_id: Optional[str] = None,
    ) -> None:
        """
        Persist a single conversation turn.

        Document schema:
        {
          "id":          "<uuid>",
          "avatar":      "<avatar-name>",      ← partition key (/avatar)
          "sessionId":   "<client_id>",
          "role":        "user" | "assistant",
          "content":     "...",
          "type":        "audio_transcript" | "text",
          "itemId":      "<voice-live item id, optional>",
          "timestamp":   "2026-03-09T12:34:56.789Z"
        }
        """
        if not content or not content.strip():
            return  # nothing worth storing

        document = {
            "id": str(uuid.uuid4()),
            "avatar": avatar or "default",
            "sessionId": session_id,
            "role": role,
            "content": content.strip(),
            "type": turn_type,
            "itemId": item_id or "",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            container = await self._get_container()
            await container.upsert_item(document)
            logger.info(
                f"[Cosmos] Saved {role} turn for session {session_id}: "
                f"{content[:80]!r}{'…' if len(content) > 80 else ''}"
            )
        except Exception as exc:
            # Log but never crash the voice session
            logger.error(f"[Cosmos] Failed to save turn: {exc}", exc_info=True)

    async def close(self) -> None:
        """Close the underlying Cosmos client."""
        if hasattr(self, "_client") and self._client:
            try:
                await self._client.close()
            except Exception:
                pass
            self._client = None
        self._container = None


def create_store_from_env() -> Optional["CosmosConversationStore"]:
    """
    Build a CosmosConversationStore from environment variables.
    Returns None (with a warning) if COSMOS_ENDPOINT is not set.
    """
    endpoint = os.getenv("COSMOS_ENDPOINT", "").strip()
    if not endpoint:
        logger.warning(
            "[Cosmos] COSMOS_ENDPOINT not set — conversation history will NOT be persisted."
        )
        return None

    key = os.getenv("COSMOS_KEY", "").strip() or None
    database = os.getenv("COSMOS_DATABASE", "voice-live")
    container = os.getenv("COSMOS_CONTAINER", "conversations")

    logger.info(
        f"[Cosmos] Store configured → endpoint={endpoint}, "
        f"database={database}, container={container}, "
        f"auth={'key' if key else 'DefaultAzureCredential'}"
    )
    return CosmosConversationStore(
        endpoint=endpoint,
        key=key,
        database_name=database,
        container_name=container,
    )
