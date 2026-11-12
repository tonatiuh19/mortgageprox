import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { roleCan } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import DevFill from "@/components/dev/DevFill";
import PageSkeleton from "@/components/portal/PageSkeleton";
import ModuleLock from "@/components/portal/ModuleLock";
import SectionHeader from "@/components/portal/SectionHeader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addCampaignAudience,
  clearCampaignQuote,
  createCampaignTopic,
  fetchCampaignPeople,
  fetchCampaigns,
  removeCampaignContact,
  sendCampaign,
} from "@/store/slices/campaignsSlice";

export default function Campaigns() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const desk = useAppSelector((state) => state.campaigns.desk);
  const people = useAppSelector((state) => state.campaigns.people);
  const loading = useAppSelector((state) => state.campaigns.loading);
  const errorKey = useAppSelector((state) => state.campaigns.errorKey);
  const packQuote = useAppSelector((state) => state.campaigns.packQuote);
  const [topicId, setTopicId] = useState(0);
  const [topicName, setTopicName] = useState("");
  const [source, setSource] = useState("clients");
  const [personSearch, setPersonSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const canSpend = Boolean(user && roleCan(user.role, "settings.write"));

  useEffect(() => {
    void dispatch(fetchCampaigns({ topicId, search }));
  }, [dispatch, topicId, search]);

  useEffect(() => {
    if (!topicId) return;
    void dispatch(fetchCampaignPeople({ source, topicId, search: personSearch }));
  }, [dispatch, source, topicId, personSearch]);

  useEffect(() => {
    if (!topicId && desk?.topics[0]) setTopicId(desk.topics[0].id);
  }, [desk, topicId]);

  async function onTopic(event: FormEvent) {
    event.preventDefault();
    const created = await dispatch(createCampaignTopic(topicName));
    if (createCampaignTopic.fulfilled.match(created)) {
      setTopicName("");
      setTopicId(created.payload);
      void dispatch(fetchCampaigns({ topicId: created.payload, search }));
    }
  }

  async function onAdd(confirmPacks?: number) {
    if (!topicId || selected.length === 0) return;
    const added = await dispatch(addCampaignAudience({ topicId, source, ids: selected, confirmPacks }));
    if (addCampaignAudience.fulfilled.match(added)) {
      setSelected([]);
      void dispatch(fetchCampaigns({ topicId, search }));
      void dispatch(fetchCampaignPeople({ source, topicId, search: personSearch }));
    }
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!topicId) return;
    const sent = await dispatch(sendCampaign({ topicId, name, subject, body }));
    if (sendCampaign.fulfilled.match(sent)) {
      setName("");
      setSubject("");
      setBody("");
      void dispatch(fetchCampaigns({ topicId, search }));
    }
  }

  if (user && !user.modules.includes("campaigns")) return <ModuleLock title={t("modules.campaigns.name")} code="campaigns" />;
  if (loading && !desk) return <PageSkeleton cards={2} lines={4} label={t("app.loading")} />;
  const allowance = desk?.allowance;

  return (
    <div className="portal-rise mx-auto min-w-0 max-w-3xl">
      <SectionHeader
        title={t("modules.campaigns.name")}
        tools={<Input className="section-search" aria-label={t("campaignsPage.search")} placeholder={t("campaignsPage.search")} value={search} onChange={(event) => setSearch(event.target.value)} />}
      />
      <p className="mt-2 text-sm text-muted-foreground">{t("campaignsPage.lead")}</p>
      {allowance ? (
        <p className="mt-3 text-sm tabular-nums">
          {t("campaignsPage.allowance", {
            used: allowance.used.toLocaleString(),
            included: (allowance.included + allowance.packs * allowance.packSize).toLocaleString(),
            platform: allowance.ceilingUsed.toLocaleString(),
            ceiling: allowance.ceiling.toLocaleString(),
          })}
        </p>
      ) : null}
      <form className="mt-6 flex min-w-0 flex-wrap items-center gap-2" onSubmit={onTopic}>
        <DevFill onFill={() => { if (!topicName.trim()) setTopicName("Rate notes"); }} />
        <Input className="min-w-0 flex-1" required aria-label={t("campaignsPage.topic")} placeholder={t("campaignsPage.topic")} value={topicName} onChange={(event) => setTopicName(event.target.value)} />
        <Button type="submit">{t("campaignsPage.addTopic")}</Button>
      </form>
      {desk && desk.topics.length > 0 ? (
        <label className="mt-4 block text-sm">
          <span className="text-muted-foreground">{t("campaignsPage.topic")}</span>
          <select className="mt-1 h-11 w-full min-w-0 rounded-md border border-input bg-background px-3" aria-label={t("campaignsPage.topic")} value={topicId} onChange={(event) => { setTopicId(Number(event.target.value)); setSelected([]); dispatch(clearCampaignQuote()); }}>
            {desk.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name} ({topic.subscribers})</option>)}
          </select>
        </label>
      ) : <p className="mt-4 text-sm text-muted-foreground">{t("campaignsPage.noTopic")}</p>}
      {topicId ? (
        <section className="mt-6 min-w-0">
          <div className="flex flex-wrap gap-2">
            <select className="h-11 min-w-0 rounded-md border border-input bg-background px-3" aria-label={t("app.audience")} value={source} onChange={(event) => { setSource(event.target.value); setSelected([]); }}>
              <option value="clients">{t("app.clients")}</option>
              <option value="contacts">{t("app.contacts")}</option>
              <option value="realtors">{t("modules.realtors.name")}</option>
            </select>
            <Input className="min-w-0 flex-1" aria-label={t("campaignsPage.people")} placeholder={t("campaignsPage.people")} value={personSearch} onChange={(event) => setPersonSearch(event.target.value)} />
          </div>
          <ul className="mt-3 space-y-2">
            {people.map((person) => (
              <li key={person.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={person.name || person.email}
                  disabled={person.onList}
                  checked={person.onList || selected.includes(person.id)}
                  onChange={(event) => setSelected((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id))}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{person.name || person.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">{person.onList ? t("campaignsPage.onList") : person.email}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" disabled={selected.length === 0} onClick={() => void onAdd()}>{t("campaignsPage.addPeople")}</Button>
          </div>
          {packQuote ? (
            <div className="mt-3 rounded-xl border border-border bg-muted/60 p-3">
              <p className="text-sm">{t("campaignsPage.confirmPacks", { packs: packQuote.packs, price: formatMoney(packQuote.priceCents) })}</p>
              {canSpend ? (
                <Button type="button" className="mt-3" onClick={() => void onAdd(packQuote.packs)}>{t("campaignsPage.confirmPacksButton")}</Button>
              ) : <p className="mt-2 text-sm text-muted-foreground">{t("campaignsPage.ownerPack")}</p>}
            </div>
          ) : null}
          <ul className="mt-4 space-y-2">
            {(desk?.contacts || []).map((contact) => (
              <li key={contact.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{contact.name || contact.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">{contact.email}</span>
                </span>
                <Button type="button" variant="outline" onClick={() => void dispatch(removeCampaignContact({ topicId, contactId: contact.id })).then(() => dispatch(fetchCampaigns({ topicId, search })))}>{t("campaignsPage.remove")}</Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <form className="mt-8 grid gap-3" onSubmit={onSend}>
        <DevFill className="justify-self-start" onFill={() => {
          if (!name) setName("This week's rates");
          if (!subject) setSubject("A short rate note");
          if (!body) setBody("Rates moved this week. Reply if you want a fresh quote.");
        }} />
        <Input required aria-label={t("app.broadcastName")} placeholder={t("app.broadcastName")} value={name} onChange={(event) => setName(event.target.value)} />
        <Input required aria-label={t("campaignsPage.subject")} placeholder={t("campaignsPage.subject")} value={subject} onChange={(event) => setSubject(event.target.value)} />
        <Textarea required aria-label={t("app.message")} value={body} onChange={(event) => setBody(event.target.value)} />
        <Button type="submit" disabled={!topicId}>{t("campaignsPage.send")}</Button>
      </form>
      <ul className="mt-6 space-y-2">
        {(desk?.campaigns || []).map((item) => (
          <li key={item.id} className="rounded-2xl border border-border bg-card p-4">
            <strong>{item.name}</strong>
            <p className="text-sm text-muted-foreground">{item.topicName} · {item.subject}</p>
            <p className="text-xs text-muted-foreground">{t(`app.broadcastStatus.${item.status}`, { defaultValue: item.status })} · {t("campaignsPage.opens", { opened: item.openedCount, clicked: item.clickedCount, sent: item.audienceCount })}</p>
          </li>
        ))}
      </ul>
      {desk && desk.campaigns.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t("campaignsPage.none")}</p> : null}
      {errorKey ? <p className="mt-3 text-sm text-destructive">{t(errorKey)}</p> : null}
    </div>
  );
}
