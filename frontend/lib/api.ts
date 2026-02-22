import { ChatResponse, User } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Send a chat message to the backend (authenticated).
 */
export async function sendChatMessage(
    message: string,
    history: { role: string; content: string }[],
    token: string,
    folder_id?: string
): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, history, folder_id }),
    });

    if (response.status === 401) {
        // Token expired or invalid — clear session
        localStorage.removeItem("user");
        window.location.href = "/";
        throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error ${response.status}: ${text}`);
    }

    const data: ChatResponse = await response.json();
    return data;
}

/**
 * Fetch folders from Google Drive.
 */
export async function fetchFolders(token: string): Promise<{ id: string; name: string }[]> {
    const response = await fetch(`${API_BASE}/api/folders`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.folders ?? [];
}

/**
 * Get the Google OAuth login URL.
 */
export function getLoginUrl(): string {
    return `${API_BASE}/oauth/login`;
}

/**
 * Fetch current user info from the backend.
 */
export async function fetchUserInfo(token: string): Promise<User | null> {
    try {
        const response = await fetch(`${API_BASE}/oauth/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return null;
        const data = await response.json();
        return { ...data, token };
    } catch {
        return null;
    }
}

/**
 * Logout the current user.
 */
export async function logoutUser(token: string): Promise<void> {
    try {
        await fetch(`${API_BASE}/oauth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch {
        // Ignore errors — we clear local state regardless
    }
    localStorage.removeItem("user");
}
