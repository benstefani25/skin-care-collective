// T1-6 — Phone normalization is the identity key: a member who signs up with
// "(312) 555-0143" MUST match when Twilio delivers "+13125550143". These cases
// pin signup formats and Twilio's From format to the same E.164 output.
import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("maps every common US signup format to the same E.164", () => {
    const e164 = "+13125550143";
    for (const input of [
      "(312) 555-0143",
      "312-555-0143",
      "312.555.0143",
      "3125550143",
      "1 312 555 0143",
      "13125550143",
      "+1 (312) 555-0143",
      "+13125550143", // Twilio's From format
    ]) {
      expect(normalizePhone(input)).toBe(e164);
    }
  });

  it("a signup format and Twilio's From produce identical keys (the wall against silent mismatch)", () => {
    expect(normalizePhone("(312) 555-0143")).toBe(normalizePhone("+13125550143"));
  });

  it("keeps a valid international number", () => {
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
  });

  it("rejects junk", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
  });
});
