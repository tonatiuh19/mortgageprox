import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer, __test } from "./index";

describe("task reminders", () => {
  it("schedules by priority in Central time and skips low", () => {
    const due = new Date("2026-11-06T21:00:00Z");
    const urgent = __test.taskReminderSlots("urgent", due);
    expect(urgent.map((slot) => slot.fireAt.toISOString())).toEqual(["2026-11-06T20:00:00.000Z", "2026-11-06T21:00:00.000Z"]);
    const high = __test.taskReminderSlots("high", due);
    expect(high).toHaveLength(1);
    expect(high[0].fireAt.toISOString()).toBe("2026-11-06T15:00:00.000Z");
    const normal = __test.taskReminderSlots("normal", due);
    expect(normal[0].fireAt.toISOString()).toBe("2026-11-05T15:00:00.000Z");
    expect(__test.taskReminderSlots("low", due)).toEqual([]);
    expect(__test.taskReminderSlots("high", new Date("2026-07-15T20:00:00Z"))[0].fireAt.toISOString()).toBe("2026-07-15T14:00:00.000Z");
    expect(__test.taskReminderSlots("normal", new Date("2026-11-01T20:00:00Z"))[0].fireAt.toISOString()).toBe("2026-10-31T14:00:00.000Z");
    expect(__test.taskReminderSlots("normal", new Date("2026-03-01T18:00:00Z"))[0].fireAt.toISOString()).toBe("2026-02-28T15:00:00.000Z");
    expect(__test.taskReminderSlots("urgent", new Date("not-a-date"))).toEqual([]);
  });

  it("keeps another officer's unassigned loan off a loan officer's board and pages each column", () => {
    const viewer = 4;
    expect(__test.taskVisibleTo("own", viewer, { assigneeId: 4, loanId: 9, loanAssigneeId: 8 })).toBe(true);
    expect(__test.taskVisibleTo("own", viewer, { assigneeId: null, loanId: null, loanAssigneeId: null })).toBe(true);
    expect(__test.taskVisibleTo("own", viewer, { assigneeId: null, loanId: 3, loanAssigneeId: 4 })).toBe(true);
    expect(__test.taskVisibleTo("own", viewer, { assigneeId: null, loanId: 3, loanAssigneeId: null })).toBe(true);
    expect(__test.taskVisibleTo("own", viewer, { assigneeId: null, loanId: 3, loanAssigneeId: 8 })).toBe(false);
    expect(__test.taskVisibleTo("own", viewer, { assigneeId: 8, loanId: 3, loanAssigneeId: 4 })).toBe(false);
    expect(__test.taskVisibleTo("all", viewer, { assigneeId: null, loanId: 3, loanAssigneeId: 8 })).toBe(true);
    const page = __test.boardPagination([90, 2, 0, 1], 1, 20);
    expect(page.total).toBe(93);
    expect(page.totalPages).toBe(5);
  });

  it("keeps the daily check behind the cron secret", async () => {
    const daily = await request(createServer()).get("/api/cron/daily");
    expect(daily.status).toBe(401);
    const board = await request(createServer()).get("/api/app/tasks");
    expect(board.status).toBe(401);
  });
});
