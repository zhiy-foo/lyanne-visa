// Realistic sample data + wired-up callbacks for the dev gallery
// (src/app/dev/gallery). Not imported by any production code path.
import type {
  AdminAccount,
  AdminAccountsProps,
  AdminChild,
  AdminChildrenProps,
  AdminHome,
  AdminHomesProps,
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
  cooldown: {
    onRequestLink: async () => {
      await delay();
      return {
        ok: false as const,
        message:
          "Please wait a minute before asking for another link — check your inbox, the last one may already be there.",
        retryAfterSeconds: 45,
      };
    },
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
// Admin — AdminAccounts, AdminChildren, AdminHomes (one screen per
// /admin/accounts, /admin/children, /admin/homes route)
// ---------------------------------------------------------------------------

const adminAccounts: AdminAccount[] = [
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
    childIds: ["child-1"],
    homeIds: [],
    // Deactivated but still linked to a child, so not deletable.
    deletable: false,
  },
  {
    id: "acc-never-linked",
    name: "Cousin Wei",
    email: "wei@example.com",
    role: "host",
    status: "deactivated",
    registeredAt: "2026-08-20T08:30:00Z",
    childIds: [],
    homeIds: [],
    // Deactivated, never linked to anything — the admin may delete it.
    deletable: true,
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

const adminChildren: AdminChild[] = [{ id: "child-1", name: "Lyanne", parentIds: ["acc-mum", "acc-dad"] }];

// Several children, so the gallery shows the "collapsed by default" case
// (only child-1 is the sole child and would default open on its own).
const adminManyChildren: AdminChild[] = [
  ...adminChildren,
  { id: "child-2", name: "Miles", parentIds: ["acc-mum"] },
  { id: "child-3", name: "Nora", parentIds: ["acc-uncle-zhi"] },
];

const adminHomes: AdminHome[] = [
  {
    id: "home-1",
    name: "Grandma & Grandpa's",
    address: "12 Orchid Road, Singapore",
    timeZone: "Asia/Singapore",
    hostIds: ["acc-grandma", "acc-grandpa"],
  },
];

// Several homes, so the gallery shows the "collapsed by default" case.
const adminManyHomes: AdminHome[] = [
  ...adminHomes,
  {
    id: "home-2",
    name: "Auntie Lim's",
    address: "8 Toa Payoh Lorong, Singapore",
    timeZone: "Asia/Singapore",
    hostIds: ["acc-auntie-lim"],
  },
];

export const adminAccountsFixtures: Record<string, AdminAccountsProps> = {
  default: {
    accounts: adminAccounts,
    joinCodeSet: true,
    onApprove: ok,
    onDecline: ok,
    onSetJoinCode: ok,
    onDeactivate: ok,
    onReactivate: ok,
    onSetRole: ok,
    onDelete: ok,
  },
  empty: {
    accounts: [],
    joinCodeSet: false,
    onApprove: ok,
    onDecline: ok,
    onSetJoinCode: ok,
    onDeactivate: ok,
    onReactivate: ok,
    onSetRole: ok,
    onDelete: ok,
  },
  "waiting-list": {
    accounts: adminAccounts,
    joinCodeSet: false,
    onApprove: ok,
    onDecline: ok,
    onSetJoinCode: ok,
    onDeactivate: ok,
    onReactivate: ok,
    onSetRole: ok,
    onDelete: ok,
  },
  error: {
    accounts: adminAccounts,
    joinCodeSet: true,
    onApprove: fail("Couldn't approve this account — try again."),
    onDecline: fail("Couldn't decline this account — try again."),
    onSetJoinCode: fail("Codes must be at least 6 characters."),
    onDeactivate: fail("Couldn't deactivate this account — try again."),
    onReactivate: fail("Couldn't reactivate this account — try again."),
    onSetRole: fail("Remove this account's links before changing its role."),
    onDelete: fail("Only deactivated accounts with no history can be deleted."),
  },
};

export const adminChildrenFixtures: Record<string, AdminChildrenProps> = {
  default: {
    children: adminChildren,
    accounts: adminAccounts,
    onRenameChild: ok,
    onLinkParent: ok,
  },
  "many-children": {
    children: adminManyChildren,
    accounts: adminAccounts,
    onRenameChild: ok,
    onLinkParent: ok,
  },
  empty: {
    children: [],
    accounts: adminAccounts,
    onRenameChild: ok,
    onLinkParent: ok,
  },
  error: {
    children: adminChildren,
    accounts: adminAccounts,
    onRenameChild: fail("Every child needs a name."),
    onLinkParent: fail("Couldn't update this link — try again."),
  },
};

export const adminHomesFixtures: Record<string, AdminHomesProps> = {
  default: {
    homes: adminHomes,
    accounts: adminAccounts,
    timeZones: TIME_ZONES,
    onUpdateHome: ok,
    onLinkHost: ok,
  },
  "many-homes": {
    homes: adminManyHomes,
    accounts: adminAccounts,
    timeZones: TIME_ZONES,
    onUpdateHome: ok,
    onLinkHost: ok,
  },
  empty: {
    homes: [],
    accounts: adminAccounts,
    timeZones: TIME_ZONES,
    onUpdateHome: ok,
    onLinkHost: ok,
  },
  error: {
    homes: adminHomes,
    accounts: adminAccounts,
    timeZones: TIME_ZONES,
    onUpdateHome: fail("Please choose a valid time zone."),
    onLinkHost: fail("Couldn't update this link — try again."),
  },
};
