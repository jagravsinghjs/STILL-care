import { request } from "./client";
export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}
export type AssistantMode = "mock" | "integrated";
export const assistantStatus = () =>
  request<{ mode: AssistantMode }>("/api/assistant/status");
export const replyToSession = (messages: AssistantTurn[]) =>
  request<{ reply: string; mode: AssistantMode }>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
