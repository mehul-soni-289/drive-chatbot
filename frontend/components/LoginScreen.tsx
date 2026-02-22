"use client";

import { HardDrive, Sparkles, Shield, FileText, Search, Zap } from "lucide-react";
import { getLoginUrl } from "@/lib/api";

export default function LoginScreen() {
    const handleLogin = () => {
        window.location.href = getLoginUrl();
    };

    return (
        <div
            className="flex flex-col items-center justify-center min-h-screen px-4"
            style={{ background: "var(--bg-primary)" }}
        >
            {/* Hero */}
            <div className="text-center space-y-6 max-w-lg">
                {/* App Icon */}
                <div
                    className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center"
                    style={{
                        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
                        boxShadow: "0 0 48px rgba(99, 102, 241, 0.4), 0 0 96px rgba(139, 92, 246, 0.2)",
                    }}
                >
                    <HardDrive size={36} className="text-white" />
                </div>

                <div>
                    <h1
                        className="text-3xl font-bold tracking-tight"
                        style={{ color: "var(--text-primary)" }}
                    >
                        Drive Chatbot
                    </h1>
                    <p
                        className="text-base mt-2"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        AI-powered conversations with your Google Drive files
                    </p>
                </div>

                {/* Feature pills */}
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                    {[
                        { icon: <Search size={16} />, label: "Smart Search" },
                        { icon: <FileText size={16} />, label: "Any File Type" },
                        { icon: <Zap size={16} />, label: "Gemini AI" },
                    ].map(({ icon, label }) => (
                        <div
                            key={label}
                            className="flex flex-col items-center gap-2 px-3 py-3 rounded-xl"
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border)",
                            }}
                        >
                            <span style={{ color: "var(--accent-light)" }}>{icon}</span>
                            <span
                                className="text-xs font-medium"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                {label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Login Button */}
                <button
                    id="login-button"
                    onClick={handleLogin}
                    className="flex items-center gap-3 mx-auto px-8 py-3.5 rounded-2xl text-sm font-semibold transition-all"
                    style={{
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        color: "white",
                        boxShadow: "0 0 24px rgba(99, 102, 241, 0.4)",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow =
                            "0 0 36px rgba(99, 102, 241, 0.6)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow =
                            "0 0 24px rgba(99, 102, 241, 0.4)";
                        e.currentTarget.style.transform = "translateY(0)";
                    }}
                >
                    {/* Google "G" icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                            fill="#fff"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#fff"
                            fillOpacity="0.8"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A9.995 9.995 0 0 0 2 12c0 1.61.39 3.14 1.07 4.49l3.77-2.4z"
                            fill="#fff"
                            fillOpacity="0.6"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#fff"
                            fillOpacity="0.9"
                        />
                    </svg>
                    Sign in with Google
                </button>

                {/* Security note */}
                <div
                    className="flex items-center gap-2 justify-center text-xs"
                    style={{ color: "var(--text-muted)" }}
                >
                    <Shield size={12} />
                    <span>Read-only access · Your data stays private</span>
                </div>

                {/* Supported formats */}
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {["PDF", "Word", "Sheets", "Slides", "CSV", "Google Docs"].map(
                        (t) => (
                            <span
                                key={t}
                                className="text-[10px] px-2.5 py-1 rounded-full"
                                style={{
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border)",
                                    color: "var(--text-muted)",
                                }}
                            >
                                {t}
                            </span>
                        )
                    )}
                </div>
            </div>

            {/* Footer */}
            <p
                className="absolute bottom-4 text-[10px]"
                style={{ color: "var(--text-muted)" }}
            >
                Powered by Gemini · Google Drive API · LangChain
            </p>
        </div>
    );
}
