// Types shared across the chat UI

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    steps?: IntermediateStep[];
    isError?: boolean;
    tokens?: number;
}

export interface IntermediateStep {
    thought: string;
    action: string;
    action_input: string | number | boolean | Record<string, unknown> | null;
    observation: string;
}

export interface ChatResponse {
    answer: string;
    intermediate_steps: IntermediateStep[];
    tokens: number;
    error: string | null;
}

export interface User {
    email: string;
    name: string;
    picture: string;
    token: string; // JWT
}
