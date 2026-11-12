import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import DevFill from "@/components/dev/DevFill";
import PageSkeleton from "@/components/portal/PageSkeleton";
import ModuleLock from "@/components/portal/ModuleLock";
import SectionHeader from "@/components/portal/SectionHeader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { blockNumber, fetchPhone, fetchThreads, savePhoneLine, savePhoneSettings, sendThread, unblockNumber } from "@/store/slices/recordsSlice";
import { fetchTeam } from "@/store/slices/workspaceSlice";

const OUTCOMES = ["answered", "missed", "forwarded", "voicemail"] as const;

export default function Phone() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const phone = useAppSelector((state) => state.records.phone);
  const threads = useAppSelector((state) => state.records.threads);
  const notice = useAppSelector((state) => state.records.notice);
  const errorKey = useAppSelector((state) => state.records.errorKey);
  const loading = useAppSelector((state) => state.records.loading);
  const team = useAppSelector((state) => state.workspace.team);
  const modules = useAppSelector((state) => state.auth.user?.modules || []);
  const [browser, setBrowser] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const [forwardPhone, setForwardPhone] = useState("");
  const [voicemail, setVoicemail] = useState(true);
  const [greeting, setGreeting] = useState("");
  const [label, setLabel] = useState("");
  const [lineNumber, setLineNumber] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [block, setBlock] = useState("");
  const [blockNote, setBlockNote] = useState("");
  const [blockSearch, setBlockSearch] = useState("");
  const [blockCalls, setBlockCalls] = useState(true);
  const [blockTexts, setBlockTexts] = useState(true);
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("answered");
  const [duration, setDuration] = useState("");
  const [callNote, setCallNote] = useState("");
  const [transcript, setTranscript] = useState("");
  const [params] = useSearchParams();
  const loanId = params.get("loanId") || "";
  const [clientId, setClientId] = useState(params.get("clientId") || "");
  const logForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    void dispatch(fetchPhone());
    void dispatch(fetchThreads({ channel: "call", page: 1, sort: "recent", dir: "DESC" }));
  }, [dispatch]);

  useEffect(() => {
    if (!phone) return;
    setBrowser(phone.settings.browserCalls);
    setForwarding(phone.settings.forwardingEnabled);
    setForwardPhone(phone.settings.forwardingPhone || "");
    setVoicemail(phone.settings.voicemailEnabled);
    setGreeting(phone.settings.greeting || "");
    if (phone.canManage) void dispatch(fetchTeam({ page: 1, sort: "name", dir: "ASC" }));
  }, [dispatch, phone]);

  async function onSettings(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(savePhoneSettings({
      browserCalls: browser,
      forwardingEnabled: forwarding,
      forwardingPhone: forwardPhone,
      voicemailEnabled: voicemail,
      greeting,
    }));
    if (savePhoneSettings.fulfilled.match(result)) void dispatch(fetchPhone());
  }

  async function onLine(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(savePhoneLine({
      label,
      e164: lineNumber,
      assignedUserId: assignedUserId ? Number(assignedUserId) : null,
      ringTimeoutSec: 20,
      isPrimary: !phone?.lines.length,
    }));
    if (savePhoneLine.fulfilled.match(result)) {
      setLabel("");
      setLineNumber("");
      void dispatch(fetchPhone());
    }
  }

  async function onBlock(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(blockNumber({ e164: block, note: blockNote, blockCalls, blockTexts }));
    if (blockNumber.fulfilled.match(result)) {
      setBlock("");
      setBlockNote("");
      void dispatch(fetchPhone());
    }
  }

  async function onLog(event: FormEvent | null, place: boolean) {
    event?.preventDefault();
    if (logForm.current && !logForm.current.reportValidity()) return;
    const result = await dispatch(sendThread({
      channel: "call",
      subject: t("app.logCall"),
      body: callNote,
      outcome,
      durationSec: duration ? Number(duration) : null,
      forwardedTo: outcome === "forwarded" ? forwardPhone : undefined,
      transcript: modules.includes("transcripts") ? transcript : undefined,
      clientId: clientId ? Number(clientId) : undefined,
      loanId: loanId ? Number(loanId) : undefined,
      place,
    }));
    if (sendThread.fulfilled.match(result)) {
      setCallNote("");
      void dispatch(fetchThreads({ channel: "call", page: 1, sort: "recent", dir: "DESC" }));
    }
  }

  if (modules && !modules.includes("phone")) return <ModuleLock title={t("modules.phone.name")} code="phone" />;
  if (!phone && loading) return <PageSkeleton cards={2} lines={4} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto min-w-0 max-w-3xl">
      <SectionHeader title={t("modules.phone.name")} />
      <p className="mt-2 text-sm text-muted-foreground">{phone?.twilio ? t("app.phoneLive") : t("app.phoneHold")}</p>
      {phone ? (
        <ol className="mt-4 flex flex-wrap gap-2">
          {phone.ring.map((step, index) => (
            <li key={step} className="rounded-full bg-muted px-3 py-1 text-xs">{index + 1}. {t(`app.ring.${step}`)}</li>
          ))}
        </ol>
      ) : null}

      <form className="mt-6 grid gap-3" onSubmit={(event) => void onSettings(event)}>
        <DevFill className="justify-self-start" onFill={() => {
          setBrowser(true);
          setForwarding(true);
          setForwardPhone("4155550190");
          setVoicemail(true);
          setGreeting("You have reached Northwind Mortgage. Leave your name and a good time to call.");
          setLabel("Main desk");
          setLineNumber("4155550100");
        }} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={browser} onChange={(event) => setBrowser(event.target.checked)} />
          {t("app.browserCalls")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={forwarding} onChange={(event) => setForwarding(event.target.checked)} />
          {t("app.forwarding")}
        </label>
        <Input aria-label={t("app.forwardingPhone")} placeholder={t("app.forwardingPhone")} value={forwardPhone} onChange={(event) => setForwardPhone(event.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={voicemail} onChange={(event) => setVoicemail(event.target.checked)} />
          {t("app.voicemail")}
        </label>
        <Textarea aria-label={t("app.greeting")} placeholder={t("app.greeting")} value={greeting} onChange={(event) => setGreeting(event.target.value)} />
        <Button type="submit" className="justify-self-start">{t("app.savePhone")}</Button>
      </form>

      {phone?.canManage ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl">{t("app.lines")}</h2>
          <ul className="mt-3 space-y-2">
            {phone.lines.map((line) => (
              <li key={line.id} className="rounded-2xl border border-border p-3 text-sm">
                <strong>{line.label}</strong>
                <span className="mt-1 block text-muted-foreground">{line.e164} · {line.ringTimeoutSec}s{line.isPrimary ? ` · ${t("app.primary")}` : ""}</span>
              </li>
            ))}
          </ul>
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void onLine(event)}>
            <Input aria-label={t("app.lineLabel")} placeholder={t("app.lineLabel")} value={label} onChange={(event) => setLabel(event.target.value)} required />
            <Input aria-label={t("app.lineNumber")} placeholder={t("app.lineNumber")} value={lineNumber} onChange={(event) => setLineNumber(event.target.value)} required />
            <select className="h-11 rounded-md border border-input bg-background px-3 sm:col-span-2" aria-label={t("app.assigned")} value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
              <option value="">{t("app.assigned")}</option>
              {team.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
            </select>
            <Button type="submit" className="justify-self-start">{t("app.addLine")}</Button>
          </form>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">{t("app.blocked")}</h2>
            <Button type="button" variant="outline" onClick={() => void dispatch(fetchPhone())}>{t("pipeline.refresh")}</Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t("app.blockHelp")}</p>
          <Input className="mt-3" aria-label={t("command.search")} placeholder={t("command.search")} value={blockSearch} onChange={(event) => setBlockSearch(event.target.value)} />
          <ul className="mt-3 space-y-2">
            {phone.blocked.filter((item) => `${item.e164} ${item.note || ""}`.toLowerCase().includes(blockSearch.trim().toLowerCase())).map((item) => {
              const days = item.createdAt ? Math.max(0, Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000)) : 0;
              return (
                <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-3 text-sm">
                  <span className="min-w-0">
                    {item.e164}{item.note ? ` · ${item.note}` : ""}
                    <span className="mt-1 flex flex-wrap gap-2">
                      {item.blockCalls !== false ? <span className="rounded-full border border-border px-2 py-0.5 text-xs">{t("phone.calls")}</span> : null}
                      {item.blockTexts !== false ? <span className="rounded-full border border-border px-2 py-0.5 text-xs">{t("phone.texts")}</span> : null}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.createdBy ? t("phone.blockedAgo", { days, name: item.createdBy }) : t("phone.blockedAgoPlain", { days })}</span>
                  </span>
                  <Button type="button" variant="outline" onClick={() => void dispatch(unblockNumber(item.id)).then(() => dispatch(fetchPhone()))}>{t("app.unblock")}</Button>
                </li>
              );
            })}
          </ul>
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void onBlock(event)}>
            <Input aria-label={t("app.blockNumber")} placeholder={t("app.blockNumber")} value={block} onChange={(event) => setBlock(event.target.value)} required />
            <Input aria-label={t("app.blockNote")} placeholder={t("app.blockNote")} value={blockNote} onChange={(event) => setBlockNote(event.target.value)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={blockCalls} onChange={(event) => setBlockCalls(event.target.checked)} />{t("phone.calls")}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={blockTexts} onChange={(event) => setBlockTexts(event.target.checked)} />{t("phone.texts")}</label>
            <Button type="submit" variant="outline" className="justify-self-start">{t("app.blockNumber")}</Button>
          </form>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-2xl">{t("app.logCall")}</h2>
        {loanId ? <p className="mt-1 text-sm text-muted-foreground">{t("loan.onFile", { id: loanId })}</p> : null}
        <form ref={logForm} className="mt-3 grid gap-3" onSubmit={(event) => void onLog(event, false)}>
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="h-11 rounded-md border border-input bg-background px-3" aria-label={t("app.callOutcome")} value={outcome} onChange={(event) => setOutcome(event.target.value as (typeof OUTCOMES)[number])}>
              {OUTCOMES.map((item) => <option key={item} value={item}>{t(`app.outcome.${item}`)}</option>)}
            </select>
            <Input aria-label={t("app.duration")} placeholder={t("app.duration")} value={duration} onChange={(event) => setDuration(event.target.value)} />
            <Input required aria-label={t("app.client")} placeholder={t("app.client")} value={clientId} onChange={(event) => setClientId(event.target.value)} />
          </div>
          <Textarea aria-label={t("app.message")} placeholder={t("app.message")} value={callNote} onChange={(event) => setCallNote(event.target.value)} required />
          {modules.includes("transcripts") ? (
            <Textarea aria-label={t("app.transcript")} placeholder={t("app.transcript")} value={transcript} onChange={(event) => setTranscript(event.target.value)} />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {phone?.twilio ? <Button type="button" onClick={() => void onLog(null, true)}>{t("app.placeCall")}</Button> : null}
            <Button type="submit" variant={phone?.twilio ? "outline" : "default"}>{t("app.logCall")}</Button>
          </div>
        </form>
        <ul className="mt-4 space-y-2">
          {threads.map((thread) => (
            <li key={thread.id} className="rounded-2xl border border-border p-3 text-sm">
              <strong>{thread.contactName || thread.clientName || thread.subject}</strong>
            </li>
          ))}
        </ul>
      </section>
      {errorKey ? <p className="mt-4 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      {notice ? <p className="mt-4 text-sm text-muted-foreground">{t(notice)}</p> : null}
    </div>
  );
}
