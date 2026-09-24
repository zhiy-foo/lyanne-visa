import { describe, expect, it } from "vitest";
import {
  decideGoogleSignInMode,
  generateRawNonce,
  mapPromptDismissal,
  safeNextPath,
  sha256Hex,
} from "./google-sign-in-support";

describe("generateRawNonce", () => {
  it("returns a 64-character hex string (32 random bytes)", () => {
    const nonce = generateRawNonce();
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a different value on each call", () => {
    expect(generateRawNonce()).not.toBe(generateRawNonce());
  });
});

describe("sha256Hex", () => {
  it("matches the known SHA-256 hex digest for a fixed input", async () => {
    // Standard NIST test vector for SHA-256("abc").
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches the known SHA-256 hex digest for the empty string", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("decideGoogleSignInMode", () => {
  it("falls back when the client id is unset, regardless of script status", () => {
    expect(decideGoogleSignInMode(undefined, "pending")).toBe("fallback");
    expect(decideGoogleSignInMode(undefined, "loaded")).toBe("fallback");
    expect(decideGoogleSignInMode("", "loaded")).toBe("fallback");
  });

  it("falls back when the script fails to load", () => {
    expect(decideGoogleSignInMode("client-id", "error")).toBe("fallback");
  });

  it("falls back when the load times out", () => {
    expect(decideGoogleSignInMode("client-id", "timeout")).toBe("fallback");
  });

  it("uses GIS once the script has loaded", () => {
    expect(decideGoogleSignInMode("client-id", "loaded")).toBe("gis");
  });

  it("is still pending while waiting to hear back", () => {
    expect(decideGoogleSignInMode("client-id", "pending")).toBe("pending");
  });
});

describe("safeNextPath", () => {
  const origin = "http://localhost:3000";

  it("passes through a safe in-app path", () => {
    expect(safeNextPath("/home", origin)).toBe("/home");
    expect(safeNextPath("/admin/children?x=1#y", origin)).toBe("/admin/children?x=1#y");
  });

  it("falls back to / for a missing next", () => {
    expect(safeNextPath(undefined, origin)).toBe("/");
    expect(safeNextPath(null, origin)).toBe("/");
    expect(safeNextPath("", origin)).toBe("/");
  });

  it("falls back to / for a protocol-relative path (open-redirect attempt)", () => {
    expect(safeNextPath("//evil.com", origin)).toBe("/");
  });

  it("falls back to / for backslash variants the browser normalises to //evil.com", () => {
    expect(safeNextPath("/\\evil.com", origin)).toBe("/");
    expect(safeNextPath("/\\\\evil.com", origin)).toBe("/");
    expect(safeNextPath("/\t/evil.com", origin)).toBe("/");
    expect(safeNextPath("/\n/evil.com", origin)).toBe("/");
  });

  it("falls back to / for an absolute URL to another origin", () => {
    expect(safeNextPath("https://evil.com", origin)).toBe("/");
  });

  it("falls back to / for a javascript: URL", () => {
    expect(safeNextPath("javascript:alert(1)", origin)).toBe("/");
  });

  it("falls back to / for a path not starting with /", () => {
    expect(safeNextPath("home", origin)).toBe("/");
  });
});

describe("mapPromptDismissal", () => {
  it("reports google-cancelled for an explicit cancel_called dismissal", () => {
    expect(mapPromptDismissal(true, "cancel_called")).toBe("google-cancelled");
  });

  it("reports nothing for other dismissed reasons", () => {
    expect(mapPromptDismissal(true, "credential_returned")).toBeNull();
    expect(mapPromptDismissal(true, "flow_restarted")).toBeNull();
    expect(mapPromptDismissal(true, undefined)).toBeNull();
  });

  it("reports nothing when not dismissed at all", () => {
    expect(mapPromptDismissal(false, "cancel_called")).toBeNull();
  });
});
