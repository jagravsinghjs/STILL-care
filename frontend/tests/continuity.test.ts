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
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "server-id",
            created_at: "2026-09-15T00:00:00Z",
            mode: "voice",
            summary: "A new check-in",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );
    const entry = await createReflection(" A personal reflection ", "Voice");
    expect(entry.id).toBe("server-id");
    expect(entry.raw).toBe("A personal reflection");
    expect(entry.mode).toBe("Voice");
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({
      patient_id: "ananya",
      mode: "voice",
      content: "A personal reflection",
    });
  });
});

