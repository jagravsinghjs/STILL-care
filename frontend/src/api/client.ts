const base =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL || "http://127.0.0.1:8000";
let token: string | null = null;
export function setToken(value: string | null) {
  token = value;
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || "Unable to complete the request. Please try again.",
    );
  }
  return response.json() as Promise<T>;
}
export interface Identity {
  id: string;
  name: string;
  role: "STUDENT" | "SUPERVISOR";
}
export interface ApiSummary {
  id: string;
  patient_id: string;
  mode: "written" | "voice";
  created_at: string;
  summary: string;
  attention_state: "GREEN" | "YELLOW" | "RED";
  trend: "IMPROVING" | "WORSENING" | "NO_CLEAR_CHANGE";
  themes: string[];
  processing_mode: "mock" | "integrated";
}
export interface ApiPatient {
  id: string;
  name: string;
  initials: string;
  context: string;
  supervisor_id: string;
  attention_state: ApiSummary["attention_state"] | null;
  trend: ApiSummary["trend"];
  summary: string;
}
export interface ApiMessage {
  id: string;
  patient_id: string;
  sender: "user" | "supervisor";
  content: string;
  created_at: string;
}
export interface ApiAlert {
  id: string;
  patient_id: string;
  status: "open" | "acknowledged" | "resolved";
}
export const toContinuity = (s: ApiSummary) => ({
  id: s.id,
  date: s.created_at,
  mode: s.mode === "voice" ? ("Voice" as const) : ("Written" as const),
  observation: s.summary,
});
export const toMessage = (m: ApiMessage) => ({
  id: m.id,
  userId: m.patient_id,
  sender: m.sender,
  text: m.content,
  date: m.created_at,
});
export const toUser = (p: ApiPatient) => ({
  ...p,
  status: (
    {
      GREEN: "Stable",
      YELLOW: "Monitoring",
      RED: "Increasing concern",
    } as const
  )[p.attention_state ?? "GREEN"],
  trend: (
    {
      IMPROVING: "Improving",
      WORSENING: "Worsening",
      NO_CLEAR_CHANGE: "No clear change",
    } as const
  )[p.trend],
});
