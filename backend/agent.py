"""
LangChain ReAct Agent — uses per-user Google Drive tools (no MCP).
"""

import logging
import os
from typing import Any

from langchain.agents import AgentExecutor, create_react_agent
from langchain.tools import StructuredTool
from langchain_core.prompts import PromptTemplate
from langchain_huggingface import HuggingFacePipeline
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
import torch

from gdrive_service import GoogleDriveService
from document_parser import parse_document

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Local Model Loader
# ---------------------------------------------------------------------------

_local_llm = None

def get_local_llm():
    """Singleton to load the local model once."""
    global _local_llm
    if _local_llm is None:
        model_id = os.getenv("LOCAL_MODEL_ID", "mistralai/Mistral-7B-Instruct-v0.2")
        logger.info(f"Loading local model: {model_id}")
        
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None,
            trust_remote_code=True
        )
        
        pipe = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=1024,
            temperature=0.1,
            top_p=0.95,
            repetition_penalty=1.15
        )
        _local_llm = HuggingFacePipeline(pipeline=pipe)
    return _local_llm


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

REACT_TEMPLATE = """<s>[INST] You are an expert Google Drive Research Assistant. 
Your mission is to provide accurate answers while being extremely efficient with tool calls.

## Context
{folder_context}

## Execution Rules
1. **Direct Access**: If a Folder ID is provided in the Context, call `list_folder` immediately as your first action.
2. **Minimize Steps**: Answer in the fewest possible turns.
3. **Accuracy**: Cite your sources exactly.

## Tools Available
{tools}

## ReAct Protocol
Question: {input}
Thought: [Briefly explain next step]
Action: [{tool_names}]
Action Input: [JSON object]
Observation: [System response]
... (Repeat until done)
Final Answer: [Detailed response]

Begin!
[/INST]
Question: {input}
Thought: {agent_scratchpad}"""


# ---------------------------------------------------------------------------
# Tool factories — build LangChain tools from a GoogleDriveService
# ---------------------------------------------------------------------------

def _build_drive_tools(drive: GoogleDriveService, folder_id: str | None = None) -> list[StructuredTool]:
    """Create LangChain tools backed by a user's Drive service."""
    import json

    def _unpack_input(val: Any, key: str) -> str:
        if not isinstance(val, str):
            return str(val)
        val = val.strip()
        if val.startswith("{") and val.endswith("}"):
            try:
                data = json.loads(val)
                if isinstance(data, dict):
                    return str(data.get(key, val))
            except:
                pass
        return val

    def search_drive(query: str) -> str:
        """Search for files by keyword."""
        query = _unpack_input(query, "query")
        files = drive.search_files(query, max_results=10, folder_id=folder_id)
        if not files:
            return f"No files found for '{query}'."
        lines = [f"• {f['name']} (id: {f['id']})" for f in files]
        return "Found:\n" + "\n".join(lines)

    def read_file(file_id: str) -> str:
        """Read a file's content by ID."""
        file_id = _unpack_input(file_id, "file_id")
        result = drive.download_file(file_id)
        if result is None: return "Error downloading."
        raw_bytes, mime_type, file_name = result
        parsed = parse_document(raw_bytes, file_name, mime_type, file_id)
        return parsed.full_text[:3000]

    def list_folder(target_folder_id: str | None = None) -> str:
        """List folder contents."""
        fid = target_folder_id or folder_id or "root"
        fid = _unpack_input(fid, "folder_id")
        items = drive.list_folder_contents(fid)
        if not items: return "Empty."
        lines = [f"• [{item['mimeType']}] {item['name']} (id: {item['id']})" for item in items]
        return f"Contents:\n" + "\n".join(lines)

    return [
        StructuredTool.from_function(func=search_drive, name="search_drive", description="Search files."),
        StructuredTool.from_function(func=read_file, name="read_file", description="Read file."),
        StructuredTool.from_function(func=list_folder, name="list_folder", description="List folder."),
    ]


# ---------------------------------------------------------------------------
# Agent builder
# ---------------------------------------------------------------------------

def build_agent(drive_service: GoogleDriveService, folder_id: str | None = None) -> AgentExecutor:
    """Build agent using local Hugging Face model."""
    llm = get_local_llm()
    tools = _build_drive_tools(drive_service, folder_id=folder_id)
    
    folder_context = f"FOLDER ID: {folder_id}" if folder_id else "GLOBAL SEARCH"
    prompt = PromptTemplate.from_template(REACT_TEMPLATE).partial(folder_context=folder_context)
    
    agent = create_react_agent(llm, tools, prompt)

    return AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=8,
        return_intermediate_steps=True,
    )
