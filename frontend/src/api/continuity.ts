import type { Continuity, Reflection } from "../types";
import { request, toContinuity as mapSummary, type ApiSummary } from "./client";
import { useApp } from "../store/useApp";
export function toContinuity(item: Reflection): Continuity {
  return {
    id: item.id,
    date: item.date,
    mode: item.mode,
    observation: item.observation,
  };
}
export async function createReflection(
  raw: string,
  mode: Reflection["mode"],
): Promise<Reflection> {
  if (!raw.trim()) throw new Error("Add a few words before submitting.");
  const identity = useApp.getState().identity;
  if (!identity || identity.role !== "STUDENT")
    throw new Error("Please sign in to check in.");
  const result = await request<ApiSummary>("/api/checkins", {
    method: "POST",
    body: JSON.stringify({
      patient_id: identity.id,
      mode: mode === "Voice" ? "voice" : "written",
      content: raw.trim(),
    }),
  });
  return { ...mapSummary(result), raw: raw.trim() };
}
