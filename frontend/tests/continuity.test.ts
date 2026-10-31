import { describe, it, expect, vi, beforeEach } from "vitest";
import { createReflection, toContinuity } from "../src/api/continuity";
import { useApp } from "../src/store/useApp";
describe("backend reflection contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useApp.getState().logout();
  });
  it("omits raw content and unexpected fields", () => {
    const input = {
      id: "1",
      date: "2026-09-14",
      mode: "Written" as const,
      raw: "PRIVATE",
      observation: "A check-in was shared",
      secret: "PRIVATE",
    };
    expect(toContinuity(input)).toEqual({
      id: "1",
      date: "2026-09-14",
      mode: "Written",
      observation: "A check-in was shared",
    });
  });
  it("rejects empty entries", async () => {
    await expect(createReflection("  ", "Written")).rejects.toThrow();
  });
  it("requires authentication", async () => {
    await expect(createReflection("Hello", "Written")).rejects.toThrow(
      "sign in",
    );
  });
  it("maps server response and only keeps own submitted reflection", async () => {
    useApp.setState({
      identity: { id: "ananya", name: "Ananya Sharma", role: "STUDENT" },
      role: "user",
    });
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/api/chat/sessions")) return new Response(JSON.stringify({ session_id: "session-1" }), { status: 201 });
      if (String(url).endsWith("/text-turns")) return new Response(JSON.stringify({ turn_id: "server-id", transcript: "A personal reflection", reply: "Thank you for sharing." }), { status: 200 });
      return new Response(JSON.stringify({ session_id: "session-1", ended: true }), { status: 200 });
    });
    const entry = await createReflection(" A personal reflection ", "Voice");
    expect(entry.id).toBe("server-id");
    expect(entry.raw).toBe("A personal reflection");
    expect(entry.mode).toBe("Voice");
    expect(String(fetcher.mock.calls[1][0])).toMatch(/text-turns$/);
  });
});

