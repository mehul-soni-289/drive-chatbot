"use client";

import { HardDrive, Search, FileText, Cpu } from "lucide-react";

type Stage = "searching" | "reading" | "thinking" | "idle";

interface LoadingIndicatorProps {
    stage: Stage;
}

const STAGE_CONFIG: Record<Stage, { icon: React.ReactNode; label: string; color: string }> = {
    searching: {
        icon: <Search size={14} />,
        label: "Searching Google Drive…",
        color: "var(--accent-light)",
    },
    reading: {
        icon: <FileText size={14} />,
        label: "Parsing file contents…",
        color: "var(--warning)",
    },
    thinking: {
        icon: <Cpu size={14} />,
        label: "Synthesising answer…",
        color: "var(--success)",
    },
    idle: {
        icon: null,
        label: "",
        color: "",
    },
};

export default function LoadingIndicator({ stage }: LoadingIndicatorProps) {
    if (stage === "idle") return null;

    const { icon, label, color } = STAGE_CONFIG[stage];

    return (
        <div className="flex gap-3 px-4 py-3 animate-fade-in-up">
            {/* Bot avatar placeholder */}
            <div
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                    background: "linear-gradient(135deg, #1a1a2e, #16213e)",
                    border: "1px solid var(--border)",
                }}
            >
                <HardDrive size={14} style={{ color: "var(--accent-light)" }} />
            </div>

            {/* Status badge */}
            <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm"
                style={{
                    background: "var(--assistant-bubble)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px 18px 18px 18px",
                    color,
                }}
            >
                {/* Spinner */}
                <svg
                    className="animate-spin"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {icon}
                <span className="font-medium">{label}</span>

                {/* Animated dots */}
                <span className="flex gap-0.5 ml-1">
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className="w-1 h-1 rounded-full"
                            style={{
                                background: color,
                                animation: `pulse-ring 1.2s ease-in-out ${i * 0.2}s infinite`,
                            }}
                        />
                    ))}
                </span>
            </div>
        </div>
    );
}
