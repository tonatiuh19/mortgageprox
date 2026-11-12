import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchThread, fetchThreads, sendThread } from "@/store/slices/recordsSlice";
import DevFill from "@/components/dev/DevFill";
import SectionHeader from "@/components/portal/SectionHeader";
import PageSkeleton from "@/components/portal/PageSkeleton";

const CHANNELS = ["note", "email", "sms", "call"] as const;

export default function Conversations({ lockedChannel, embedded }: { lockedChannel?: string; embedded?: boolean }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { threads, messages, activeThread, notice, errorKey, loading } = useAppSelector((state) => state.records);
  const [channel, setChannel] = useState(lockedChannel || "note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contactId, setContactId] = useState("");
  const [clientId, setClientId] = useState("");
  const [loanId, setLoanId] = useState("");
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);

  useEffect(() => {
    const load = () => { void dispatch(fetchThreads({ search, channel: lockedChannel || "", page: 1, sort: "recent", dir: "DESC", scope: mine ? "mine" : "" })); };
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [dispatch, search, lockedChannel, mine]);

  async function openThread(id: number) {
    await dispatch(fetchThread(id));
  }

  async function onSend(event: FormEvent, direction: "in" | "out") {
    event.preventDefault();
    const result = await dispatch(sendThread({
      threadId: activeThread?.id,
      channel,
      subject,
      body,
      direction,
      contactId: contactId ? Number(contactId) : undefined,
      clientId: clientId ? Number(clientId) : undefined,
      loanId: loanId ? Number(loanId) : undefined,
    }));
    if (sendThread.fulfilled.match(result)) {
      setBody("");
      const id = result.payload.id || activeThread?.id;
      void dispatch(fetchThreads({ search, channel: lockedChannel || "", page: 1 }));
      if (id) void dispatch(fetchThread(id));
    }
  }

  if (!embedded && loading && threads.length === 0) return <PageSkeleton cards={2} lines={4} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto grid max-w-6xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside>
        {embedded ? null : <SectionHeader title={t(lockedChannel === "email" ? "modules.email.name" : lockedChannel === "call" ? "modules.phone.name" : "modules.conversations.name")} />}
        <p className={embedded ? "text-sm text-muted-foreground" : "mt-2 text-sm text-muted-foreground"}>{t("app.queued")}</p>
        <Input className="mt-3" aria-label={t("command.search")} placeholder={t("command.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="button" className="mt-2 text-sm text-muted-foreground" onClick={() => setMine((value) => !value)}>{mine ? t("loan.mine") : t("loan.office")}</button>
        <ul className="mt-3 space-y-2">
          {threads.map((thread) => (
            <li key={thread.id}>
              <button type="button" className="w-full rounded-2xl border border-border bg-card p-3 text-left" onClick={() => void openThread(thread.id)}>
                <strong className="block">{thread.contactName || thread.clientName || thread.subject}</strong>
                <span className="text-xs text-muted-foreground">{thread.channel}{thread.unread ? ` · ${thread.unread}` : ""}</span>
                {thread.loanId ? <a className="mt-1 block text-xs underline" href={`/app/loans/${thread.loanId}`}>{t("loan.openFile")}</a> : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="min-w-0 rounded-2xl border border-border bg-card p-4">
        {activeThread ? (
          <header className="mb-4">
            <h2 className="font-display text-2xl">{activeThread.contactName || activeThread.clientName || activeThread.subject}</h2>
            <p className="text-sm text-muted-foreground">{activeThread.email || activeThread.phone}</p>
          </header>
        ) : <p className="mb-4 text-sm text-muted-foreground">{t("app.noThread")}</p>}
        <ol className="space-y-3">
          {messages.map((message) => (
            <li key={message.id} className={message.direction === "out" ? "ml-8 rounded-2xl bg-muted p-3" : "mr-8 rounded-2xl border border-border p-3"}>
              <p className="text-xs text-muted-foreground">{message.channel} · {message.status}</p>
              <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
              {message.transcript ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{message.transcript}</p> : null}
            </li>
          ))}
        </ol>
        <form className="mt-4 grid gap-3" onSubmit={(event) => void onSend(event, "out")}>
          <DevFill className="justify-self-start" onFill={() => {
            setSubject("Documents for your loan");
            setBody("Hi, this is a note from the team. Reply when you have the pay stubs.");
            setChannel(lockedChannel || "note");
          }} />
          {!activeThread ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input aria-label={t("app.subject")} placeholder={t("app.subject")} value={subject} onChange={(event) => setSubject(event.target.value)} />
              <Input aria-label={t("app.contacts")} placeholder={t("app.contacts")} value={contactId} onChange={(event) => setContactId(event.target.value)} />
              <Input aria-label={t("app.client")} placeholder={t("app.client")} value={clientId} onChange={(event) => setClientId(event.target.value)} />
              <Input aria-label={t("app.loanId")} placeholder={t("app.loanId")} value={loanId} onChange={(event) => setLoanId(event.target.value)} />
            </div>
          ) : null}
          <label className="text-sm">
            {t("app.channel")}
            <select className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3" aria-label={t("app.channel")} value={channel} onChange={(event) => setChannel(event.target.value)}>
              {CHANNELS.map((item) => <option key={item} value={item}>{t(`app.channels.${item}`)}</option>)}
            </select>
          </label>
          <Textarea aria-label={t("app.message")} placeholder={t("app.message")} value={body} onChange={(event) => setBody(event.target.value)} required />
          {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
          {notice ? <p className="text-sm text-muted-foreground">{t(notice)}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{t("app.send")}</Button>
            <Button type="button" variant="outline" onClick={(event) => void onSend(event, "in")}>{t("app.logReply")}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
