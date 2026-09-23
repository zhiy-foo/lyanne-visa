import { describe, expect, it } from "vitest";
import { mapMyAccountRow, resolveDestination, routeFor, type MyAccount } from "./routing";

function account(overrides: Partial<MyAccount> = {}): MyAccount {
  return {
    memberId: "member-1",
    name: "Test",
    role: "parent",
    status: "active",
    email: "test@example.com",
    isAdmin: false,
    codeAttemptsLeft: 5,
    ...overrides,
  };
}

const APP_PATHS = ["/", "/home", "/admin", "/register", "/waiting", "/deactivated"];
const PUBLIC_PATHS = ["/sign-in", "/auth/callback"];

describe("routeFor: signed out", () => {
  it("sends every app path to /sign-in?next=<path>, including deep links", () => {
    for (const path of APP_PATHS) {
      expect(routeFor(null, path)).toBe(`/sign-in?next=${encodeURIComponent(path)}`);
    }
    expect(routeFor(null, "/home?tab=children")).toBe(
      `/sign-in?next=${encodeURIComponent("/home?tab=children")}`,
    );
  });

  it("leaves the public paths alone", () => {
    for (const path of PUBLIC_PATHS) {
      expect(routeFor(null, path)).toBeNull();
    }
  });
});

describe("routeFor: admin", () => {
  const admin = account({ isAdmin: true, role: null, status: null });

  it("routes every non-admin path to /admin, including public paths and deep links", () => {
    for (const path of [...APP_PATHS, ...PUBLIC_PATHS, "/home", "/register"]) {
      if (path === "/admin") continue;
      expect(routeFor(admin, path)).toBe("/admin");
    }
  });

  it("leaves /admin itself alone", () => {
    expect(routeFor(admin, "/admin")).toBeNull();
  });
});

describe("routeFor: active member", () => {
  const active = account({ status: "active" });

  it("routes every other path to /home", () => {
    for (const path of [...APP_PATHS, ...PUBLIC_PATHS, "/admin", "/waiting"]) {
      if (path === "/home") continue;
      expect(routeFor(active, path)).toBe("/home");
    }
  });

  it("leaves /home itself alone", () => {
    expect(routeFor(active, "/home")).toBeNull();
  });
});

describe("routeFor: waiting member", () => {
  const waiting = account({ status: "waiting" });

  it("routes every other path to /waiting", () => {
    for (const path of [...APP_PATHS, ...PUBLIC_PATHS, "/home", "/admin"]) {
      if (path === "/waiting") continue;
      expect(routeFor(waiting, path)).toBe("/waiting");
    }
  });

  it("leaves /waiting itself alone", () => {
    expect(routeFor(waiting, "/waiting")).toBeNull();
  });
});

describe("routeFor: deactivated member", () => {
  const deactivated = account({ status: "deactivated" });

  it("routes every other path to /deactivated", () => {
    for (const path of [...APP_PATHS, ...PUBLIC_PATHS, "/home", "/admin"]) {
      if (path === "/deactivated") continue;
      expect(routeFor(deactivated, path)).toBe("/deactivated");
    }
  });

  it("leaves /deactivated itself alone", () => {
    expect(routeFor(deactivated, "/deactivated")).toBeNull();
  });
});

describe("routeFor: unregistered (signed in, no member row, not admin)", () => {
  const unregistered = account({ memberId: null, role: null, status: null });

  it("routes every other path to /register", () => {
    for (const path of [...APP_PATHS, ...PUBLIC_PATHS, "/home", "/admin"]) {
      if (path === "/register") continue;
      expect(routeFor(unregistered, path)).toBe("/register");
    }
  });

  it("leaves /register itself alone", () => {
    expect(routeFor(unregistered, "/register")).toBeNull();
  });
});

describe("mapMyAccountRow", () => {
  it("maps a my_account() row's snake_case fields to MyAccount", () => {
    expect(
      mapMyAccountRow({
        member_id: "m1",
        name: "Dad",
        role: "parent",
        status: "active",
        email: "dad@example.com",
        is_admin: false,
        code_attempts_left: 3,
      }),
    ).toEqual({
      memberId: "m1",
      name: "Dad",
      role: "parent",
      status: "active",
      email: "dad@example.com",
      isAdmin: false,
      codeAttemptsLeft: 3,
    });
  });
});

describe("resolveDestination", () => {
  const active = account({ status: "active" });

  it("honours `next` when the account is allowed to see it", () => {
    expect(resolveDestination(active, "/home")).toBe("/home");
  });

  it("ignores `next` when the account is not allowed to see it, using the routed target instead", () => {
    const waiting = account({ status: "waiting" });
    expect(resolveDestination(waiting, "/admin")).toBe("/waiting");
  });

  it("falls back to the account's routed target when there is no `next`", () => {
    expect(resolveDestination(active, null)).toBe("/home");
  });

  it("refuses an open redirect (protocol-relative or absolute URL) even when it would otherwise match", () => {
    expect(resolveDestination(active, "//evil.example.com")).toBe("/home");
    expect(resolveDestination(active, "https://evil.example.com")).toBe("/home");
  });
});
