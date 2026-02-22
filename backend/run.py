"""
Entry point for the Google Drive Chatbot backend.

Run with:  python run.py

This file exists because on Windows, asyncio.SelectorEventLoop (which
uvicorn uses by default) cannot spawn subprocesses. We must switch to
WindowsProactorEventLoopPolicy BEFORE uvicorn creates its event loop,
which means it cannot be done inside main.py — it must happen here,
before `import uvicorn` triggers any loop creation.
"""

import asyncio
import sys

# ── MUST be before `import uvicorn` ──────────────────────────────────────────
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
# ─────────────────────────────────────────────────────────────────────────────

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
