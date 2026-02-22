"use client";

import { useState, useEffect } from "react";
import { User } from "@/lib/types";
import ChatWindow from "@/components/ChatWindow";
import LoginScreen from "@/components/LoginScreen";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check URL params for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const name = params.get("name");
    const email = params.get("email");
    const picture = params.get("picture");

    if (token && email) {
      const newUser: User = {
        token,
        name: name || "User",
        email,
        picture: picture || "",
      };
      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);

      // Clean URL
      window.history.replaceState({}, "", "/");
    } else {
      // Try to restore session from localStorage
      const stored = localStorage.getItem("user");
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          localStorage.removeItem("user");
        }
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="flex items-center gap-3">
          <svg
            className="animate-spin"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-light)"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span style={{ color: "var(--text-secondary)" }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <ChatWindow user={user} onLogout={handleLogout} />;
}
