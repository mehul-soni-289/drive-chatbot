"""
FastAPI application entry point — Multi-user Google Drive Chatbot.

Each authenticated user gets their own Google Drive access via OAuth tokens.
No MCP subprocess needed.
"""

from dotenv import load_dotenv
load_dotenv(override=True)

import logging
import os
import traceback
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from logger import setup_logging
setup_logging(level=logging.INFO)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Drive Chatbot API starting up (multi-user mode)")
    yield
    logger.info("Drive Chatbot API shutting down")


app = FastAPI(
    title="Google Drive Chatbot API",
    description="Multi-user natural language interface to Google Drive",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register auth routes
from auth import router as auth_router
app.include_router(auth_router)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    folder_id: str | None = None
    history: list[dict[str, str]] = []


class IntermediateStep(BaseModel):
    thought: str
    action: str
    action_input: Any
    observation: str


class ChatResponse(BaseModel):
    answer: str
    intermediate_steps: list[IntermediateStep] = []
    tokens: int = 0
    error: str | None = None


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["system"])
async def health():
    """Quick liveness probe."""
    return {"status": "ok", "service": "drive-chatbot-api", "mode": "multi-user"}


# ---------------------------------------------------------------------------
# Drive Data Fetchers
# ---------------------------------------------------------------------------

@app.get("/api/folders", tags=["drive"])
async def list_folders(request: Request):
    """List the available folders in the user's Google Drive."""
    from auth import get_current_user, get_user_credentials
    from gdrive_service import GoogleDriveService

    user = get_current_user(request)
    credentials = get_user_credentials(user["sub"])
    if not credentials:
        raise HTTPException(status_code=401, detail="Drive not connected.")

    drive = GoogleDriveService(credentials)
    folders = drive.list_folders(max_results=500)
    return {"folders": folders}


# ---------------------------------------------------------------------------
# Token Counter Callback
# ---------------------------------------------------------------------------

from langchain_core.callbacks import BaseCallbackHandler

class TokenCounterHandler(BaseCallbackHandler):
    def __init__(self):
        self.total_tokens = 0

    def on_llm_end(self, response, **kwargs):
        for generation_group in response.generations:
            for generation in generation_group:
                # 1. Direct usage_metadata on the message (LangChain 0.2+)
                if hasattr(generation, 'message') and hasattr(generation.message, 'usage_metadata'):
                    usage = generation.message.usage_metadata
                    self.total_tokens += usage.get('total_tokens', 0)
                
                # 2. Check response_metadata on the message
                elif hasattr(generation, 'message') and hasattr(generation.message, 'response_metadata'):
                    meta = generation.message.response_metadata
                    # Google GenAI specific
                    usage = meta.get('usage', {})
                    if usage:
                        self.total_tokens += usage.get('total_tokens', 0)
                
                # 3. Check generation_info on the chunk
                elif hasattr(generation, 'generation_info') and generation.generation_info:
                    info = generation.generation_info
                    usage = info.get('usage_metadata', {}) or info.get('token_usage', {})
                    if usage:
                        self.total_tokens += usage.get('total_tokens', 0)
        
        logger.info("Current total tokens captured: %d", self.total_tokens)


# ---------------------------------------------------------------------------
# Chat endpoint (per-user, authenticated)
# ---------------------------------------------------------------------------

@app.post("/api/chat", response_model=ChatResponse, tags=["chat"])
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    """
    Accept a natural-language query from an authenticated user,
    route it through the ReAct agent with their Google Drive access,
    and return the synthesised answer.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # ── Authenticate ──
    from auth import get_current_user, get_user_credentials

    user = get_current_user(request)
    email = user["sub"]
    logger.info("Chat request from %s (Folder: %s): %.120s", email, body.folder_id, body.message)

    credentials = get_user_credentials(email)
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Google Drive not connected. Please log in again.",
        )

    try:
        # Build per-user Drive service and agent
        from gdrive_service import GoogleDriveService
        from agent import build_agent

        drive = GoogleDriveService(credentials)
        executor = build_agent(drive, folder_id=body.folder_id)

        # Build input with conversation history
        history_context = ""
        if body.history:
            snippets = []
            for turn in body.history[-6:]:
                role = turn.get("role", "user")
                content = turn.get("content", "")
                snippets.append(f"{role.capitalize()}: {content}")
            history_context = "Previous conversation:\n" + "\n".join(snippets) + "\n\n"

        full_input = history_context + body.message
        
        # Token tracking
        token_handler = TokenCounterHandler()
        
        raw = await executor.ainvoke(
            {"input": full_input},
            config={"callbacks": [token_handler]}
        )

        # Parse intermediate steps
        steps: list[IntermediateStep] = []
        for action, observation in raw.get("intermediate_steps", []):
            steps.append(
                IntermediateStep(
                    thought=getattr(action, "log", ""),
                    action=action.tool if hasattr(action, "tool") else str(action),
                    action_input=action.tool_input if hasattr(action, "tool_input") else {},
                    observation=str(observation)[:2000],
                )
            )

        answer = raw.get("output", "No answer generated.")
        total_tokens = token_handler.total_tokens
        
        logger.info(
            "Agent finished for %s. Answer: %d chars, steps: %d, tokens: %d",
            email, len(answer), len(steps), total_tokens
        )
        return ChatResponse(
            answer=answer, 
            intermediate_steps=steps,
            tokens=total_tokens
        )

    except Exception as exc:
        tb = traceback.format_exc()
        exc_type = type(exc).__name__
        exc_msg = str(exc) or "(no message)"
        logger.error("Chat failed for %s [%s]: %s\n%s", email, exc_type, exc_msg, tb)
        user_detail = exc_msg if exc_msg != "(no message)" else f"{exc_type} — see server logs."
        return ChatResponse(answer="", error=user_detail)
