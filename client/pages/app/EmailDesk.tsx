import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DevFill from "@/components/dev/DevFill";
import PageSkeleton from "@/components/portal/PageSkeleton";
import ModuleLock from "@/components/portal/ModuleLock";
import SectionHeader from "@/components/portal/SectionHeader";
import Conversations from "@/pages/app/Conversations";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { connectMailbox, fetchMailboxes } from "@/store/slices/recordsSlice";

export default function EmailDesk() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const mailboxes = useAppSelector((state) => state.records.mailboxes);
  const microsoft = useAppSelector((state) => state.records.microsoftReady);
  const errorKey = useAppSelector((state) => state.records.errorKey);
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const modules = useAppSelector((state) => state.auth.user?.modules);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void dispatch(fetchMailboxes()).finally(() => setReady(true));
  }, [dispatch]);

  async function onConnect(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(connectMailbox({ email, displayName }));
    if (connectMailbox.fulfilled.match(result)) {
      if (result.payload.authUrl) window.location.assign(result.payload.authUrl);
      else {
        setEmail("");
        setDisplayName("");
        void dispatch(fetchMailboxes());
      }
    }
  }

  const flag = params.get("microsoft");

  if (modules && !modules.includes("email")) return <ModuleLock title={t("modules.email.name")} code="email" />;
  if (!ready) return <PageSkeleton cards={2} lines={3} label={t("app.loading")} />;

  return (
    <div className="portal-rise min-w-0">
      <section className="mx-auto mb-8 max-w-3xl">
        <SectionHeader title={t("modules.email.name")} />
        <p className="mt-2 text-sm text-muted-foreground">{t("app.mailboxHelp")}</p>
        {flag === "connected" ? <p className="mt-3 text-sm text-muted-foreground">{t("app.mailboxConnected")}</p> : null}
        {flag === "error" ? <p className="mt-3 text-sm text-destructive">{t("errors.microsoftAccount")}</p> : null}
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void onConnect(event)}>
          <DevFill className="justify-self-start sm:col-span-2" onFill={() => {
            setDisplayName("Northwind Mortgage");
            setEmail("hello@northwind.example");
          }} />
          <Input required type="email" aria-label={t("app.mailbox")} placeholder={t("app.mailbox")} value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input aria-label={t("app.displayName")} placeholder={t("app.displayName")} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <Button type="submit" className="justify-self-start">{t("app.connectMicrosoft")}</Button>
        </form>
        {!microsoft ? <p className="mt-3 text-sm text-muted-foreground">{t("app.mailboxPending")}</p> : null}
        <ul className="mt-4 space-y-2">
          {mailboxes.map((box) => (
            <li key={box.id} className="min-w-0 rounded-2xl border border-border p-3 text-sm">
              <strong className="block truncate">{box.displayName || box.email}</strong>
              <span className="text-muted-foreground">{box.email} · {t(`app.mailboxStatus.${box.status}`, { defaultValue: box.status })}</span>
              {box.lastError ? <span className="mt-1 block text-destructive">{t(box.lastError.startsWith("errors.") ? box.lastError : "errors.server")}</span> : null}
            </li>
          ))}
        </ul>
        {errorKey ? <p className="mt-3 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      </section>
      <Conversations lockedChannel="email" embedded />
    </div>
  );
}
