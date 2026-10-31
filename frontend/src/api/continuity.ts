import type { Continuity, Reflection } from "../types";
import { useApp } from "../store/useApp";
import { endSession, sendTextTurn, startSession } from "./assistant";
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
  const session = await startSession();
  const result = await sendTextTurn(session.session_id, raw.trim());
  await endSession(session.session_id);
  const now = new Date().toISOString();
  return {
    id: result.turn_id,
    date: now,
    mode,
    observation: result.reply,
    raw: raw.trim(),
  };
}
