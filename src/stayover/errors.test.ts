import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapDbError } from "./errors";

const CLOSED_LIST_CODES = [
  "not_signed_in",
  "not_admin",
  "invalid_status_transition",
  "not_found",
  "admin_cannot_register",
  "already_registered",
  "invalid_role",
  "invalid_name",
  "invalid_code",
  "role_change_has_links",
  "not_active",
  "not_parent",
  "not_guardian_of_child",
  "no_parent_account",
  "last_parent",
  "not_host",
  "not_host_of_place",
  "no_host_account",
  "last_host",
  "link_role_mismatch",
  "invalid_time_zone",
  "not_deletable",
];

describe("mapDbError", () => {
  it("maps every closed-list code to a non-empty, code-free message", () => {
    for (const code of CLOSED_LIST_CODES) {
      const message = mapDbError({ message: code });
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toBe(code);
    }
  });

  it("gives every code a distinct message from every other code", () => {
    const messages = CLOSED_LIST_CODES.map((code) => mapDbError({ message: code }));
    expect(new Set(messages).size).toBe(messages.length);
  });

  describe("unknown / missing-data paths", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it("falls back to a generic message for an unrecognised code, and logs it", () => {
      const message = mapDbError({ message: "some_new_refusal_code" });
      expect(message).toBe("Something went wrong. Please try again.");
      expect(errorSpy).toHaveBeenCalled();
    });

    it("falls back to a generic message for a non-error value", () => {
      expect(mapDbError(null)).toBe("Something went wrong. Please try again.");
      expect(mapDbError(undefined)).toBe("Something went wrong. Please try again.");
      expect(mapDbError("a plain string")).toBe("Something went wrong. Please try again.");
      expect(mapDbError({})).toBe("Something went wrong. Please try again.");
    });

    it("falls back to a generic message when `message` isn't a string", () => {
      expect(mapDbError({ message: 42 })).toBe("Something went wrong. Please try again.");
      expect(mapDbError({ message: "" })).toBe("Something went wrong. Please try again.");
    });
  });
});
