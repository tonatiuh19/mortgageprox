import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import ModuleLock from "@/components/portal/ModuleLock";
import { fetchCalendar, fetchScheduler, saveAppointment, saveScheduler } from "@/store/slices/workspaceSlice";
import { Input } from "@/components/ui/input";

type Visit = { id: number; name: string; email: string; phone: string; startsAt: string; note: string; status: string };
type Mark = { date: string; label: string; kind: "booking" | "task" | "birthday" };

export default function Calendar() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modules = useAppSelector((state) => state.auth.user?.modules);
  const [items, setItems] = useState<Visit[] | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [error, setError] = useState("");
  const [hours, setHours] = useState("1:540-1020,2:540-1020,3:540-1020,4:540-1020,5:540-1020");
  const [slot, setSlot] = useState("30");
  const [buffer, setBuffer] = useState("15");
  const [advance, setAdvance] = useState("21");
  const [notice, setNotice] = useState("2");
  const [timezone, setTimezone] = useState("America/Chicago");

  function load() {
    void dispatch(fetchCalendar()).then((result) => {
      if (!fetchCalendar.fulfilled.match(result)) {
        setError(String(result.payload || "errors.server"));
        return;
      }
      const visits = result.payload.items || [];
      setItems(visits);
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, "0");
      const next: Mark[] = [
        ...visits.filter((item) => item.startsAt.startsWith(`${year}-${month}`)).map((item) => ({ date: item.startsAt.slice(0, 10), label: item.name, kind: "booking" as const })),
        ...(result.payload.tasks || []).map((item) => ({ date: item.dueOn, label: item.title, kind: "task" as const })),
        ...(result.payload.birthdays || []).map((item) => ({ date: item.date, label: item.name, kind: "birthday" as const })),
      ];
      setMarks(next);
    });
  }

  useEffect(() => {
    load();
    void dispatch(fetchScheduler()).then((result) => {
      if (fetchScheduler.fulfilled.match(result)) {
        setHours(result.payload.hours);
        setSlot(String(result.payload.slotMinutes));
        setBuffer(String(result.payload.bufferMinutes));
        setAdvance(String(result.payload.advanceDays));
        setNotice(String(result.payload.minHours));
        setTimezone(result.payload.timezone);
      }
    });
  }, []);

  async function setStatus(id: number, status: string) {
    const result = await dispatch(saveAppointment({ id, status }));
    if (saveAppointment.fulfilled.match(result)) load();
  }

  if (modules && !modules.includes("calendar")) return <ModuleLock title={t("modules.calendar.name")} code="calendar" />;
  if (!items && !error) return <PageSkeleton cards={2} lines={3} label={t("app.loading")} />;

  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const days = new Date(year, month + 1, 0).getDate();

  return (
    <div className="portal-rise mx-auto max-w-3xl">
      <SectionHeader title={t("modules.calendar.name")} meta={t("loan.calendarLead")} />
      <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void dispatch(saveScheduler({ timezone, slotMinutes: Number(slot) || 30, bufferMinutes: Number(buffer) || 0, advanceDays: Number(advance) || 21, minHours: Number(notice) || 0, hours })); }}>
        <Input className="sm:col-span-2" aria-label={t("loan.hours")} value={hours} onChange={(event) => setHours(event.target.value)} />
        <Input aria-label={t("loan.timezone")} value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        <Input aria-label={t("loan.slot")} value={slot} onChange={(event) => setSlot(event.target.value)} />
        <Input aria-label={t("loan.buffer")} value={buffer} onChange={(event) => setBuffer(event.target.value)} />
        <Input aria-label={t("loan.advance")} value={advance} onChange={(event) => setAdvance(event.target.value)} />
        <Input aria-label={t("loan.notice")} value={notice} onChange={(event) => setNotice(event.target.value)} />
        <Button type="submit">{t("app.save")}</Button>
      </form>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const stamp = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayMarks = marks.filter((item) => item.date === stamp);
          const booking = dayMarks.some((item) => item.kind === "booking");
          const task = dayMarks.some((item) => item.kind === "task");
          const birthday = dayMarks.some((item) => item.kind === "birthday");
          return (
            <span key={day} title={dayMarks.map((item) => item.label).join(", ")} className={`rounded-md border border-border py-2 ${booking ? "bg-primary/15" : ""} ${task ? "ring-1 ring-primary" : ""} ${birthday ? "underline" : ""}`}>
              {day}
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("loan.tasksDue")} · {t("loan.birthdays")}</p>
      <ul className="mt-6 space-y-3">
        {(items || []).map((item) => (
          <li key={item.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <strong>{item.name}</strong>
                <p className="text-sm text-muted-foreground">{item.startsAt.replace("T", " ").slice(0, 16)} · {item.email}</p>
                {item.note ? <p className="mt-1 text-sm">{item.note}</p> : null}
              </div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{t(`loan.visit.${item.status}`)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void setStatus(item.id, "confirmed")}>{t("loan.confirm")}</Button>
              <Button type="button" variant="outline" onClick={() => void setStatus(item.id, "done")}>{t("loan.done")}</Button>
            </div>
          </li>
        ))}
      </ul>
      {items && !items.length ? <p className="mt-4 text-sm text-muted-foreground">{t("grid.empty")}</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
    </div>
  );
}
