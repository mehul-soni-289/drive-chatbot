# Google Drive Chatbot

An AI-powered chatbot that lets you have natural-language conversations with your **Google Drive** files.

Built with:
- 🧠 **Gemini 2.5 Pro** (LLM) via LangChain
- 🔌 **Model Context Protocol** (MCP) for Google Drive access (official Anthropic Python SDK)
- ⚡ **FastAPI** backend with a modular document parsing pipeline
- 🎨 **Next.js 16** (App Router) with Tailwind CSS frontend

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (port 3000)             │
│  ChatWindow ──► /api/chat POST ──► FastAPI (port 8000)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  FastAPI Backend (main.py)                   │
│                                                             │
│  ┌──────────────┐   ┌────────────────┐  ┌────────────────┐ │
│  │  mcp_client  │   │  agent.py      │  │document_parser │ │
│  │  (stdio MCP) │◄──│  (ReAct agent) │──│  (modular)     │ │
│  └──────┬───────┘   └────────────────┘  └────────────────┘ │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │ stdio
┌─────────▼────────────────────────────────────────────────────┐
│   Google Drive MCP Server (@modelcontextprotocol/server-gdrive)│
│   (runs as subprocess, communicates via stdin/stdout)         │
└───────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |
| npx | (comes with npm) |

### Google Cloud Setup

1. **Create a Google Cloud project** and enable the **Google Drive API**.
2. **Create OAuth 2.0 credentials** (Desktop App type).
3. Download the `credentials.json` file.
4. **Get a Gemini API key** from [Google AI Studio](https://aistudio.google.com/app/apikey).

---

## Setup

### 1. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Edit .env and set your GOOGLE_API_KEY
notepad .env   # or use any editor
```

**Configure `.env`:**
```env
GOOGLE_API_KEY=your_key_from_aistudio
MCP_SERVER_COMMAND=npx
MCP_SERVER_ARGS=-y,@modelcontextprotocol/server-gdrive
```

### 2. Frontend

```bash
cd frontend
npm install      # already done
```

Edit `frontend/.env.local` if your backend runs on a different port:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Running the App

### Terminal 1 — Backend
```bash
cd backend
venv\Scripts\activate   # Windows
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2 — Frontend
```bash
cd frontend
npm run dev
```

Then open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## First-Time Google Drive Authentication

The first time the backend starts the MCP server, it will open a browser window asking you to authorise access to your Google Drive. After authorisation, a token file is stored locally and subsequent requests won't require re-auth.

---

## File Type Support

| Format | Parser Used |
|--------|-------------|
| PDF | `pypdf` → `unstructured` fallback |
| Word (.docx, .doc) | `python-docx` → `unstructured` fallback |
| Excel (.xlsx, .xls) | `pandas` → `unstructured` fallback |
| CSV | `pandas` |
| PowerPoint (.pptx, .ppt) | `unstructured` |
| Google Docs / Sheets | Exported as text by MCP |
| Plain text, Markdown, JSON | Direct decode |
| Everything else | `unstructured` |

---

## Project Structure

```
mcp-testing/
├── backend/
│   ├── main.py              ← FastAPI app + CORS + /api/chat endpoint
│   ├── mcp_client.py        ← MCP stdio client + tool wrapping
│   ├── agent.py             ← LangChain ReAct agent (Gemini 2.5 Pro)
│   ├── document_parser.py   ← Modular file parsing pipeline
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   └── globals.css
    ├── components/
    │   ├── ChatWindow.tsx    ← Main chat UI
    │   ├── ChatMessage.tsx   ← Message bubble + markdown
    │   ├── ThinkingPanel.tsx ← Collapsible agent reasoning panel
    │   └── LoadingIndicator.tsx
    ├── lib/
    │   ├── api.ts            ← fetch wrapper for FastAPI
    │   └── types.ts          ← Shared TypeScript types
    └── .env.local
```

---

## RAG Evaluation (Future)

The `document_parser.py` module is deliberately decoupled from agent logic. To plug it into evaluation frameworks:

```python
from document_parser import parse_document, ParsedDocument

doc: ParsedDocument = parse_document(
    raw_bytes=file_bytes,
    file_name="report.pdf",
    mime_type="application/pdf",
    source_id="gdrive_file_id_123",
)

# doc.chunks  → list of text chunks for retrieval evaluation
# doc.full_text → full document text
# doc.metadata  → source metadata for tracing
```

Compatible with **RAGas**, **Arize Phoenix**, and **RAGAS** evaluation pipelines.
