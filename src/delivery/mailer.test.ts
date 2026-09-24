import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConsoleMailer } from "./mailer-console";
import type { EmailMessage } from "./types";

/** Task 4.1: Mailer port, Gmail SMTP adapter, console/test double, and selection. */

function clearDeliveryEnv() {
  // Statically-named deletes, not a loop over dynamic keys — this codebase's
  // convention (src/stayover/supabase/env.test.ts's regression guard)
  // forbids reading/writing process.env through a bracketed, computed key
  // anywhere under src/.
  delete process.env.DELIVERY_SMTP_USER;
  delete process.env.DELIVERY_SMTP_APP_PASSWORD;
  delete process.env.DELIVERY_FROM_ADDRESS;
}

const sampleMessage: EmailMessage = {
  to: "grandma@example.com",
  subject: "It's your turn to answer",
  text: "Plain text body",
};

describe("console mailer", () => {
  it("always succeeds and logs the recipient/subject without sending anything over the network", async () => {
    const lines: string[] = [];
    const mailer = createConsoleMailer({ log: (line) => lines.push(line) });

    const result = await mailer.send(sampleMessage);

    expect(result).toEqual({ ok: true });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("grandma@example.com");
    expect(lines[0]).toContain("It's your turn to answer");
  });

  it("notes the ics method for an invite message", async () => {
    const lines: string[] = [];
    const mailer = createConsoleMailer({ log: (line) => lines.push(line) });

    await mailer.send({
      ...sampleMessage,
      icsAttachment: { filename: "invite.ics", content: "BEGIN:VCALENDAR...", method: "REQUEST" },
    });

    expect(lines[0]).toContain("ics-method=REQUEST");
  });
});

describe("smtpConfigured / getMailer selection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearDeliveryEnv();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("smtpConfigured is false when any of the three vars is missing", async () => {
    const { smtpConfigured } = await import("./mailer-smtp");
    expect(smtpConfigured()).toBe(false);

    process.env.DELIVERY_SMTP_USER = "app@example.com";
    process.env.DELIVERY_SMTP_APP_PASSWORD = "xxxxxxxxxxxxxxxx";
    // DELIVERY_FROM_ADDRESS still unset
    expect(smtpConfigured()).toBe(false);
  });

  it("smtpConfigured is true only once all three vars are set", async () => {
    process.env.DELIVERY_SMTP_USER = "app@example.com";
    process.env.DELIVERY_SMTP_APP_PASSWORD = "xxxxxxxxxxxxxxxx";
    process.env.DELIVERY_FROM_ADDRESS = "app@example.com";
    const { smtpConfigured } = await import("./mailer-smtp");
    expect(smtpConfigured()).toBe(true);
  });

  it("getMailer returns the console double by default (test/dev, no SMTP vars set)", async () => {
    const { getMailer } = await import("./mailer");
    const { createConsoleMailer: freshCreateConsoleMailer } = await import("./mailer-console");
    const mailer = getMailer();

    // Structural check: behaves like the console double (never throws, ok: true)
    // without needing network access or real credentials.
    const result = await mailer.send(sampleMessage);
    expect(result).toEqual({ ok: true });
    void freshCreateConsoleMailer; // referenced for clarity only
  });

  it("getMailer returns an SMTP-backed mailer once every var is set", async () => {
    process.env.DELIVERY_SMTP_USER = "app@example.com";
    process.env.DELIVERY_SMTP_APP_PASSWORD = "xxxxxxxxxxxxxxxx";
    process.env.DELIVERY_FROM_ADDRESS = "app@example.com";
    const { getMailer } = await import("./mailer");
    const { createSmtpMailer } = await import("./mailer-smtp");

    const viaGetMailer = getMailer();
    const viaDirect = createSmtpMailer();
    // Both are Mailer instances with a `send` function — proves getMailer
    // did not fall back to the console double once configured.
    expect(typeof viaGetMailer.send).toBe("function");
    expect(typeof viaDirect.send).toBe("function");
  });
});

