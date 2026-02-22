"""
MCP Client Wrapper for Google Drive.

Connects to a locally running Google Drive MCP server via stdio using the
official Anthropic `mcp` SDK. Dynamically fetches available tools and
converts them to LangChain-compatible BaseTool instances.
"""

import asyncio
import base64
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Optional

from mcp import ClientSession, StdioServerParameters  # type: ignore
from mcp.client.stdio import stdio_client  # type: ignore

from document_parser import parse_document, ParsedDocument

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# LangChain tool shim
# ---------------------------------------------------------------------------

class MCPToolWrapper:
    """
    Wraps a single MCP tool as a callable compatible with LangChain's
    StructuredTool / Tool interface.

    We deliberately keep this as a plain class (not inheriting from BaseTool)
    so the MCP session reference stays outside LangChain's Pydantic model
    validation.
    """

    def __init__(self, name: str, description: str, session: ClientSession, input_schema: dict):
        self.name = name
        self.description = description
        self._session = session
        self._input_schema = input_schema

    async def arun(self, **kwargs: Any) -> str:
        """Async execution of the MCP tool."""
        logger.debug("Calling MCP tool '%s' with args: %s", self.name, kwargs)
        result = await self._session.call_tool(self.name, arguments=kwargs)

        # MCP returns a list of Content items
        texts: list[str] = []
        for content_item in result.content:
            if hasattr(content_item, "text"):
                texts.append(content_item.text)
            elif hasattr(content_item, "data"):
                # Binary blob – store as base64 string for agent awareness
                texts.append(f"[BINARY DATA base64 len={len(content_item.data)}]")

        combined = "\n".join(texts)
        logger.debug("MCP tool '%s' returned %d chars", self.name, len(combined))
        return combined

    def run(self, **kwargs: Any) -> str:
        """Sync wrapper (runs in the current event loop)."""
        return asyncio.get_event_loop().run_until_complete(self.arun(**kwargs))


# ---------------------------------------------------------------------------
# Google Drive read-file with document parsing
# ---------------------------------------------------------------------------

class GDriveReadAndParseWrapper(MCPToolWrapper):
    """
    Specialised wrapper for the ``gdrive_read_file`` (or equivalent) tool
    that automatically passes the raw bytes through the document parsing
    pipeline before returning them to the agent.

    The parsing step is completely separated from the calling logic,
    preserving the modular design goal.
    """

    async def arun(self, **kwargs: Any) -> str:  # type: ignore[override]
        raw_result = await self._session.call_tool(self.name, arguments=kwargs)

        raw_bytes: Optional[bytes] = None
        mime_type: str = "application/octet-stream"
        file_name: str = kwargs.get("file_id", "unknown_file")

        for content_item in raw_result.content:
            if hasattr(content_item, "text") and content_item.text:
                # Treat as plain text already
                raw_bytes = content_item.text.encode("utf-8")
                mime_type = getattr(content_item, "mimeType", "text/plain") or "text/plain"
            elif hasattr(content_item, "data") and content_item.data:
                raw_bytes = base64.b64decode(content_item.data)
                mime_type = getattr(content_item, "mimeType", "application/octet-stream") or "application/octet-stream"

        if raw_bytes is None:
            return "Error: MCP server returned no content for this file."

        parsed: ParsedDocument = parse_document(
            raw_bytes=raw_bytes,
            file_name=file_name,
            mime_type=mime_type,
            source_id=str(kwargs.get("file_id", "")),
        )

        if parsed.error:
            return f"Parsing error for '{file_name}': {parsed.error}"

        # Return a nicely formatted string for the LLM
        header = (
            f"=== File: {parsed.file_name} ===\n"
            f"Type: {parsed.mime_type}\n"
            f"Chunks: {len(parsed.chunks)}\n\n"
        )
        return header + parsed.full_text


# ---------------------------------------------------------------------------
# Session manager
# ---------------------------------------------------------------------------

@asynccontextmanager
async def managed_mcp_session() -> AsyncGenerator[ClientSession, None]:
    """
    Context manager that spawns the MCP server subprocess and yields an
    active :class:`ClientSession`.

    Configuration is read from environment variables:

    - ``MCP_SERVER_COMMAND`` – The executable to run (e.g. ``npx``).
    - ``MCP_SERVER_ARGS``    – Comma-separated arguments (e.g. ``-y,@modelcontextprotocol/server-gdrive``).
    """
    command = os.getenv("MCP_SERVER_COMMAND", "npx")
    args_raw = os.getenv("MCP_SERVER_ARGS", "-y,@modelcontextprotocol/server-gdrive")
    args = [a.strip() for a in args_raw.split(",") if a.strip()]

    # On Windows, executables like npx are actually npx.cmd — asyncio's
    # create_subprocess_exec doesn't search for .cmd extensions like a shell does.
    import sys
    if sys.platform == "win32" and not command.endswith((".cmd", ".exe", ".bat")):
        import shutil
        resolved = shutil.which(command)
        if resolved:
            command = resolved
            logger.debug("Resolved command to: %s", command)

    env = dict(os.environ)

    server_params = StdioServerParameters(
        command=command,
        args=args,
        env=env,
    )

    logger.info("Starting MCP server: %s %s", command, " ".join(args))
    try:
        async with stdio_client(server_params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                logger.info("MCP session initialised successfully")
                yield session
    except Exception as exc:
        import traceback as _tb
        logger.error(
            "MCP server failed to start [%s]: %s\n%s",
            type(exc).__name__,
            str(exc) or "(no message)",
            _tb.format_exc(),
        )
        raise


# ---------------------------------------------------------------------------
# Tool factory
# ---------------------------------------------------------------------------

READ_FILE_TOOL_NAMES = {"gdrive_read_file", "read_file", "read_gdrive_file"}

async def build_langchain_tools(session: ClientSession) -> list[MCPToolWrapper]:
    """
    Fetch the list of tools from the MCP server and wrap each one in a
    LangChain-compatible :class:`MCPToolWrapper`.

    Tools whose names match ``READ_FILE_TOOL_NAMES`` are wrapped in the
    specialised :class:`GDriveReadAndParseWrapper` to invoke the document
    parsing pipeline automatically.
    """
    tools_response = await session.list_tools()
    tools: list[MCPToolWrapper] = []

    for tool in tools_response.tools:
        name = tool.name
        description = tool.description or f"MCP tool: {name}"
        schema = tool.inputSchema if hasattr(tool, "inputSchema") else {}

        if name in READ_FILE_TOOL_NAMES:
            wrapper = GDriveReadAndParseWrapper(name, description, session, schema)
            logger.info("Registered file-read tool (with parser): %s", name)
        else:
            wrapper = MCPToolWrapper(name, description, session, schema)
            logger.info("Registered MCP tool: %s", name)

        tools.append(wrapper)

    return tools
