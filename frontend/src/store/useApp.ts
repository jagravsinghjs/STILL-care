import { create } from "zustand";
import type { Role, Reflection, Message, User, Continuity } from "../types";
import {
  request,
  setToken,
  toContinuity,
  toMessage,
  toUser,
  type Identity,
  type ApiSummary,
  type ApiPatient,
  type ApiMessage,
  type ApiAlert,
  type ApiSession,
  type ApiTrendPoint,
} from "../api/client";
interface State {
  role: Role | null;
  identity: Identity | null;
  reports: ApiSummary[];
  supervisorName: string;
  reflections: Reflection[];
  messages: Message[];
  users: User[];
  summaries: Record<string, Continuity[]>;
  alerts: ApiAlert[];
  trend: ApiTrendPoint[];
  status: "green" | "yellow" | "red" | "not_assessed";
  followed: string[];
  error: string;
  login: (
    email: string,
    password: string,
    expectedRole?: Role,
  ) => Promise<Role>;
  logout: () => void;
  refresh: () => Promise<void>;
  addReflection: (r: Reflection) => void;
  send: (m: Message) => Promise<void>;
  follow: (id: string) => Promise<void>;
}
const empty = {
  role: null,
  identity: null,
  reports: [],
  supervisorName: "",
  reflections: [],
  messages: [],
  users: [],
  summaries: {},
  alerts: [],
  trend: [],
  status: "not_assessed" as const,
  followed: [],
  error: "",
};
export const useApp = create<State>((set, get) => ({
  ...empty,
  login: async (email, password, expectedRole) => {
    setToken(null);
    set({ ...empty });
    const auth = await request<{ access_token: string; user: Identity }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    const role = auth.user.role === "SUPERVISOR" ? "supervisor" : "user";
    if (expectedRole && role !== expectedRole)
      throw new Error("Use the correct login tab for this account.");
    setToken(auth.access_token);
    set({ identity: auth.user, role });
    try {
      await get().refresh();
      return role;
    } catch (e) {
      get().logout();
      throw e;
    }
  },
  logout: () => {
    setToken(null);
    set({ ...empty });
  },
  refresh: async () => {
    const identity = get().identity;
    if (!identity) return;
    const same = () => get().identity === identity;
    if (identity.role === "STUDENT") {
      const [sessions, status, trend] = await Promise.all([
        request<ApiSession[]>(`/api/patients/me/sessions`),
        request<{ tier: "green" | "yellow" | "red" | "not_assessed" }>(`/api/patients/me/status`),
        request<ApiTrendPoint[]>(`/api/patients/me/trend`),
      ]);
      const history: ApiSummary[] = sessions.filter((s) => s.computed_at).map((s) => ({
        id: s.session_id,
        patient_id: identity.id,
        mode: "voice",
        created_at: s.computed_at ?? s.start_time,
        summary: `${s.turn_count} processed turn${s.turn_count === 1 ? "" : "s"}`,
        attention_state: status.tier === "not_assessed" ? "GREEN" : status.tier.toUpperCase() as ApiSummary["attention_state"],
        trend: trend.length ? trend[trend.length - 1].trend_label === "improving" ? "IMPROVING" : trend[trend.length - 1].trend_label === "worsening" ? "WORSENING" : "NO_CLEAR_CHANGE" : "NO_CLEAR_CHANGE",
        themes: [], processing_mode: "integrated",
      }));
      if (same())
        set({
          reports: history,
          reflections: history.map((r) => ({ ...toContinuity(r), raw: "" })),
          messages: [],
          users: [],
          supervisorName: "",
          trend,
          status: status.tier,
          error: "",
        });
    } else {
      const [users] = await Promise.all([
        request<ApiPatient[]>("/api/supervisor/patients"),
      ]);
      const summaries = Object.fromEntries(
        await Promise.all(
          users.map(async (p) => [
            p.id,
            (
              await request<ApiSummary[]>(
                `/api/supervisor/patients/${p.id}/summaries`,
              )
            ).map(toContinuity),
          ]),
        ),
      );
      if (same())
        set({
          users: users.map(toUser),
          messages: [],
          summaries,
          alerts: [],
          reflections: [],
          followed: users
            .filter(
              (p) =>
                true,
            )
            .map((p) => p.id),
          error: "",
        });
    }
  },
  addReflection: (r) => set((s) => ({ reflections: [r, ...s.reflections] })),
  send: async (m) => {
    const identity = get().identity;
    const saved = await request<ApiMessage>("/api/messages", {
      method: "POST",
      body: JSON.stringify({ patient_id: m.userId, content: m.text }),
    });
    if (get().identity === identity)
      set((s) => ({ messages: [...s.messages, toMessage(saved)] }));
  },
  follow: async (id) => {
    try {
      await request("/api/supervisor/actions", {
        method: "POST",
        body: JSON.stringify({ patient_id: id, action: "reviewed" }),
      });
      for (const alert of get().alerts.filter(
        (a) => a.patient_id === id && a.status === "open",
      ))
        await request(`/api/supervisor/alerts/${alert.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "acknowledged" }),
        });
      await get().refresh();
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Unable to save the review.",
      });
    }
  },
}));
