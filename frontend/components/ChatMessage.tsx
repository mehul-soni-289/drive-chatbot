"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, AlertCircle } from "lucide-react";
import { Message } from "@/lib/types";
import ThinkingPanel from "./ThinkingPanel";

interface ChatMessageProps {
    message: Message;
}

function formatTime(date: Date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";

    return (
        <div
            className={`flex gap-3 px-4 py-3 animate-fade-in-up ${isUser ? "flex-row-reverse" : "flex-row"
                }`}
        >
            {/* Avatar */}
            <div
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                style={{
                    background: isUser
                        ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                        : "linear-gradient(135deg, #1a1a2e, #16213e)",
                    border: isUser ? "none" : "1px solid var(--border)",
                    boxShadow: isUser ? "0 0 12px var(--accent-glow)" : "none",
                }}
            >
                {isUser ? (
                    <User size={15} className="text-white" />
                ) : (
                    <Bot size={15} style={{ color: "var(--accent-light)" }} />
                )}
            </div>

            {/* Bubble */}
            <div className={`max-w-[80%] min-w-0 ${isUser ? "items-end flex flex-col" : ""}`}>
                <div
                    className="rounded-2xl px-4 py-3"
                    style={{
                        background: isUser ? "var(--user-bubble)" : "var(--assistant-bubble)",
                        border: `1px solid ${isUser ? "var(--user-border)" : "var(--border)"}`,
                        boxShadow: isUser
                            ? "0 2px 12px rgba(99,102,241,0.15)"
                            : "0 1px 4px rgba(0,0,0,0.3)",
                        borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                    }}
                >
                    {message.isError ? (
                        <div className="flex items-start gap-2" style={{ color: "var(--error)" }}>
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <p className="text-sm">{message.content}</p>
                        </div>
                    ) : isUser ? (
                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                            {message.content}
                        </p>
                    ) : (
                        <div className="prose max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Thinking panel — only for assistant messages */}
                {!isUser && message.steps && message.steps.length > 0 && (
                    <div className="w-full">
                        <ThinkingPanel steps={message.steps} />
                    </div>
                )}

                {/* Timestamp & Tokens */}
                <div className="flex items-center gap-2 mt-1 px-1">
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {formatTime(message.timestamp)}
                    </p>
                    {!isUser && message.tokens !== undefined && message.tokens > 0 && (
                        <>
                            <span className="text-[10px]" style={{ color: "var(--border-light)" }}>•</span>
                            <p className="text-[10px] font-medium" style={{ color: "var(--accent-light)" }}>
                                {message.tokens.toLocaleString()} tokens
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
