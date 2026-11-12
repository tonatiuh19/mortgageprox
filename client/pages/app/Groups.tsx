import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch } from "@/store/hooks";
import { addGroupMember, createGroup, fetchGroups } from "@/store/slices/workspaceSlice";

type Group = { id: number; name: string; kind: string; members: number; people?: string };

export default function Groups() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [items, setItems] = useState<Group[] | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("household");
  const [error, setError] = useState("");
  const [person, setPerson] = useState<Record<number, string>>({});

  function load() {
    void dispatch(fetchGroups()).then((result) => {
      if (fetchGroups.fulfilled.match(result)) setItems(result.payload);
      else setError(String(result.payload || "errors.server"));
    });
  }

  useEffect(() => { load(); }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(createGroup({ name, kind }));
    if (createGroup.fulfilled.match(result)) {
      setName("");
      load();
    } else setError(String(result.payload || "errors.server"));
  }

  if (!items && !error) return <PageSkeleton cards={2} lines={2} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto max-w-3xl">
      <SectionHeader title={t("modules.groups.name")} meta={t("loan.groupsLead")} />
      <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={onCreate}>
        <Input required aria-label={t("loan.groupName")} placeholder={t("loan.groupName")} value={name} onChange={(event) => setName(event.target.value)} />
        <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("loan.groupKind")} value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="household">{t("loan.household")}</option>
          <option value="vip">{t("loan.vip")}</option>
          <option value="other">{t("source.other")}</option>
        </select>
        <Button type="submit">{t("loan.addGroup")}</Button>
      </form>
      <ul className="mt-6 space-y-2">
        {(items || []).map((item) => (
          <li key={item.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{item.name}</strong>
              <span className="text-sm text-muted-foreground">{t(`loan.${item.kind}`, { defaultValue: item.kind })} · {t("loan.members", { count: item.members })}</span>
            </div>
            {item.people ? <p className="mt-2 text-sm text-muted-foreground">{item.people}</p> : null}
            <form className="mt-3 flex min-w-0 flex-wrap gap-2" onSubmit={(event) => {
              event.preventDefault();
              const clientId = Number(person[item.id] || 0);
              if (!clientId) return;
              void dispatch(addGroupMember({ groupId: item.id, clientId })).then((result) => {
                if (addGroupMember.fulfilled.match(result)) {
                  setPerson({ ...person, [item.id]: "" });
                  load();
                } else setError(String(result.payload || "errors.server"));
              });
            }}>
              <Input className="min-w-0 flex-1" aria-label={t("loan.personId")} placeholder={t("loan.personId")} value={person[item.id] || ""} onChange={(event) => setPerson({ ...person, [item.id]: event.target.value })} />
              <Button type="submit">{t("loan.addPerson")}</Button>
            </form>
          </li>
        ))}
      </ul>
      {items && !items.length ? <p className="mt-4 text-sm text-muted-foreground">{t("grid.empty")}</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
    </div>
  );
}
