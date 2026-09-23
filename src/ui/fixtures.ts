// Realistic sample data + wired-up callbacks for the dev gallery
// (src/app/dev/gallery). Not imported by any production code path.
import type {
  AdminProps,
  DeactivatedProps,
  HostHomeProps,
  ParentHomeProps,
  RegisterProps,
  SignInProps,
  WaitingProps,
} from "./types";

const DELAY_MS = 400;

function delay(ms = DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ok() {
  await delay();
  return { ok: true as const };
}

function fail(message: string) {
  return async () => {
    await delay();
    return { ok: false as const, message };
  };
}

export const TIME_ZONES = [
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Pacific/Auckland",
];

// ---------------------------------------------------------------------------
// SignIn
// ---------------------------------------------------------------------------

export const signInFixtures: Record<string, SignInProps> = {
  default: {
    onRequestLink: ok,
    onGoogle: () => {},
  },
  error: {
    error: "generic",
    onRequestLink: ok,
    onGoogle: () => {},
  },
  "account-unavailable": {
    error: "account-unavailable",
    onRequestLink: ok,
    onGoogle: () => {},
  },
};

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export const registerFixtures: Record<string, RegisterProps> = {
  default: {
    email: "dad@example.com",
    codeAttemptsLeft: 3,
    onRegister: ok,
    onSignOut: () => {},
  },
  "waiting-list": {
    email: "auntie@example.com",
    codeAttemptsLeft: 0,
    onRegister: ok,
    onSignOut: () => {},
  },
  error: {
    email: "dad@example.com",
    codeAttemptsLeft: 2,
    onRegister: fail("That code isn't right — try again, or leave it blank to ask the admin."),
    onSignOut: () => {},
  },
};

// ---------------------------------------------------------------------------
// Waiting / Deactivated
// ---------------------------------------------------------------------------

export const waitingFixtures: Record<string, WaitingProps> = {
  default: {
    name: "Dad",
    email: "dad@example.com",
    onSignOut: () => {},
  },
};

export const deactivatedFixtures: Record<string, DeactivatedProps> = {
  default: {
    email: "uncle@example.com",
    onSignOut: () => {},
  },
};

// ---------------------------------------------------------------------------
// ParentHome
// ---------------------------------------------------------------------------

const parentHomeHomes = [{ id: "home-1", name: "Grandma & Grandpa's", timeZone: "Asia/Singapore" }];

export const parentHomeFixtures: Record<string, ParentHomeProps> = {
  default: {
    me: { name: "Mum", email: "mum@example.com" },
    children: [
      {
        id: "child-1",
        name: "Lyanne",
        parents: [
          { id: "acc-mum", name: "Mum", email: "mum@example.com" },
          { id: "acc-dad", name: "Dad", email: "dad@example.com" },
        ],
      },
    ],
    homes: parentHomeHomes,
    onAddChild: ok,
    onRenameChild: ok,
    onAddCoParent: ok,
    onRemoveParent: ok,
  },
  empty: {
    me: { name: "Mum", email: "mum@example.com" },
    children: [],
    homes: parentHomeHomes,
    onAddChild: ok,
    onRenameChild: ok,
    onAddCoParent: ok,
    onRemoveParent: ok,
  },
  error: {
    me: { name: "Mum", email: "mum@example.com" },
    children: [
      {
        id: "child-1",
        name: "Lyanne",
        parents: [{ id: "acc-mum", name: "Mum", email: "mum@example.com" }],
      },
    ],
    homes: parentHomeHomes,
    onAddChild: fail("Every child needs at least one parent."),
    onRenameChild: ok,
    onAddCoParent: fail("No parent account with that email — ask them to register as a parent first."),
    onRemoveParent: fail("Every child needs at least one parent."),
  },
};

// ---------------------------------------------------------------------------
// HostHome
// ---------------------------------------------------------------------------

export const hostHomeFixtures: Record<string, HostHomeProps> = {
  default: {
    me: { name: "Grandma", email: "grandma@example.com" },
    homes: [
      {
        id: "home-1",
        name: "Grandma & Grandpa's",
        address: "12 Orchid Road, Singapore",
        timeZone: "Asia/Singapore",
        hosts: [
          { id: "acc-grandma", name: "Grandma", email: "grandma@example.com" },
          { id: "acc-grandpa", name: "Grandpa", email: "grandpa@example.com" },
        ],
      },
    ],
    timeZones: TIME_ZONES,
    onAddHome: ok,
    onUpdateHome: ok,
    onAddCoHost: ok,
    onRemoveHost: ok,
  },
  empty: {
    me: { name: "Grandma", email: "grandma@example.com" },
    homes: [],
    timeZones: TIME_ZONES,
    onAddHome: ok,
    onUpdateHome: ok,
    onAddCoHost: ok,
    onRemoveHost: ok,
  },
  error: {
    me: { name: "Grandma", email: "grandma@example.com" },
    homes: [
      {
        id: "home-1",
        name: "Grandma & Grandpa's",
        timeZone: "Asia/Singapore",
        hosts: [{ id: "acc-grandma", name: "Grandma", email: "grandma@example.com" }],
      },
    ],
    timeZones: TIME_ZONES,
    onAddHome: fail("Please choose a valid time zone."),
    onUpdateHome: fail("Please choose a valid time zone."),
    onAddCoHost: fail("No host account with that email."),
    onRemoveHost: fail("Every home needs at least one host."),
  },
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const adminAccounts: AdminProps["accounts"] = [
  {
    id: "acc-mum",
    name: "Mum",
    email: "mum@example.com",
    role: "parent",
    status: "active",
    registeredAt: "2026-09-01T09:00:00Z",
    childIds: ["child-1"],
    homeIds: [],
  },
  {
    id: "acc-dad",
    name: "Dad",
    email: "dad@example.com",
    role: "parent",
    status: "active",
    registeredAt: "2026-09-01T09:05:00Z",
    childIds: ["child-1"],
    homeIds: [],
  },
  {
    id: "acc-grandma",
    name: "Grandma",
    email: "grandma@example.com",
    role: "host",
    status: "active",
    registeredAt: "2026-09-02T10:00:00Z",
    childIds: [],
    homeIds: ["home-1"],
  },
  {
    id: "acc-grandpa",
    name: "Grandpa",
    email: "grandpa@example.com",
    role: "host",
    status: "active",
    registeredAt: "2026-09-02T10:05:00Z",
    childIds: [],
    homeIds: ["home-1"],
  },
  {
    id: "acc-auntie",
    name: "Auntie May",
    email: "auntie@example.com",
    role: "host",
    status: "waiting",
    registeredAt: "2026-09-20T08:30:00Z",
    childIds: [],
    homeIds: [],
  },
  {
    id: "acc-uncle",
    name: "Uncle Tan",
    email: "uncle@example.com",
    role: "parent",
    status: "deactivated",
    registeredAt: "2026-08-15T08:30:00Z",
    childIds: [],
    homeIds: [],
  },
  {
    id: "acc-auntie-lim",
    name: "Auntie Lim",
    email: "auntie.lim@example.com",
    role: "host",
    status: "active",
    registeredAt: "2026-09-10T08:30:00Z",
    childIds: [],
    homeIds: [],
  },
  {
    id: "acc-uncle-zhi",
    name: "Uncle Zhi",
    email: "zhi@example.com",
    role: "parent",
    status: "active",
    registeredAt: "2026-09-11T08:30:00Z",
    childIds: [],
    homeIds: [],
  },
];

const adminChildren = [{ id: "child-1", name: "Lyanne", parentIds: ["acc-mum", "acc-dad"] }];

const adminHomes: AdminProps["homes"] = [
  {
    id: "home-1",
    name: "Grandma & Grandpa's",
    address: "12 Orchid Road, Singapore",
    timeZone: "Asia/Singapore",
    hostIds: ["acc-grandma", "acc-grandpa"],
  },
];

export const adminFixtures: Record<string, AdminProps> = {
  default: {
    accounts: adminAccounts,
    joinCodeSet: true,
    children: adminChildren,
    homes: adminHomes,
    timeZones: TIME_ZONES,
    onApprove: ok,
    onDecline: ok,
    onSetJoinCode: ok,
    onDeactivate: ok,
    onReactivate: ok,
    onSetRole: ok,
    onRenameChild: ok,
    onUpdateHome: ok,
    onLinkParent: ok,
    onLinkHost: ok,
  },
  empty: {
    accounts: [],
    joinCodeSet: false,
    children: [],
    homes: [],
    timeZones: TIME_ZONES,
    onApprove: ok,
    onDecline: ok,
    onSetJoinCode: ok,
    onDeactivate: ok,
    onReactivate: ok,
    onSetRole: ok,
    onRenameChild: ok,
    onUpdateHome: ok,
    onLinkParent: ok,
    onLinkHost: ok,
  },
  "waiting-list": {
    accounts: adminAccounts,
    joinCodeSet: false,
    children: adminChildren,
    homes: adminHomes,
    timeZones: TIME_ZONES,
    onApprove: ok,
    onDecline: ok,
    onSetJoinCode: ok,
    onDeactivate: ok,
    onReactivate: ok,
    onSetRole: ok,
    onRenameChild: ok,
    onUpdateHome: ok,
    onLinkParent: ok,
    onLinkHost: ok,
  },
  error: {
    accounts: adminAccounts,
    joinCodeSet: true,
    children: adminChildren,
    homes: adminHomes,
    timeZones: TIME_ZONES,
    onApprove: fail("Couldn't approve this account — try again."),
    onDecline: fail("Couldn't decline this account — try again."),
    onSetJoinCode: fail("Codes must be at least 6 characters."),
    onDeactivate: fail("Couldn't deactivate this account — try again."),
    onReactivate: fail("Couldn't reactivate this account — try again."),
    onSetRole: fail("Remove this account's links before changing its role."),
    onRenameChild: fail("Every child needs a name."),
    onUpdateHome: fail("Please choose a valid time zone."),
    onLinkParent: fail("Couldn't update this link — try again."),
    onLinkHost: fail("Couldn't update this link — try again."),
  },
};
