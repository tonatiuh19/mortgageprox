import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchMe } from "@/store/slices/authSlice";
import { fetchProfile, saveProfile, uploadProfilePhoto } from "@/store/slices/workspaceSlice";

const ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles"];
const FOCUS = ["purchase", "refinance", "fha", "va", "conventional", "jumbo"];

export default function Profile() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const staff = useAppSelector((state) => state.workspace.staffProfile);
  const tenantSlug = useAppSelector((state) => state.auth.user?.tenantSlug);
  const errorKey = useAppSelector((state) => state.workspace.errorKey);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [nmls, setNmls] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("");
  const [language, setLanguage] = useState(i18n.language.startsWith("es") ? "es" : "en");
  const [focus, setFocus] = useState<string[]>([]);
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [notifyAlso, setNotifyAlso] = useState("");
  const [notifyEvents, setNotifyEvents] = useState<string[]>(["application", "voicemail", "sms", "booking", "reminder"]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const events = ["application", "voicemail", "sms", "email", "booking", "reminder"];

  useEffect(() => {
    void dispatch(fetchProfile()).then((result) => {
      if (fetchProfile.fulfilled.match(result)) {
        const profile = result.payload;
        setFirstName(profile.firstName);
        setLastName(profile.lastName);
        setPhone(profile.phone);
        setNmls(profile.nmls);
        setBio(profile.bio);
        setTimezone(profile.timezone);
        setFocus(profile.specializations);
        setSlug(profile.publicSlug);
        setWebsite(profile.website || "");
        setLinkedin(profile.linkedin || "");
        setFacebook(profile.facebook || "");
        setInstagram(profile.instagram || "");
        setYoutube(profile.youtube || "");
        setNotifyEmail(profile.notifyEmail);
        setNotifySms(profile.notifySms);
        setNotifyAlso(profile.notifyAlso || "");
        setNotifyEvents(profile.notifyEvents || ["application", "voicemail", "sms", "booking", "reminder"]);
        setPhotoUrl(profile.photoUrl);
      }
      setReady(true);
    });
  }, [dispatch]);

  async function onPhoto(file: File | null) {
    if (file && file.size > 1_000_000) return;
    const dataUrl = file ? await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }) : undefined;
    const result = await dispatch(uploadProfilePhoto(file && dataUrl ? { dataUrl } : { clear: true }));
    if (uploadProfilePhoto.fulfilled.match(result)) setPhotoUrl(result.payload);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const result = await dispatch(saveProfile({ firstName, lastName, phone, nmls, bio, timezone, language, specializations: focus, publicSlug: slug, website, linkedin, facebook, instagram, youtube, notifyEmail, notifySms, notifyAlso, notifyEvents }));
    if (saveProfile.fulfilled.match(result)) {
      setSaved(true);
      await i18n.changeLanguage(language);
      void dispatch(fetchMe());
    }
  }

  if (!ready && !staff) return <PageSkeleton cards={1} lines={6} label={t("app.loading")} />;

  return (
    <form className="portal-rise mx-auto max-w-3xl space-y-4" onSubmit={onSubmit}>
      <SectionHeader title={t("profile.title")} meta={t("profile.lead")} />
      <div className="flex flex-wrap items-center gap-3">
        {photoUrl ? <img src={photoUrl} alt="" className="size-16 rounded-full object-cover" /> : <div className="size-16 rounded-full bg-muted" />}
        <label className="text-sm font-medium">
          {t("profile.photo")}
          <input className="mt-1 block text-sm" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void onPhoto(event.target.files?.[0] || null)} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input required aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        <Input required aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
      </div>
      <Input aria-label={t("app.phone")} placeholder={t("app.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
      <Input aria-label={t("profile.nmls")} placeholder={t("profile.nmls")} value={nmls} onChange={(event) => setNmls(event.target.value)} />
      <Textarea aria-label={t("profile.bio")} placeholder={t("profile.bio")} value={bio} maxLength={500} onChange={(event) => setBio(event.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("profile.timezone")} value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          <option value="">{t("profile.timezone")}</option>
          {ZONES.map((zone) => <option key={zone} value={zone}>{zone.replace("America/", "").replace("_", " ")}</option>)}
        </select>
        <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("profile.language")} value={language} onChange={(event) => setLanguage(event.target.value)}>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">{t("profile.focus")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FOCUS.map((item) => (
            <label key={item} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
              <input type="checkbox" checked={focus.includes(item)} onChange={(event) => setFocus((current) => event.target.checked ? [...current, item] : current.filter((code) => code !== item))} />
              {t(`profile.${item}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifyEmail} onChange={(event) => setNotifyEmail(event.target.checked)} />{t("profile.notifyEmail")}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifySms} onChange={(event) => setNotifySms(event.target.checked)} />{t("profile.notifySms")}</label>
      <Input type="email" aria-label={t("profile.notifyAlso")} placeholder={t("profile.notifyAlso")} value={notifyAlso} onChange={(event) => setNotifyAlso(event.target.value)} />
      <fieldset>
        <legend className="text-sm font-medium">{t("profile.notifyEvents")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {events.map((item) => (
            <label key={item} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
              <input type="checkbox" checked={notifyEvents.includes(item)} onChange={(event) => setNotifyEvents((current) => event.target.checked ? [...current, item] : current.filter((code) => code !== item))} />
              {t(`notify.${item}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Input aria-label={t("profile.slug")} placeholder="maya-chen" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} />
        <p className="mt-1 text-xs text-muted-foreground">{t("profile.slugHint")}</p>
        <p className="mt-4 text-sm font-medium">{t("profile.links")}</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Input aria-label={t("profile.website")} placeholder={t("profile.website")} value={website} onChange={(event) => setWebsite(event.target.value)} />
          <Input aria-label={t("profile.linkedin")} placeholder={t("profile.linkedin")} value={linkedin} onChange={(event) => setLinkedin(event.target.value)} />
          <Input aria-label={t("profile.facebook")} placeholder={t("profile.facebook")} value={facebook} onChange={(event) => setFacebook(event.target.value)} />
          <Input aria-label={t("profile.instagram")} placeholder={t("profile.instagram")} value={instagram} onChange={(event) => setInstagram(event.target.value)} />
          <Input aria-label={t("profile.youtube")} placeholder={t("profile.youtube")} value={youtube} onChange={(event) => setYoutube(event.target.value)} />
        </div>
        {tenantSlug && slug ? (
          <p className="mt-2 flex flex-wrap gap-3 text-sm">
            <a href={`/apply/${tenantSlug}/${slug}`}>{t("apply.title")}</a>
            <a href={`/book/${tenantSlug}/${slug}`}>{t("book.title")}</a>
            <a href={`/analyze/${tenantSlug}/${slug}`}>{t("loan.analyze")}</a>
          </p>
        ) : null}
      </div>
      {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      {saved ? <p className="text-sm text-muted-foreground">{t("profile.saved")}</p> : null}
      <Button type="submit">{t("app.save")}</Button>
    </form>
  );
}
