import { describe, expect, it } from "vitest";
import { renderNotice } from "./render-notice";
import type { NoticeFacts, NoticeKind } from "./render-notice";

const KINDS: NoticeKind[] = ["propose", "accept", "reject", "cancel", "withdrawn", "waiting"];

function facts(overrides: Partial<NoticeFacts> = {}): NoticeFacts {
  return {
    kind: "propose",
    to: "grandma@example.com",
    childName: "Lyanne",
    placeName: "Grandma & Grandpa's",
    moverName: "Mum",
    moverSide: "parent",
    note: "She loves the garden",
    dateStart: "2026-10-03",
    dateEnd: "2026-10-07",
    applicationId: "app-1",
    appUrl: "https://lyanne-visa.example",
    ...overrides,
  };
}

describe("renderNotice", () => {
  it.each(KINDS)("produces a subject, text and html for kind=%s", (kind) => {
    const message = renderNotice(facts({ kind }));
    expect(message.to).toBe("grandma@example.com");
    expect(message.subject.length).toBeGreaterThan(0);
    expect(message.text.length).toBeGreaterThan(0);
    expect(message.html).toBeDefined();
  });

  it("every piece of information in the html also appears in the plain text (images-off safe)", () => {
    const message = renderNotice(facts({ kind: "propose" }));
    expect(message.text).toContain("Mum");
    expect(message.text).toContain("Lyanne");
    expect(message.text).toContain("Grandma & Grandpa's");
    expect(message.text).toContain("She loves the garden");
    expect(message.text).toContain("2026-10-03");
    expect(message.text).toContain("https://lyanne-visa.example/applications/app-1");
  });

  it("propose (host side) says 'suggested', not 'asked for'", () => {
    const message = renderNotice(facts({ kind: "propose", moverSide: "host", moverName: "Grandma" }));
    expect(message.text).toMatch(/suggested/i);
  });

  it("waiting notice names the person and role, with no application link", () => {
    const message = renderNotice({
      kind: "waiting",
      to: "admin@example.com",
      personName: "New Parent",
      role: "parent",
    });
    expect(message.text).toContain("New Parent");
    expect(message.text).toContain("parent");
    expect(message.text).not.toContain("Open the application");
  });

  it("omits the note line when there is no note", () => {
    const message = renderNotice(facts({ kind: "cancel", note: undefined }));
    expect(message.text).not.toContain("Their note");
  });

  it("escapes HTML-significant characters in the html body", () => {
    const message = renderNotice(facts({ kind: "propose", note: '<script>alert("x")</script>' }));
    expect(message.html).not.toContain("<script>alert");
    expect(message.html).toContain("&lt;script&gt;");
  });
});
