import { describe, expect, it } from "vitest";
import { mapAuthHashError, mapAuthQueryError } from "./auth-errors";

describe("mapAuthQueryError", () => {
  it("maps otp_expired to link-expired", () => {
    expect(mapAuthQueryError("access_denied", "otp_expired")).toBe("link-expired");
  });

  it("maps a bare access_denied (Google cancelled) to google-cancelled", () => {
    expect(mapAuthQueryError("access_denied", null)).toBe("google-cancelled");
  });

  it("maps any other error to generic", () => {
    expect(mapAuthQueryError("server_error", null)).toBe("generic");
    expect(mapAuthQueryError("invalid_request", "some_other_code")).toBe("generic");
  });

  it("returns null when there is no error", () => {
    expect(mapAuthQueryError(null, null)).toBeNull();
    expect(mapAuthQueryError(null, "otp_expired")).toBeNull();
  });
});

describe("mapAuthHashError", () => {
  it("maps a hash with the leading #", () => {
    expect(mapAuthHashError("#error=access_denied&error_code=otp_expired&error_description=x")).toBe(
      "link-expired",
    );
  });

  it("maps a hash without the leading #", () => {
    expect(mapAuthHashError("error=access_denied&error_code=otp_expired")).toBe("link-expired");
  });

  it("maps a bare access_denied hash to google-cancelled", () => {
    expect(mapAuthHashError("#error=access_denied")).toBe("google-cancelled");
  });

  it("returns null for an empty hash", () => {
    expect(mapAuthHashError("")).toBeNull();
    expect(mapAuthHashError("#")).toBeNull();
  });

  it("returns null for a hash with no error (e.g. a successful implicit-flow token hash)", () => {
    expect(mapAuthHashError("#access_token=abc&token_type=bearer")).toBeNull();
  });
});
