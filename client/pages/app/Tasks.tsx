import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TaskItem } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTasks, saveTask } from "@/store/slices/recordsSlice";
import { fetchTaskTemplates, saveTaskTemplate } from "@/store/slices/workspaceSlice";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";

const COLUMNS = ["todo", "doing", "waiting", "done"] as const;
const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

function localInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function Tasks() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const tasks = useAppSelector((state) => state.records.tasks);
  const listLoading = useAppSelector((state) => state.records.loading);
  const staff = useAppSelector((state) => state.records.taskStaff);
  const loans = useAppSelector((state) => state.records.taskLoans);
  const pagination = useAppSelector((state) => state.records.taskPagination);
  const errorKey = useAppSelector((state) => state.records.errorKey);
  const modules = useAppSelector((state) => state.auth.user?.modules);
  const locked = !!modules && !modules.includes("tasks");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueAt, setDueAt] = useState("");
  const [loanId, setLoanId] = useState("");
  const [column, setColumn] = useState<(typeof COLUMNS)[number]>("todo");
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [template, setTemplate] = useState("");
  const [templates, setTemplates] = useState<{ id: number; title: string }[]>([]);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (locked) return;
    void dispatch(fetchTaskTemplates()).then((result) => {
      if (fetchTaskTemplates.fulfilled.match(result)) setTemplates(result.payload);
    });
  }, [dispatch, locked]);

  useEffect(() => {
    if (locked) return;
    const handle = window.setTimeout(() => void dispatch(fetchTasks({ q: search, page })), 200);
    return () => window.clearTimeout(handle);
  }, [dispatch, search, page, locked]);

  async function reload() {
    await dispatch(fetchTasks({ q: search, page }));
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(saveTask({
      title,
      assigneeId: assigneeId ? Number(assigneeId) : null,
      priority,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      loanId: loanId ? Number(loanId) : null,
      column: "todo",
    }));
    if (saveTask.fulfilled.match(result)) {
      setTitle("");
      setDueAt("");
      await reload();
    }
  }

  async function move(task: TaskItem, next: string) {
    await dispatch(saveTask({
      id: task.id,
      title: task.title,
      column: next,
      priority: task.priority,
      assigneeId: task.assigneeId,
      loanId: task.loanId,
      dueAt: task.dueAt,
    }));
    await reload();
  }

  async function onEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const result = await dispatch(saveTask({
      id: editing.id,
      title: editing.title,
      column: editing.column,
      priority: editing.priority,
      assigneeId: editing.assigneeId,
      loanId: editing.loanId,
      dueAt: editing.dueAt,
    }));
    if (saveTask.fulfilled.match(result)) {
      setEditing(null);
      await reload();
    }
  }

  const visible = wide ? COLUMNS : COLUMNS.filter((item) => item === column);

  if (locked) {
    return (
      <div className="mx-auto min-w-0 max-w-2xl">
        <SectionHeader title={t("modules.tasks.name")} />
        <p className="mt-4 text-muted-foreground">{t("app.moduleLocked")}</p>
        <Link className="mt-6 inline-flex text-sm font-medium text-primary" to="/app/modules?code=tasks">{t("market.open")}</Link>
      </div>
    );
  }

  if (listLoading && tasks.length === 0) return <PageSkeleton cards={3} lines={3} label={t("app.loading")} />;

  return (
    <div className="portal-rise min-w-0 space-y-4">
      <div>
        <SectionHeader title={t("modules.tasks.name")} />
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("tasks.lead")}</p>
      </div>
      <form className="flex min-w-0 flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        void dispatch(saveTaskTemplate({ title: template, detail: "", category: "document", priority: "normal" })).then(() => {
          setTemplate("");
          void dispatch(fetchTaskTemplates()).then((result) => { if (fetchTaskTemplates.fulfilled.match(result)) setTemplates(result.payload); });
        });
      }}>
        <Input className="min-w-0 flex-1" aria-label={t("loan.taskTemplate")} placeholder={t("loan.taskTemplate")} value={template} onChange={(event) => setTemplate(event.target.value)} />
        <Button type="submit">{t("loan.addTemplate")}</Button>
      </form>
      <ul className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        {templates.map((item) => <li key={item.id} className="rounded-full border border-border px-3 py-1">{item.title}</li>)}
      </ul>
      {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      <form className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-6" onSubmit={onCreate}>
        <Input required className="xl:col-span-2" aria-label={t("app.taskTitle")} placeholder={t("app.taskTitle")} value={title} onChange={(event) => setTitle(event.target.value)} />
        <select className="h-11 min-w-0 rounded-md border border-input bg-background px-3" aria-label={t("tasks.assignee")} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
          <option value="">{t("tasks.unassigned")}</option>
          {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
        <select className="h-11 min-w-0 rounded-md border border-input bg-background px-3" aria-label={t("tasks.priority")} value={priority} onChange={(event) => setPriority(event.target.value)}>
          {PRIORITIES.map((item) => <option key={item} value={item}>{t(`tasks.priorityName.${item}`)}</option>)}
        </select>
        <Input aria-label={t("tasks.dueAt")} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        <select className="h-11 min-w-0 rounded-md border border-input bg-background px-3" aria-label={t("tasks.loan")} value={loanId} onChange={(event) => setLoanId(event.target.value)}>
          <option value="">{t("tasks.noLoan")}</option>
          {loans.map((loan) => <option key={loan.id} value={loan.id}>{loan.name}</option>)}
        </select>
        <p className="text-xs text-muted-foreground xl:col-span-5">{t(`tasks.hint.${priority}`)}</p>
        <Button className="w-full sm:w-auto" type="submit">{t("app.addTask")}</Button>
      </form>
      {editing ? (
        <form className="grid min-w-0 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-2" onSubmit={onEdit}>
          <Input required aria-label={t("app.taskTitle")} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
          <select className="h-11 min-w-0 rounded-md border border-input bg-background px-3" aria-label={t("tasks.assignee")} value={editing.assigneeId ?? ""} onChange={(event) => setEditing({ ...editing, assigneeId: event.target.value ? Number(event.target.value) : null })}>
            <option value="">{t("tasks.unassigned")}</option>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <select className="h-11 min-w-0 rounded-md border border-input bg-background px-3" aria-label={t("tasks.priority")} value={editing.priority} onChange={(event) => setEditing({ ...editing, priority: event.target.value })}>
            {PRIORITIES.map((item) => <option key={item} value={item}>{t(`tasks.priorityName.${item}`)}</option>)}
          </select>
          <Input aria-label={t("tasks.dueAt")} type="datetime-local" value={localInput(editing.dueAt)} onChange={(event) => setEditing({ ...editing, dueAt: event.target.value ? new Date(event.target.value).toISOString() : null })} />
          <select className="h-11 min-w-0 rounded-md border border-input bg-background px-3" aria-label={t("tasks.loan")} value={editing.loanId ?? ""} onChange={(event) => setEditing({ ...editing, loanId: event.target.value ? Number(event.target.value) : null, loanName: loans.find((loan) => loan.id === Number(event.target.value))?.name || null })}>
            <option value="">{t("tasks.noLoan")}</option>
            {loans.map((loan) => <option key={loan.id} value={loan.id}>{loan.name}</option>)}
          </select>
          <select className="h-11 min-w-0 rounded-md border border-input bg-background px-3" aria-label={t("tasks.move")} value={editing.column} onChange={(event) => setEditing({ ...editing, column: event.target.value })}>
            {COLUMNS.map((item) => <option key={item} value={item}>{t(`tasks.column.${item}`)}</option>)}
          </select>
          <p className="text-xs text-muted-foreground md:col-span-2">{t(`tasks.hint.${editing.priority}`)}</p>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="submit">{t("tasks.save")}</Button>
            <Button type="button" variant="outline" onClick={() => setEditing({ ...editing, dueAt: null })}>{t("tasks.clearDue")}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>{t("tasks.close")}</Button>
          </div>
        </form>
      ) : null}
      <Input aria-label={t("tasks.search")} placeholder={t("tasks.search")} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      {!wide ? (
        <div className="flex flex-wrap gap-2">
          {COLUMNS.map((item) => (
            <Button key={item} type="button" variant={column === item ? "default" : "outline"} onClick={() => setColumn(item)}>{t(`tasks.column.${item}`)}</Button>
          ))}
        </div>
      ) : null}
      <div className={wide ? "grid min-w-0 gap-3" : "min-w-0 space-y-3"} style={wide ? { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" } : undefined}>
        {visible.map((item) => {
          const cards = tasks.filter((task) => task.column === item);
          return (
            <section
              key={item}
              className="min-w-0 rounded-2xl border border-border bg-muted/40 p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = Number(event.dataTransfer.getData("text/plain"));
                const task = tasks.find((entry) => entry.id === id);
                if (task && task.column !== item) void move(task, item);
              }}
            >
              <h2 className="text-sm font-medium">{t(`tasks.column.${item}`)}</h2>
              <div className="mt-3 space-y-2">
                {cards.length === 0 ? <p className="text-xs text-muted-foreground">{t("app.emptyTasks")}</p> : null}
                {cards.map((task) => (
                  <article
                    key={task.id}
                    draggable={wide}
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", String(task.id))}
                    className="min-w-0 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="min-w-0 break-words">{task.title}</strong>
                      <span className="shrink-0 text-xs text-muted-foreground">{t(`tasks.priorityName.${task.priority}`)}</span>
                    </div>
                    <p className="mt-1 break-words text-xs text-muted-foreground">{task.assigneeName || t("tasks.unassigned")}</p>
                    {task.dueAt ? <p className="text-xs text-muted-foreground">{localInput(task.dueAt).replace("T", " ")}</p> : null}
                    {task.loanName ? <p className="break-words text-xs text-muted-foreground">{task.loanName}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(task)}>{t("tasks.edit")}</Button>
                    </div>
                    {!wide ? (
                      <select className="mt-2 h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm" aria-label={t("tasks.move")} value={task.column} onChange={(event) => void move(task, event.target.value)}>
                        {COLUMNS.map((next) => <option key={next} value={next}>{t(`tasks.column.${next}`)}</option>)}
                      </select>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {pagination && pagination.totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t("tasks.prev")}</Button>
          <span className="text-sm text-muted-foreground">{page} / {pagination.totalPages}</span>
          <Button type="button" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>{t("tasks.next")}</Button>
        </div>
      ) : null}
    </div>
  );
}
