import { describe, it, expect } from "vitest";
import {
  localDateStr,
  addDaysStr,
  dowOf,
  domOf,
  monthOf,
  userTimezone,
  localTimeParts,
  weekdayLabel,
  minuteLabel,
  DEFAULT_TZ,
} from "../date";

describe("localDateStr", () => {
  it("rolls the calendar day correctly across timezones near midnight", () => {
    // 2026-06-20T03:30:00Z is still the 19th in New York (UTC-4 in June)
    const instant = new Date("2026-06-20T03:30:00Z");
    expect(localDateStr(instant, "America/New_York")).toBe("2026-06-19");
    expect(localDateStr(instant, "UTC")).toBe("2026-06-20");
  });

  it("rolls forward for positive offsets", () => {
    // 2026-06-19T20:00:00Z is already the 20th in Tokyo (UTC+9)
    const instant = new Date("2026-06-19T20:00:00Z");
    expect(localDateStr(instant, "Asia/Tokyo")).toBe("2026-06-20");
  });

  it("defaults to UTC", () => {
    expect(localDateStr(new Date("2026-06-20T23:59:00Z"))).toBe("2026-06-20");
  });
});

describe("addDaysStr", () => {
  it("adds and subtracts days", () => {
    expect(addDaysStr("2026-06-20", 1)).toBe("2026-06-21");
    expect(addDaysStr("2026-06-20", -1)).toBe("2026-06-19");
  });

  it("crosses month boundaries", () => {
    expect(addDaysStr("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDaysStr("2026-07-01", -1)).toBe("2026-06-30");
  });

  it("crosses year boundaries", () => {
    expect(addDaysStr("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap years", () => {
    expect(addDaysStr("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysStr("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("dowOf / domOf / monthOf", () => {
  it("returns a tz-independent day of week", () => {
    expect(dowOf("2026-06-20")).toBe(6); // Saturday
    expect(dowOf("2026-06-21")).toBe(0); // Sunday
  });

  it("extracts day of month and month index", () => {
    expect(domOf("2026-06-20")).toBe(20);
    expect(monthOf("2026-06-20")).toBe(5); // June = index 5
  });
});

describe("localTimeParts", () => {
  it("resolves the calendar day and minute-of-day in a given tz", () => {
    // 14:30 UTC -> 10:30 in New York (UTC-4 in June)
    const instant = new Date("2026-06-20T14:30:00Z");
    expect(localTimeParts(instant, "America/New_York")).toEqual({
      dateStr: "2026-06-20",
      minutes: 10 * 60 + 30,
    });
    expect(localTimeParts(instant, "UTC")).toEqual({
      dateStr: "2026-06-20",
      minutes: 14 * 60 + 30,
    });
  });

  it("rolls the day backward near midnight for negative offsets", () => {
    // 02:15 UTC is still 22:15 the previous day in New York
    const instant = new Date("2026-06-20T02:15:00Z");
    expect(localTimeParts(instant, "America/New_York")).toEqual({
      dateStr: "2026-06-19",
      minutes: 22 * 60 + 15,
    });
  });

  it("normalizes midnight to 0 minutes", () => {
    const instant = new Date("2026-06-20T00:00:00Z");
    expect(localTimeParts(instant, "UTC")).toEqual({ dateStr: "2026-06-20", minutes: 0 });
  });
});

describe("weekdayLabel", () => {
  it("derives a tz-independent short label from the date string", () => {
    expect(weekdayLabel("2026-06-20")).toBe("Sat");
    expect(weekdayLabel("2026-06-21")).toBe("Sun");
  });
});

describe("minuteLabel", () => {
  it("formats minute-of-day as a 12-hour clock", () => {
    expect(minuteLabel(0)).toBe("12:00 AM");
    expect(minuteLabel(9 * 60 + 5)).toBe("9:05 AM");
    expect(minuteLabel(12 * 60)).toBe("12:00 PM");
    expect(minuteLabel(13 * 60 + 30)).toBe("1:30 PM");
  });
});

describe("userTimezone", () => {
  it("reads stored timezone", () => {
    expect(userTimezone({ user_metadata: { timezone: "Asia/Tokyo" } })).toBe("Asia/Tokyo");
  });

  it("falls back to default when missing", () => {
    expect(userTimezone(null)).toBe(DEFAULT_TZ);
    expect(userTimezone({ user_metadata: {} })).toBe(DEFAULT_TZ);
    expect(userTimezone({ user_metadata: { timezone: "" } })).toBe(DEFAULT_TZ);
  });
});
