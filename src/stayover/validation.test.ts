import { describe, expect, it } from "vitest";
import { validateAddress, validateEmail, validateName } from "./validation";

describe("validateName", () => {
  it("accepts and trims a normal name", () => {
    expect(validateName("  Lyanne  ")).toEqual({ ok: true, value: "Lyanne" });
  });

  it("refuses an empty name", () => {
    const result = validateName("");
    expect(result.ok).toBe(false);
  });

  it("refuses a whitespace-only name", () => {
    const result = validateName("   ");
    expect(result.ok).toBe(false);
  });

  it("accepts exactly 80 characters", () => {
    const name = "a".repeat(80);
    expect(validateName(name)).toEqual({ ok: true, value: name });
  });

  it("refuses 81 characters", () => {
    const result = validateName("a".repeat(81));
    expect(result.ok).toBe(false);
  });
});

describe("validateAddress", () => {
  it("treats a missing address as valid (optional field)", () => {
    expect(validateAddress(undefined)).toEqual({ ok: true, value: null });
    expect(validateAddress(null)).toEqual({ ok: true, value: null });
    expect(validateAddress("")).toEqual({ ok: true, value: null });
    expect(validateAddress("   ")).toEqual({ ok: true, value: null });
  });

  it("accepts and trims an address up to 300 characters", () => {
    const address = "1 Example St".padEnd(300, "x");
    expect(validateAddress(`  ${address}  `)).toEqual({ ok: true, value: address });
  });

  it("refuses an address over 300 characters with the spec's message", () => {
    const result = validateAddress("x".repeat(301));
    expect(result).toEqual({ ok: false, message: "Please keep the address under 300 characters." });
  });
});

describe("validateEmail", () => {
  it("accepts and lower-cases a normal email", () => {
    expect(validateEmail("Dad@Example.com")).toEqual({ ok: true, value: "dad@example.com" });
  });

  it("trims surrounding whitespace", () => {
    expect(validateEmail("  dad@example.com  ")).toEqual({ ok: true, value: "dad@example.com" });
  });

  it("refuses an address with no @", () => {
    expect(validateEmail("not-an-email").ok).toBe(false);
  });

  it("refuses an address with no domain", () => {
    expect(validateEmail("dad@").ok).toBe(false);
  });

  it("refuses an empty string", () => {
    expect(validateEmail("").ok).toBe(false);
  });
});
