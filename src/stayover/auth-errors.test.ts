import { describe, expect, it } from "vitest";
import {
  isRateLimitError,
  mapAuthHashError,
  mapAuthQueryError,
  mapRequestSignInLinkError,
  parseRetryAfterSeconds,
} from "./auth-errors";

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

describe("mapRequestSignInLinkError", () => {
  const WAIT_MESSAGE =
    "Please wait a minute before asking for another link — check your inbox, the last one may already be there.";
  const GENERIC_MESSAGE = "We couldn't send that link. Please try again.";

  it("maps a 429 status to the wait message, regardless of code", () => {
    expect(mapRequestSignInLinkError(429, undefined)).toBe(WAIT_MESSAGE);
    expect(mapRequestSignInLinkError(429, "some_other_code")).toBe(WAIT_MESSAGE);
  });

  it("maps over_email_send_rate_limit to the wait message", () => {
    expect(mapRequestSignInLinkError(undefined, "over_email_send_rate_limit")).toBe(WAIT_MESSAGE);
    expect(mapRequestSignInLinkError(400, "over_email_send_rate_limit")).toBe(WAIT_MESSAGE);
  });

  it("maps over_request_rate_limit to the wait message", () => {
    expect(mapRequestSignInLinkError(undefined, "over_request_rate_limit")).toBe(WAIT_MESSAGE);
  });

  it("maps other errors to the generic message", () => {
    expect(mapRequestSignInLinkError(400, "email_address_invalid")).toBe(GENERIC_MESSAGE);
    expect(mapRequestSignInLinkError(500, undefined)).toBe(GENERIC_MESSAGE);
    expect(mapRequestSignInLinkError(undefined, undefined)).toBe(GENERIC_MESSAGE);
  });
});

describe("isRateLimitError", () => {
  it("is true for a 429 status regardless of code", () => {
    expect(isRateLimitError(429, undefined)).toBe(true);
    expect(isRateLimitError(429, "some_other_code")).toBe(true);
  });

  it("is true for the known rate-limit codes regardless of status", () => {
    expect(isRateLimitError(undefined, "over_email_send_rate_limit")).toBe(true);
    expect(isRateLimitError(400, "over_request_rate_limit")).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isRateLimitError(400, "email_address_invalid")).toBe(false);
    expect(isRateLimitError(500, undefined)).toBe(false);
    expect(isRateLimitError(undefined, undefined)).toBe(false);
  });
});

describe("parseRetryAfterSeconds", () => {
  it("parses the seconds Supabase quotes in its rate-limit message", () => {
    expect(parseRetryAfterSeconds("For security purposes, you can only request this after 47 seconds.")).toBe(
      47,
    );
  });

  it("parses a single-digit or double-digit count the same way", () => {
    expect(parseRetryAfterSeconds("you can only request this after 5 seconds")).toBe(5);
    expect(parseRetryAfterSeconds("you can only request this after 5 second")).toBe(5);
  });

  it("falls back to 60 when the message has no such phrase", () => {
    expect(parseRetryAfterSeconds("Email rate limit exceeded")).toBe(60);
  });

  it("falls back to 60 when the message is undefined", () => {
    expect(parseRetryAfterSeconds(undefined)).toBe(60);
  });

  it("falls back to 60 for a non-rate-limit message with no number", () => {
    expect(parseRetryAfterSeconds("Unable to validate email address: invalid format")).toBe(60);
  });
});
