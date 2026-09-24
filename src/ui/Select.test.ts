import { describe, expect, it } from "vitest";
import { buildDescribedBy } from "./Select";

describe("buildDescribedBy", () => {
  it("returns undefined when nothing describes the field", () => {
    expect(buildDescribedBy([])).toBeUndefined();
    expect(buildDescribedBy([undefined, undefined])).toBeUndefined();
  });

  it("returns a single id unchanged", () => {
    expect(buildDescribedBy(["helper-id"])).toBe("helper-id");
  });

  it("space-joins multiple ids, skipping undefined entries", () => {
    expect(buildDescribedBy(["helper-id", undefined, "tip-id"])).toBe("helper-id tip-id");
  });

  it("joins all ids when every slot is filled", () => {
    expect(buildDescribedBy(["helper-id", "error-id", "tip-id"])).toBe("helper-id error-id tip-id");
  });
});
