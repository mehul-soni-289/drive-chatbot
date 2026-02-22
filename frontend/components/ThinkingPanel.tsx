"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Search, FileText, Eye } from "lucide-react";
import { IntermediateStep } from "@/lib/types";

interface ThinkingPanelProps {
    steps: IntermediateStep[];
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
    gdrive_search: <Search size={13} />,
    gdrive_read_file: <FileText size={13} />,
    read_file: <FileText size={13} />,
};

function getActionIcon(action: string) {
    return ACTION_ICONS[action] ?? <Eye size={13} />;
}

function truncate(str: string, max = 240) {
    return str.length > max ? str.slice(0, max) + "…" : str;
}

export default function ThinkingPanel({ steps }: ThinkingPanelProps) {
    const [open, setOpen] = useState(false);

    if (!steps || steps.length === 0) return null;

    return (
        <div className="mt-3 rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors"
                style={{ color: "var(--text-secondary)" }}
            >
                <span className="text-xs font-medium tracking-wide uppercase">
                    Agent reasoning ({steps.length} step{steps.length !== 1 ? "s" : ""})
                </span>
                <span className="ml-auto">
                    {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>

            {open && (
                <div className="divide-y px-3 pb-3" style={{ borderColor: "var(--border)" }}>
                    {steps.map((step, i) => (
                        <div key={i} className="py-3 space-y-1.5">
                            {/* Thought */}
                            {step.thought && (
                                <div className="flex gap-2">
                                    <span className="text-[10px] uppercase font-semibold mt-0.5 w-16 shrink-0"
                                        style={{ color: "var(--accent-light)" }}>
                                        Thought
                                    </span>
                                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                        {truncate(step.thought)}
                                    </p>
                                </div>
                            )}
                            {/* Action */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-semibold w-16 shrink-0"
                                    style={{ color: "var(--warning)" }}>
                                    Action
                                </span>
                                <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                                    style={{ background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                                    {getActionIcon(step.action)}
                                    {step.action}
                                </span>
                                {step.action_input !== null && step.action_input !== undefined && (
                                    <code className="text-xs truncate max-w-xs" style={{ color: "var(--text-muted)" }}>
                                        {typeof step.action_input === "string"
                                            ? truncate(step.action_input, 80)
                                            : truncate(JSON.stringify(step.action_input as Record<string, unknown>), 80)}
                                    </code>
                                )}
                            </div>
                            {/* Observation */}
                            {step.observation && (
                                <div className="flex gap-2">
                                    <span className="text-[10px] uppercase font-semibold mt-0.5 w-16 shrink-0"
                                        style={{ color: "var(--success)" }}>
                                        Result
                                    </span>
                                    <p className="text-xs leading-relaxed font-mono"
                                        style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                        {truncate(step.observation, 300)}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
