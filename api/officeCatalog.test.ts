import { describe, expect, it } from "vitest";
import {
  OFFICE_CATALOG,
  OFFICE_ROLE_ALLOW,
  OFFICE_ROLE_HIDDEN,
  sectionVisible,
} from "@shared/api";
import { __test } from "./index";

describe("office menu", () => {
  it("keeps the server catalog identical to the client catalog", () => {
    expect(__test.OFFICE_CATALOG).toEqual(OFFICE_CATALOG);
    expect(__test.OFFICE_ROLE_ALLOW).toEqual(OFFICE_ROLE_ALLOW);
    expect(__test.OFFICE_ROLE_HIDDEN).toEqual(OFFICE_ROLE_HIDDEN);
  });

  it("lets the plan hide a section, and a role override show one the default hides", () => {
    const modules = ["dashboard", "clients", "calculators"];
    expect(sectionVisible({
      role: "partner",
      sectionId: "broadcasts",
      module: "broadcasts",
      modules,
      hidden: false,
      roleVisible: true,
    })).toBe(false);
    expect(__test.sectionVisible({
      role: "loan_officer",
      sectionId: "team",
      module: "team",
      modules: ["team"],
      hidden: false,
      roleVisible: null,
    })).toBe(false);
    expect(sectionVisible({
      role: "loan_officer",
      sectionId: "team",
      module: "team",
      modules: ["team"],
      hidden: false,
      roleVisible: true,
    })).toBe(true);
    expect(sectionVisible({
      role: "brokerage_owner",
      sectionId: "pipeline",
      module: "pipeline",
      modules,
      hidden: true,
      roleVisible: true,
    })).toBe(false);
  });
});
