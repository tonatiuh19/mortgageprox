import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataGrid } from "@/components/ui/data-grid";

describe("DataGrid", () => {
  it("sorts from the header and renders a phone card plus a contained table", async () => {
    const onSort = vi.fn();
    const user = userEvent.setup();
    const rows = [{ id: 1, name: "Northwind" }];
    render(
      <DataGrid
        data={rows}
        columns={[{ key: "name", label: "Name", sortable: true, render: (row) => row.name }]}
        rowKey={(row) => row.id}
        sortBy="created"
        sortDir="DESC"
        onSort={onSort}
        mobileCard={(row) => <span>{row.name}</span>}
        pagination={{ page: 1, limit: 25, total: 40, totalPages: 2 }}
        onPageChange={() => undefined}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onSort).toHaveBeenCalledWith("name");
    expect(document.querySelector(".table-scroll")).toBeTruthy();
    expect(document.querySelector(".sm\\:hidden, .block.space-y-3")).toBeTruthy();
  });
});
