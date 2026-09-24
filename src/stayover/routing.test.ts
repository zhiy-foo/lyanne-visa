import { describe, expect, it } from "vitest";
import {
  classifyMyAccountRpc,
  mapMyAccountRow,
  resolveDestination,
  routeFor,
  routeForAccountUnavailable,
  type MyAccount,
  type MyAccountRow,
} from "./routing";

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

  it("allows every /admin/* sub-page (the admin area is split into accounts/children/homes)", () => {
    for (const path of ["/admin/accounts", "/admin/children", "/admin/homes", "/admin/anything"]) {
      expect(routeFor(admin, path)).toBeNull();
    }
  });

  it("does not treat a path that merely starts with the letters 'admin' as part of the admin area", () => {
    expect(routeFor(admin, "/administrator")).toBe("/admin");
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

describe("routeFor: non-admin requests to an /admin/* sub-page", () => {
  it("sends an active member to /home", () => {
    expect(routeFor(account({ status: "active" }), "/admin/children")).toBe("/home");
  });

  it("sends a host (parent-shaped active account with a host role) to /home", () => {
    expect(routeFor(account({ status: "active", role: "host" }), "/admin/children")).toBe("/home");
  });

  it("sends a waiting member to /waiting", () => {
    expect(routeFor(account({ status: "waiting" }), "/admin/children")).toBe("/waiting");
  });

  it("sends a deactivated member to /deactivated", () => {
    expect(routeFor(account({ status: "deactivated" }), "/admin/children")).toBe("/deactivated");
  });

  it("sends an unregistered account to /register", () => {
    expect(routeFor(account({ memberId: null, role: null, status: null }), "/admin/children")).toBe(
      "/register",
    );
  });

  it("sends a signed-out caller to /sign-in?next=<path>", () => {
    expect(routeFor(null, "/admin/children")).toBe(
      `/sign-in?next=${encodeURIComponent("/admin/children")}`,
    );
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

describe("classifyMyAccountRpc", () => {
  const row: MyAccountRow = {
    member_id: "m1",
    name: "Dad",
    role: "parent",
    status: "active",
    email: "dad@example.com",
    is_admin: false,
    code_attempts_left: 3,
  };

  it("classifies an error as 'error', regardless of any data returned alongside it", () => {
    expect(classifyMyAccountRpc(null, new Error("boom"))).toEqual({ kind: "error" });
    expect(classifyMyAccountRpc([row], new Error("boom"))).toEqual({ kind: "error" });
  });

  it("classifies a row with no error as the mapped account", () => {
    expect(classifyMyAccountRpc([row], null)).toEqual({
      kind: "account",
      account: mapMyAccountRow(row),
    });
  });

  it("classifies no row and no error as 'none' (signed in, not yet registered)", () => {
    expect(classifyMyAccountRpc([], null)).toEqual({ kind: "none" });
    expect(classifyMyAccountRpc(null, null)).toEqual({ kind: "none" });
    expect(classifyMyAccountRpc(undefined, null)).toEqual({ kind: "none" });
  });
});

describe("routeForAccountUnavailable", () => {
  it("sends every path except /sign-in itself to /sign-in?error=account-unavailable", () => {
    for (const path of [...APP_PATHS, "/auth/callback"]) {
      expect(routeForAccountUnavailable(path)).toBe("/sign-in?error=account-unavailable");
    }
  });

  it("leaves /sign-in itself alone, so the error query string isn't redirected away", () => {
    expect(routeForAccountUnavailable("/sign-in")).toBeNull();
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

  it("honours an admin sub-page `next`", () => {
    const admin = account({ isAdmin: true, role: null, status: null });
    expect(resolveDestination(admin, "/admin/children")).toBe("/admin/children");
  });

  it("refuses an open redirect (protocol-relative or absolute URL) even when it would otherwise match", () => {
    expect(resolveDestination(active, "//evil.example.com")).toBe("/home");
    expect(resolveDestination(active, "https://evil.example.com")).toBe("/home");
  });

  it("is unaffected by backslash candidates a browser would normalise to //evil.com, since routeFor only ever matches an exact allowed path", () => {
    expect(resolveDestination(active, "/\\evil.com")).toBe("/home");
    expect(resolveDestination(active, "/\t/evil.com")).toBe("/home");
  });
});
