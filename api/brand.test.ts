import { describe, expect, it } from "vitest";
import { __test } from "./index";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("brand files", () => {
  it("accepts a real png and refuses a file that only claims to be one", () => {
    const file = __test.readImageUpload(PNG, "logo");
    expect("error" in file).toBe(false);
    if (!("error" in file)) expect(file.ext).toBe("png");
    expect(__test.readImageUpload("data:image/png;base64,AAAA", "logo")).toEqual({ error: "errors.brand.file" });
    expect(__test.readImageUpload(PNG, "favicon")).toMatchObject({ ext: "png" });
  });

  it("refuses a logo that is over 1 MB", () => {
    const bytes = Buffer.from(PNG.split(",")[1], "base64");
    const padded = Buffer.concat([bytes, Buffer.alloc(1_000_001)]);
    const huge = `data:image/png;base64,${padded.toString("base64")}`;
    expect(__test.readImageUpload(huge, "logo")).toEqual({ error: "errors.brand.large" });
  });
});
