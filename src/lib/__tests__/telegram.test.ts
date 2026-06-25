import { describe, it, expect } from "vitest";
import { formatCoachReportForTelegram, extractChatFromUpdates } from "@/lib/telegram";
import type { CoachReport } from "@/lib/coach";

const RHYTHM: NonNullable<CoachReport["rhythm"]> = {
  cadence: 72,
  state: "in-rhythm",
  stateLabel: "In Rhythm",
  delta: 4,
  acwr: 1.1,
  acwrLabel: "Sustainable",
};

describe("formatCoachReportForTelegram", () => {
  it("includes the headline", () => {
    const report: CoachReport = { headline: "You're in rhythm.", insights: [], recommendations: [] };
    const text = formatCoachReportForTelegram(report);
    expect(text).toContain("You're in rhythm.");
  });

  it("leads with the rhythm header when present", () => {
    const report: CoachReport = {
      rhythm: RHYTHM,
      headline: "Steady hands.",
      insights: [],
      recommendations: [],
    };
    const text = formatCoachReportForTelegram(report);
    expect(text).toContain("Cadence 72");
    expect(text).toContain("In Rhythm");
    expect(text).toContain("↑4");
    expect(text).toContain("Sustainable");
    // header comes before the headline
    expect(text.indexOf("Cadence 72")).toBeLessThan(text.indexOf("Steady hands."));
  });

  it("omits the load line when ACWR is unknown", () => {
    const report: CoachReport = {
      rhythm: { ...RHYTHM, acwrLabel: "—", acwr: 0 },
      headline: "Hi.",
      insights: [],
      recommendations: [],
    };
    expect(formatCoachReportForTelegram(report)).not.toContain("Load:");
  });

  it("renders insights and recommendations with markers", () => {
    const report: CoachReport = {
      headline: "Keep going.",
      insights: [{ id: "a", tone: "good", text: "Mondays are strong." }],
      recommendations: [{ id: "b", tone: "warn", text: "Log your run." }],
    };
    const text = formatCoachReportForTelegram(report);
    expect(text).toContain("• Mondays are strong.");
    expect(text).toContain("→ Log your run.");
    expect(text).toContain("What I'm seeing:");
    expect(text).toContain("What to do:");
  });

  it("omits empty sections", () => {
    const report: CoachReport = { headline: "Hi.", insights: [], recommendations: [] };
    const text = formatCoachReportForTelegram(report);
    expect(text).not.toContain("What I'm seeing");
    expect(text).not.toContain("What to do");
  });
});

describe("extractChatFromUpdates", () => {
  it("returns null for malformed payloads", () => {
    expect(extractChatFromUpdates(null)).toBeNull();
    expect(extractChatFromUpdates({})).toBeNull();
    expect(extractChatFromUpdates({ result: "nope" })).toBeNull();
    expect(extractChatFromUpdates({ result: [] })).toBeNull();
  });

  it("picks the most recent chat and prefers first_name", () => {
    const payload = {
      result: [
        { message: { chat: { id: 1, first_name: "Old" } } },
        { message: { chat: { id: 42, first_name: "Jay", username: "jmak" } } },
      ],
    };
    expect(extractChatFromUpdates(payload)).toEqual({ id: 42, name: "Jay" });
  });

  it("falls back to username then a default", () => {
    expect(extractChatFromUpdates({ result: [{ message: { chat: { id: 7, username: "jmak" } } }] })).toEqual({
      id: 7,
      name: "jmak",
    });
    expect(extractChatFromUpdates({ result: [{ message: { chat: { id: 8 } } }] })).toEqual({
      id: 8,
      name: "there",
    });
  });

  it("skips updates without a chat id", () => {
    const payload = { result: [{ message: { chat: { id: 5, first_name: "A" } } }, { edited_message: {} }] };
    expect(extractChatFromUpdates(payload)).toEqual({ id: 5, name: "A" });
  });
});
