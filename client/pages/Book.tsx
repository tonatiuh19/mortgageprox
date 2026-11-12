import { FormEvent, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OfficeMeta } from "@/components/PageMeta";
import PageMeta from "@/components/PageMeta";
import PageSkeleton from "@/components/portal/PageSkeleton";
import PersonWelcome from "@/components/portal/PersonWelcome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch } from "@/store/hooks";
import { fetchBookSlots, fetchPublicOffice, moveBooking, submitPublicBook, type PublicOffice } from "@/store/slices/workspaceSlice";

export default function Book() {
  const { t } = useTranslation();
  const { slug = "", officer = "" } = useParams();
  const [params] = useSearchParams();
  const moveToken = params.get("token") || "";
  const dispatch = useAppDispatch();
  const [office, setOffice] = useState<PublicOffice | null>(null);
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [note, setNote] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    void dispatch(fetchPublicOffice(officer ? { slug, officer } : slug)).then((result) => {
      if (fetchPublicOffice.fulfilled.match(result)) setOffice(result.payload);
      else setMissing(true);
    });
  }, [dispatch, slug, officer]);

  useEffect(() => {
    if (!date) return;
    setSlotsLoading(true);
    void dispatch(fetchBookSlots({ slug, date, officer })).then((result) => {
      if (fetchBookSlots.fulfilled.match(result)) setSlots(result.payload);
      setSlotsLoading(false);
    });
  }, [dispatch, slug, officer, date]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = await dispatch(submitPublicBook({ slug, officer, firstName, lastName, email, phone, startsAt, note }));
    if (submitPublicBook.fulfilled.match(result)) setSent(result.payload);
    else setError(String(result.payload || "errors.server"));
  }

  if (missing) return <><PageMeta title={t("meta.missingTitle")} description={t("meta.missingDescription")} noIndex /><p className="p-8 text-sm text-muted-foreground">{t("errors.notFound")}</p></>;
  if (!office) return <PageSkeleton cards={1} lines={4} label={t("app.loading")} />;

  return (
    <form className="portal-rise mx-auto min-h-screen w-full max-w-lg space-y-6 px-4 py-10 sm:px-6 sm:py-14" style={office.primaryColor ? { ["--primary" as string]: office.primaryColor } : undefined} onSubmit={onSubmit}>
      <OfficeMeta slug={slug} kind="book" name={office.name} person={office.officer?.name} image={office.officer?.photoUrl || office.logoUrl} themeColor={office.primaryColor} />
      <PersonWelcome office={office} />
      <h1 className="font-display text-4xl">{t("book.title")}</h1>
      <p className="text-muted-foreground">{t("book.lead")}</p>
      {sent ? (
        <div className="space-y-2 text-sm">
          <p>{t("book.sent")}</p>
          {sent ? <p>{t("book.move", { link: `${window.location.origin}/book/${slug}?token=${sent}` })}</p> : null}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input required aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            <Input required aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
          <Input required type="email" aria-label={t("app.email")} placeholder={t("app.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input aria-label={t("app.phone")} placeholder={t("app.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Input required type="date" aria-label={t("book.when")} value={date} onChange={(event) => { setDate(event.target.value); setStartsAt(""); }} />
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <button key={slot} type="button" className={`rounded-full border px-3 py-2 text-sm ${startsAt === slot ? "border-primary bg-primary/10" : "border-border"}`} onClick={() => setStartsAt(slot)}>
                {slot.slice(11, 16)}
              </button>
            ))}
            {date && slotsLoading ? <p className="text-sm text-muted-foreground">{t("book.looking")}</p> : null}
            {date && !slotsLoading && slots.length === 0 ? <p className="text-sm text-muted-foreground">{t("book.none")}</p> : null}
          </div>
          <Textarea aria-label={t("book.note")} placeholder={t("book.note")} value={note} onChange={(event) => setNote(event.target.value)} />
          {error ? <p className="text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
          <Button type="submit" disabled={!startsAt}>{moveToken ? t("book.reschedule") : t("book.send")}</Button>
          {moveToken ? (
            <Button type="button" variant="outline" disabled={!startsAt} onClick={() => void dispatch(moveBooking({ token: moveToken, startsAt })).then((result) => {
              if (moveBooking.fulfilled.match(result)) setSent(moveToken);
              else setError(String(result.payload || "errors.server"));
            })}>{t("book.reschedule")}</Button>
          ) : null}
        </>
      )}
    </form>
  );
}
