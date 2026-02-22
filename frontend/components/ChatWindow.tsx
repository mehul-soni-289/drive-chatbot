"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Trash2, HardDrive, Sparkles, Bot, LogOut, Folder } from "lucide-react";
import { Message, User } from "@/lib/types";
import { sendChatMessage, logoutUser } from "@/lib/api";
import ChatMessage from "@/components/ChatMessage";
import LoadingIndicator from "@/components/LoadingIndicator";
import FolderSelector from "@/components/FolderSelector";

type LoadingStage = "idle" | "searching" | "reading" | "thinking";

interface ChatWindowProps {
    user: User;
    onLogout: () => void;
}

const SUGGESTED_QUERIES = [
    "What are the main topics in my recent documents?",
    "Summarize the latest spreadsheet I uploaded.",
    "Find any meeting notes from last week.",
    "What contracts do I have in Drive?",
];

function generateId() {
    return Math.random().toString(36).slice(2, 11);
}

export default function ChatWindow({ user, onLogout }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loadingStage, setLoadingStage] = useState<LoadingStage>("idle");
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        }, 50);
    }, []);

    useEffect(scrollToBottom, [messages, loadingStage, scrollToBottom]);

    const handleSend = useCallback(async () => {
        const text = input.trim();
        if (!text || loadingStage !== "idle") return;

        const userMsg: Message = {
            id: generateId(),
            role: "user",
            content: text,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        inputRef.current?.focus();

        setLoadingStage("searching");
        const stageTimer1 = setTimeout(() => setLoadingStage("reading"), 3500);
        const stageTimer2 = setTimeout(() => setLoadingStage("thinking"), 8000);

        try {
            const history = messages
                .slice(-10)
                .map((m) => ({ role: m.role, content: m.content }));

            const response = await sendChatMessage(text, history, user.token, selectedFolderId || undefined);

            clearTimeout(stageTimer1);
            clearTimeout(stageTimer2);
            setLoadingStage("idle");

            const assistantMsg: Message = {
                id: generateId(),
                role: "assistant",
                content: response.error
                    ? `❌ ${response.error}`
                    : response.answer || "No response generated.",
                timestamp: new Date(),
                steps: response.intermediate_steps,
                tokens: response.tokens,
                isError: !!response.error,
            };

            setMessages((prev) => [...prev, assistantMsg]);
        } catch (err: unknown) {
            clearTimeout(stageTimer1);
            clearTimeout(stageTimer2);
            setLoadingStage("idle");

            const errMsg = err instanceof Error ? err.message : "Unknown error";
            const errorMsg: Message = {
                id: generateId(),
                role: "assistant",
                content: `Failed to reach the backend: ${errMsg}`,
                timestamp: new Date(),
                isError: true,
            };
            setMessages((prev) => [...prev, errorMsg]);
        }
    }, [input, loadingStage, messages, user.token, selectedFolderId]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleClear = () => {
        setMessages([]);
        setInput("");
        inputRef.current?.focus();
    };

    const handleLogout = async () => {
        await logoutUser(user.token);
        onLogout();
    };

    const isLoading = loadingStage !== "idle";

    return (
        <div className="flex flex-col h-screen" style={{ background: "var(--bg-primary)" }}>
            {/* ── Header ── */}
            <header
                className="shrink-0 flex items-center justify-between px-5 py-3 border-b"
                style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{
                            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                            boxShadow: "0 0 16px var(--accent-glow)",
                        }}
                    >
                        <HardDrive size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                            Drive Chatbot
                        </h1>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Gemini 2.5 · Google Drive API
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{
                            background: isLoading ? "var(--warning)" : "var(--success)",
                            boxShadow: `0 0 6px ${isLoading ? "var(--warning)" : "var(--success)"}`,
                        }}
                    />
                    <span className="text-[11px] mr-2" style={{ color: "var(--text-muted)" }}>
                        {isLoading ? "Processing…" : "Ready"}
                    </span>

                    <FolderSelector
                        token={user.token}
                        selectedId={selectedFolderId}
                        onSelect={setSelectedFolderId}
                    />

                    {/* User avatar / info */}
                    <div className="flex items-center gap-2 ml-2">
                        {user.picture ? (
                            <img
                                src={user.picture}
                                alt={user.name}
                                className="w-7 h-7 rounded-full"
                                style={{ border: "1px solid var(--border)" }}
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={{
                                    background: "var(--bg-hover)",
                                    border: "1px solid var(--border)",
                                    color: "var(--text-primary)",
                                }}
                            >
                                {user.name[0]?.toUpperCase()}
                            </div>
                        )}
                        <span
                            className="text-xs hidden sm:inline"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            {user.name}
                        </span>
                    </div>

                    {messages.length > 0 && (
                        <button
                            onClick={handleClear}
                            title="Clear chat"
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                        >
                            <Trash2 size={15} />
                        </button>
                    )}

                    <button
                        onClick={handleLogout}
                        title="Sign out"
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </header>

            {/* ── Messages ── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-8 px-4">
                        <div className="text-center space-y-3">
                            <div
                                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                                style={{
                                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                                    boxShadow: "0 0 32px var(--accent-glow)",
                                }}
                            >
                                <Sparkles size={28} className="text-white" />
                            </div>
                            <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                                Hi {user.name.split(" ")[0]}, ask anything about your Drive
                            </h2>
                            <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
                                I&apos;ll search your Google Drive files, parse documents of any format,
                                and synthesise a comprehensive answer using Gemini.
                            </p>
                            {selectedFolderId && (
                                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-accent-light bg-accent-glow py-2 px-4 rounded-full border border-accent animate-pulse">
                                    <Folder size={16} />
                                    <span>Searching restricted to selected folder</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
                            {SUGGESTED_QUERIES.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => setInput(q)}
                                    className="text-left px-4 py-3 rounded-xl text-sm transition-all"
                                    style={{
                                        background: "var(--bg-card)",
                                        border: "1px solid var(--border)",
                                        color: "var(--text-secondary)",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = "var(--accent)";
                                        e.currentTarget.style.color = "var(--text-primary)";
                                        e.currentTarget.style.background = "var(--bg-hover)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = "var(--border)";
                                        e.currentTarget.style.color = "var(--text-secondary)";
                                        e.currentTarget.style.background = "var(--bg-card)";
                                    }}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-2 justify-center">
                            {["PDF", "Word", "Spreadsheets", "Google Docs", "CSV", "Presentations"].map((t) => (
                                <span
                                    key={t}
                                    className="text-xs px-3 py-1 rounded-full"
                                    style={{
                                        background: "var(--bg-input)",
                                        border: "1px solid var(--border)",
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="py-4">
                        {messages.map((msg) => (
                            <ChatMessage key={msg.id} message={msg} />
                        ))}
                        {isLoading && <LoadingIndicator stage={loadingStage} />}
                    </div>
                )}
            </div>

            {/* ── Input Bar ── */}
            <div
                className="shrink-0 px-4 py-4 border-t"
                style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
            >
                <div
                    className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all"
                    style={{
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-light)",
                        boxShadow: "0 0 0 0 var(--accent-glow)",
                    }}
                    onFocusCapture={(e) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.borderColor = "var(--accent)";
                        el.style.boxShadow = "0 0 0 3px var(--accent-glow)";
                    }}
                    onBlurCapture={(e) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.borderColor = "var(--border-light)";
                        el.style.boxShadow = "none";
                    }}
                >
                    <Bot size={18} className="mb-1 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <textarea
                        ref={inputRef}
                        id="chat-input"
                        rows={1}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedFolderId ? "Search within selected folder..." : "Ask about your Drive files…"}
                        disabled={isLoading}
                        className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed py-0.5"
                        style={{
                            color: "var(--text-primary)",
                            caretColor: "var(--accent-light)",
                            maxHeight: "180px",
                        }}
                    />
                    <button
                        id="send-button"
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                        style={{
                            background:
                                isLoading || !input.trim()
                                    ? "var(--bg-hover)"
                                    : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                            boxShadow:
                                !isLoading && input.trim() ? "0 0 12px var(--accent-glow)" : "none",
                        }}
                    >
                        {isLoading ? (
                            <svg
                                className="animate-spin"
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--text-muted)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            >
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                        ) : (
                            <Send
                                size={15}
                                style={{ color: input.trim() ? "white" : "var(--text-muted)" }}
                            />
                        )}
                    </button>
                </div>
                <p className="text-center text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                    Signed in as {user.email} · Responses generated by Gemini
                </p>
            </div>
        </div>
    );
}
