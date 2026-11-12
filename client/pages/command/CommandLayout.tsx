import { Activity, Building2, LayoutDashboard, Mail, ScrollText } from "lucide-react";
import PortalShell from "@/components/portal/PortalShell";

export default function CommandLayout() {
  return (
    <PortalShell
      loginPath="/login"
      titleKey="command.title"
      homePath="/command"
      tabs={["/command", "/command/tenants", "/command/activity", "/command/legal"]}
      nav={[
        { to: "/command", end: true, labelKey: "command.overview", icon: LayoutDashboard, section: "command.sectionHome" },
        { to: "/command/tenants", labelKey: "command.tenants", icon: Building2, perm: "tenants.read", section: "command.sectionNetwork" },
        { to: "/command/activity", labelKey: "command.activity", icon: Activity, perm: "activity.read", section: "command.sectionNetwork" },
        { to: "/command/legal", labelKey: "command.legal", icon: ScrollText, perm: "tenants.write", section: "command.sectionSite" },
        { to: "/command/emails", labelKey: "email.nav", icon: Mail, perm: "tenants.write", section: "command.sectionSite" },
      ]}
    />
  );
}