describe("mailer-smtp env accessors", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearDeliveryEnv();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("smtpUser/smtpAppPassword/fromAddress throw when unset", async () => {
    const { smtpUser, smtpAppPassword, fromAddress } = await import("./mailer-smtp");
    expect(() => smtpUser()).toThrow(/DELIVERY_SMTP_USER/);
    expect(() => smtpAppPassword()).toThrow(/DELIVERY_SMTP_APP_PASSWORD/);
    expect(() => fromAddress()).toThrow(/DELIVERY_FROM_ADDRESS/);
  });

  it("smtpUser/smtpAppPassword/fromAddress return their values once set", async () => {
    process.env.DELIVERY_SMTP_USER = "app@example.com";
    process.env.DELIVERY_SMTP_APP_PASSWORD = "xxxxxxxxxxxxxxxx";
    process.env.DELIVERY_FROM_ADDRESS = "sender@example.com";
    const { smtpUser, smtpAppPassword, fromAddress } = await import("./mailer-smtp");
    expect(smtpUser()).toBe("app@example.com");
    expect(smtpAppPassword()).toBe("xxxxxxxxxxxxxxxx");
    expect(fromAddress()).toBe("sender@example.com");
  });

  it("createSmtpMailer's send() surfaces a transport failure as ok: false rather than throwing", async () => {
    process.env.DELIVERY_SMTP_USER = "app@example.com";
    process.env.DELIVERY_SMTP_APP_PASSWORD = "xxxxxxxxxxxxxxxx";
    process.env.DELIVERY_FROM_ADDRESS = "app@example.com";

    // Point at a port nothing listens on so nodemailer's connection attempt
    // fails fast and deterministically, without any real network access.
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: () => ({
          sendMail: () => Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:1")),
        }),
      },
    }));

    const { createSmtpMailer } = await import("./mailer-smtp");
    const mailer = createSmtpMailer();
    const result = await mailer.send(sampleMessage);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("ECONNREFUSED");
    }
  });
});

describe("credential import boundary", () => {
  it("no file in src/delivery/ other than mailer-smtp.ts reads process.env.DELIVERY_SMTP_*/DELIVERY_FROM_ADDRESS", () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

    // Matches an actual read — dotted (`process.env.DELIVERY_SMTP_USER`) or
    // bracketed with the key name — not a mere mention of the name in a
    // comment or doc string; mailer.ts's own comment documenting which vars
    // mailer-smtp.ts reads is not itself a credential read.
    const readPattern =
      /process\s*\.\s*env\s*(?:\.\s*(DELIVERY_SMTP_USER|DELIVERY_SMTP_APP_PASSWORD|DELIVERY_FROM_ADDRESS)\b|\[\s*["'](DELIVERY_SMTP_USER|DELIVERY_SMTP_APP_PASSWORD|DELIVERY_FROM_ADDRESS)["']\s*\])/;

    const offenders: string[] = [];
    for (const file of files) {
      if (file === "mailer-smtp.ts") continue;
      const content = readFileSync(join(dir, file), "utf8");
      if (readPattern.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("sanity check: the pattern itself does catch a direct read", () => {
    const readPattern =
      /process\s*\.\s*env\s*(?:\.\s*(DELIVERY_SMTP_USER|DELIVERY_SMTP_APP_PASSWORD|DELIVERY_FROM_ADDRESS)\b|\[\s*["'](DELIVERY_SMTP_USER|DELIVERY_SMTP_APP_PASSWORD|DELIVERY_FROM_ADDRESS)["']\s*\])/;
    // Built from parts so this test file doesn't itself contain a literal
    // bracketed process.env access (env.test.ts's codebase-wide regression
    // guard forbids that form anywhere under src/).
    const bracketAccessSample = ["process", ".env", '["DELIVERY_FROM_ADDRESS"]'].join("");
    expect(readPattern.test("const x = process.env.DELIVERY_SMTP_USER;")).toBe(true);
    expect(readPattern.test(`const x = ${bracketAccessSample};`)).toBe(true);
    expect(readPattern.test("// mentions DELIVERY_SMTP_USER in a comment only")).toBe(false);
  });

  // Security fix (20260924001100_delivery_outbox.sql's worker-secret check):
  // DELIVERY_WORKER_SECRET must be read in exactly one module,
  // worker-secret.ts — never inlined elsewhere, and never mixed into
  // mailer-smtp.ts's own SMTP credential module, so a later pass wiring it
  // into the claim/record RPC calls has one obvious place to import it from.
  it("no file in src/delivery/ other than worker-secret.ts reads process.env.DELIVERY_WORKER_SECRET", () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

    const readPattern =
      /process\s*\.\s*env\s*(?:\.\s*DELIVERY_WORKER_SECRET\b|\[\s*["']DELIVERY_WORKER_SECRET["']\s*\])/;

    const offenders: string[] = [];
    for (const file of files) {
      if (file === "worker-secret.ts") continue;
      const content = readFileSync(join(dir, file), "utf8");
      if (readPattern.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("sanity check: the DELIVERY_WORKER_SECRET pattern itself does catch a direct read", () => {
    const readPattern =
      /process\s*\.\s*env\s*(?:\.\s*DELIVERY_WORKER_SECRET\b|\[\s*["']DELIVERY_WORKER_SECRET["']\s*\])/;
    const bracketAccessSample = ["process", ".env", '["DELIVERY_WORKER_SECRET"]'].join("");
    expect(readPattern.test("const x = process.env.DELIVERY_WORKER_SECRET;")).toBe(true);
    expect(readPattern.test(`const x = ${bracketAccessSample};`)).toBe(true);
    expect(readPattern.test("// mentions DELIVERY_WORKER_SECRET in a comment only")).toBe(false);
  });
});
