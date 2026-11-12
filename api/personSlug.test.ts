import { describe, expect, it } from "vitest";
import { __test } from "./index";

describe("person share slug", () => {
  it("builds the link segment from the person's name", () => {
    expect(__test.personSlugBase("Maya", "Chen")).toBe("maya-chen");
    expect(__test.personSlugBase("José", "Niño")).toBe("jose-nino");
  });

  it("falls back when the name has no letters", () => {
    expect(__test.personSlugBase("", "")).toBe("banker");
    expect(__test.personSlugBase("A", "B")).toBe("a-b");
  });
});
