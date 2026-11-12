import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  FileCheck2,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  Mails,
  Phone,
  Captions,
  Settings,
  Sparkles,
  Users,
  Workflow,
  Building2,
  Calculator,
  ClipboardList,
  Contact,
  FileText,
  Handshake,
  ScrollText,
  ShieldCheck,
  BarChart3,
  Bell,
  CreditCard,
  LayoutGrid,
} from "lucide-react";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchOfficeNav } from "@/store/slices/recordsSlice";
import { useTranslation } from "react-i18next";

const GROUP: Record<string, string> = {
  home: "app.sectionHome",
  grow: "app.sectionGrow",
  inbox: "app.sectionInbox",
  people: "app.sectionPeople",
  files: "app.sectionFiles",
  setup: "app.sectionSetup",
};

const BASE_NAV: PortalNavItem[] = [
  { sectionId: "dashboard", to: "/app", end: true, labelKey: "app.dashboard", icon: LayoutDashboard, section: "app.sectionHome" },
  { sectionId: "reports", to: "/app/reports", labelKey: "app.reports", icon: BarChart3, perm: "reports.read", module: "dashboard", section: "app.sectionHome" },
  { sectionId: "pipeline", to: "/app/pipeline", labelKey: "app.pipeline", icon: Workflow, perm: "loans.read", module: "pipeline", section: "app.sectionGrow" },
  { sectionId: "application", to: "/app/applications", labelKey: "modules.application.name", icon: FileText, perm: "loans.read", module: "application", section: "app.sectionGrow" },
  { sectionId: "realtors", to: "/app/realtors", labelKey: "modules.realtors.name", icon: Handshake, perm: "realtors.read", module: "realtors", section: "app.sectionGrow" },
  { sectionId: "broadcasts", to: "/app/broadcasts", labelKey: "modules.broadcasts.name", icon: Megaphone, perm: "inbox.read", module: "broadcasts", section: "app.sectionGrow" },
  { sectionId: "campaigns", to: "/app/campaigns", labelKey: "modules.campaigns.name", icon: Mails, perm: "inbox.read", module: "campaigns", section: "app.sectionGrow" },
  { sectionId: "conversations", to: "/app/conversations", labelKey: "modules.conversations.name", icon: Inbox, perm: "inbox.read", module: "conversations", section: "app.sectionInbox" },
  { sectionId: "email", to: "/app/email", labelKey: "modules.email.name", icon: Mail, perm: "inbox.read", module: "email", section: "app.sectionInbox" },
  { sectionId: "phone", to: "/app/phone", labelKey: "modules.phone.name", icon: Phone, perm: "inbox.read", module: "phone", section: "app.sectionInbox" },
  { sectionId: "transcripts", to: "/app/transcripts", labelKey: "modules.transcripts.name", icon: Captions, perm: "inbox.read", module: "transcripts", section: "app.sectionInbox" },
  { sectionId: "templates", to: "/app/templates", labelKey: "modules.templates.name", icon: ScrollText, module: "templates", perm: "office.read", section: "app.sectionInbox" },
  { sectionId: "calendar", to: "/app/calendar", labelKey: "modules.calendar.name", icon: CalendarDays, module: "calendar", section: "app.sectionInbox" },
  { sectionId: "contacts", to: "/app/contacts", labelKey: "app.contacts", icon: Contact, perm: "contacts.read", module: "clients", section: "app.sectionPeople" },
  { sectionId: "clients", to: "/app/clients", labelKey: "app.clients", icon: Users, perm: "clients.read", module: "clients", section: "app.sectionPeople" },
  { sectionId: "groups", to: "/app/groups", labelKey: "modules.groups.name", icon: Contact, module: "groups", section: "app.sectionPeople" },
  { sectionId: "team", to: "/app/team", labelKey: "app.team", icon: ShieldCheck, perm: "team.read", module: "team", section: "app.sectionPeople" },
  { sectionId: "tasks", to: "/app/tasks", labelKey: "modules.tasks.name", icon: ClipboardList, perm: "tasks.read", module: "tasks", section: "app.sectionFiles" },
  { sectionId: "documents", to: "/app/documents", labelKey: "app.documents", icon: FileText, perm: "tasks.read", module: "documents", section: "app.sectionFiles" },
  { sectionId: "compliance", to: "/app/compliance", labelKey: "modules.compliance.name", icon: FileCheck2, perm: "tasks.read", module: "compliance", section: "app.sectionFiles" },
  { sectionId: "letters", to: "/app/letters", labelKey: "modules.letters.name", icon: FileText, module: "letters", section: "app.sectionFiles" },
  { sectionId: "credit", to: "/app/credit", labelKey: "modules.credit.name", icon: Sparkles, perm: "office.read", module: "credit", section: "app.sectionFiles" },
  { sectionId: "calculators", to: "/app/calculators", labelKey: "modules.calculators.name", icon: Calculator, perm: "office.read", module: "calculators", section: "app.sectionFiles" },
  { sectionId: "website", to: "/app/website", labelKey: "modules.website.name", icon: Building2, module: "website", section: "app.sectionSetup" },
  { sectionId: "reminders", to: "/app/reminders", labelKey: "app.reminders", icon: Bell, perm: "office.read", module: "automations", section: "app.sectionSetup" },
  { sectionId: "billing", to: "/app/billing", labelKey: "app.billing", icon: CreditCard, perm: "settings.read", module: "brand", section: "app.sectionSetup" },
  { sectionId: "billing", to: "/app/modules", labelKey: "market.nav", icon: LayoutGrid, perm: "settings.read", module: "brand", section: "app.sectionSetup" },
  { sectionId: "settings", to: "/app/settings", labelKey: "app.settings", icon: Settings, perm: "settings.write", module: "brand", section: "app.sectionSetup" },
];

export default function AppLayout() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const officeNav = useAppSelector((state) => state.records.nav);
  useEffect(() => {
    void dispatch(fetchOfficeNav());
  }, [dispatch]);
  const nav = useMemo(() => {
    if (!officeNav) return BASE_NAV;
    const byId = new Map(officeNav.map((item) => [item.id, item]));
    return BASE_NAV
      .filter((item) => item.sectionId && byId.has(item.sectionId))
      .map((item) => {
        const office = byId.get(item.sectionId as string);
        return {
          ...item,
          label: office?.label || undefined,
          section: office ? GROUP[office.group] : item.section,
          sort: office?.sort ?? item.sort,
        };
      })
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }, [officeNav]);
  const days = user?.trialEndsAt ? Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / 86400_000) : null;
  const notice = user?.actor === "brokerage" && user.startFeeStatus === "due" ? (
    <p className="portal-notice"><Link to="/app/billing">{t("app.feeDue")}</Link></p>
  ) : user?.tenantStatus === "suspended" ? (
    <p className="portal-notice">{t("app.suspended")}</p>
  ) : user?.tenantStatus === "trial" && days != null && days < 0 ? (
    <p className="portal-notice">{t("app.trialEnded")}</p>
  ) : user?.tenantStatus === "trial" && days != null ? (
    <p className="portal-notice">{t("app.trialDays", { count: Math.max(days, 0) })}</p>
  ) : null;

  return (
    <PortalShell
      loginPath="/login"
      titleKey="app.title"
      homePath="/app"
      tabs={["/app", "/app/pipeline", "/app/contacts", "/app/conversations"]}
      notice={notice}
      nav={nav}
    />
  );
}
