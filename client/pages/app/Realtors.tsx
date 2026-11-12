import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import ModuleLock from "@/components/portal/ModuleLock";
import { createRealtor, fetchRealtors, saveRealtorStatus } from "@/store/slices/workspaceSlice";

type Realtor = { id: number; firstName: string; lastName: string; email: string; phone: string; brokerage: string; status: string };

export default function Realtors() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modules = useAppSelector((state) => state.auth.user?.modules);
  const [items, setItems] = useState<Realtor[] | null>(null);
  const [search, setSearch] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [error, setError] = useState("");

  function load(next = search) {
    void dispatch(fetchRealtors(next)).then((result) => {
      if (fetchRealtors.fulfilled.match(result)) setItems(result.payload);
      else setError(String(result.payload || "errors.server"));
    });
  }

  useEffect(() => { load(); }, [search]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(createRealtor({ firstName, lastName, email, phone, brokerage }));
    if (createRealtor.fulfilled.match(result)) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setBrokerage("");
      load();
    } else setError(String(result.payload || "errors.server"));
  }

  if (modules && !modules.includes("realtors")) return <ModuleLock title={t("modules.realtors.name")} code="realtors" />;
  if (!items && !error) return <PageSkeleton cards={2} lines={3} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto max-w-4xl">
      <SectionHeader title={t("modules.realtors.name")} tools={<Input className="section-search" aria-label={t("command.search")} placeholder={t("command.search")} value={search} onChange={(event) => setSearch(event.target.value)} />} />
      <form className="mt-6 grid gap-3 sm:grid-cols-3" onSubmit={onCreate}>
        <Input required aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        <Input required aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
        <Input aria-label={t("app.email")} placeholder={t("app.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input aria-label={t("app.phone")} placeholder={t("app.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
        <Input aria-label={t("loan.brokerage")} placeholder={t("loan.brokerage")} value={brokerage} onChange={(event) => setBrokerage(event.target.value)} />
        <Button type="submit">{t("loan.addRealtor")}</Button>
      </form>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {["prospect", "partner"].map((status) => (
          <section key={status} className="min-w-0">
            <h2 className="font-display text-2xl">{t(`loan.realtor.${status}`)}</h2>
            <ul className="mt-3 space-y-2">
              {(items || []).filter((item) => (item.status || "partner") === status).map((item) => (
                <li key={item.id} className="rounded-2xl border border-border bg-card p-4">
                  <strong>{item.firstName} {item.lastName}</strong>
                  <p className="text-sm text-muted-foreground">{[item.brokerage, item.email, item.phone].filter(Boolean).join(" · ")}</p>
                  <Button type="button" className="mt-2" variant="outline" onClick={() => void dispatch(saveRealtorStatus({ id: item.id, status: status === "prospect" ? "partner" : "prospect" })).then(() => load())}>
                    {status === "prospect" ? t("loan.makePartner") : t("loan.makeProspect")}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {items && !items.length ? <p className="mt-4 text-sm text-muted-foreground">{t("grid.empty")}</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
    </div>
  );
}
