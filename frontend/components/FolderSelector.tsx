"use client";

import { useState, useEffect } from "react";
import { Folder, ChevronDown, Check, X, Search } from "lucide-react";
import { fetchFolders } from "@/lib/api";

interface FolderSelectorProps {
    token: string;
    onSelect: (folderId: string | null) => void;
    selectedId: string | null;
}

export default function FolderSelector({ token, onSelect, selectedId }: FolderSelectorProps) {
    const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && folders.length === 0) {
            setLoading(true);
            fetchFolders(token)
                .then(setFolders)
                .finally(() => setLoading(false));
        }
    }, [isOpen, token, folders.length]);

    const selectedFolder = folders.find(f => f.id === selectedId);

    const filteredFolders = folders.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                    background: selectedId ? "var(--accent-glow)" : "var(--bg-secondary)",
                    border: "1px solid",
                    borderColor: selectedId ? "var(--accent)" : "var(--border)",
                    color: selectedId ? "var(--accent-light)" : "var(--text-secondary)",
                }}
            >
                <Folder size={14} className={selectedId ? "text-accent-light" : "text-muted"} />
                <span className="max-w-[120px] truncate">
                    {selectedId ? (selectedFolder?.name || "Selected Folder") : "Whole Drive"}
                </span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div
                    className="absolute top-full left-0 mt-2 w-64 rounded-xl border z-50 overflow-hidden shadow-2xl"
                    style={{
                        background: "var(--bg-card)",
                        borderColor: "var(--border)",
                        backdropFilter: "blur(12px)"
                    }}
                >
                    <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search folders..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-secondary text-xs rounded-md pl-8 pr-3 py-1.5 outline-none"
                                style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                        <button
                            onClick={() => {
                                onSelect(null);
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-hover"
                            style={{ color: "var(--text-primary)" }}
                        >
                            <span className="flex items-center gap-2">
                                <Search size={14} className="text-muted" />
                                Entire Drive
                            </span>
                            {!selectedId && <Check size={14} className="text-success" />}
                        </button>

                        {loading ? (
                            <div className="px-3 py-4 text-center text-xs text-muted">Loading folders...</div>
                        ) : filteredFolders.length > 0 ? (
                            filteredFolders.map((folder) => (
                                <button
                                    key={folder.id}
                                    onClick={() => {
                                        onSelect(folder.id);
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-hover text-left"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        <Folder size={14} className="text-muted shrink-0" />
                                        <span className="truncate">{folder.name}</span>
                                    </span>
                                    {selectedId === folder.id && <Check size={14} className="text-success shrink-0" />}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-muted">No folders found</div>
                        )}
                    </div>

                    {selectedId && (
                        <div className="p-1 border-t" style={{ borderColor: "var(--border)" }}>
                            <button
                                onClick={() => {
                                    onSelect(null);
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider font-bold transition-colors hover:bg-hover"
                                style={{ color: "var(--error)" }}
                            >
                                <X size={12} />
                                Clear Selection
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Backdrop for closing */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
