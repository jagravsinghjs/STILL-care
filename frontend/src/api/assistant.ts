import { request } from "./client";

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TurnResponse {
  turn_id: string;
  transcript: string;
  reply: string;
}

export const startSession = () =>
  request<{ session_id: string }>("/api/chat/sessions", { method: "POST" });

export const sendAudioTurn = (sessionId: string, blob: Blob) => {
  const body = new FormData();
  body.append("audio", blob, "recording.webm");
  return request<TurnResponse>(`/api/chat/sessions/${sessionId}/turns`, {
    method: "POST",
    body,
  });
};

export const sendTextTurn = (sessionId: string, text: string) =>
  request<TurnResponse>(`/api/chat/sessions/${sessionId}/text-turns`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

export const endSession = (sessionId: string) =>
  request<{ session_id: string; ended: boolean }>(`/api/chat/sessions/${sessionId}/end`, {
    method: "POST",
  });
