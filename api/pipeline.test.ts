import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

describe("loan board", () => {
  it("opens a file again only when it leaves a funded stage", () => {
    expect(__test.loanStageMove("open", false)).toEqual({ status: "open", checkOpenCap: false });
    expect(__test.loanStageMove("open", true)).toEqual({ status: "funded", checkOpenCap: false });
    expect(__test.loanStageMove("funded", true)).toEqual({ status: "funded", checkOpenCap: false });
    expect(__test.loanStageMove("funded", false)).toEqual({ status: "open", checkOpenCap: true });
    expect(__test.loanStageMove("archived", false)).toEqual({ status: "open", checkOpenCap: true });
  });

  it("keeps the board behind a session", async () => {
    const board = await request(createServer()).get("/api/app/loans?board=1");
    expect(board.status).toBe(401);
  });
});
