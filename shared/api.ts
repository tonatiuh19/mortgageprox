/** Types shared by the client and `api/index.ts` (`import type` only on the server). */

export const ACTORS = ["platform", "brokerage", "borrower"] as const;
export type Actor = (typeof ACTORS)[number];

export const ROLES = [
  "platform_owner",
  "platform_support",
  "platform_billing",
  "brokerage_owner",
  "leadership",
  "loan_officer",
  "processor",
  "partner",
  "borrower",
] as const;
export type Role = (typeof ROLES)[number];

export const TENANT_PERMS = [
  "clients.read",
  "clients.write",
  "loans.read",
  "loans.write",
  "tasks.read",
  "files.write",
  "team.read",
  "team.manage",
  "settings.read",
  "settings.write",
  "inbox.read",
  "inbox.write",
  "reports.read",
  "realtors.read",
  "office.read",
  "contacts.read",
  "contacts.write",
] as const;
export type TenantPerm = (typeof TENANT_PERMS)[number];

export const PLATFORM_PERMS = [
  "platform.read",
  "tenants.read",
  "tenants.write",
  "tenants.billing",
  "tenants.suspend",
  "plans.write",
  "activity.read",
] as const;
export type PlatformPerm = (typeof PLATFORM_PERMS)[number];
export type Perm = TenantPerm | PlatformPerm | "portal.read" | "tenant.admin";

/**
 * Keep this object identical to `ROLE_PERMISSIONS` inside `api/index.ts`.
 * `api/permissions.test.ts` fails the build if they drift.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  platform_owner: [
    "platform.read",
    "tenants.read",
    "tenants.write",
    "tenants.billing",
    "tenants.suspend",
    "plans.write",
    "activity.read",
  ],
  platform_support: ["platform.read", "tenants.read", "tenants.suspend", "activity.read"],
  platform_billing: ["platform.read", "tenants.read", "tenants.billing", "plans.write", "activity.read"],
  brokerage_owner: ["tenant.admin"],
  leadership: ["tenant.admin"],
  loan_officer: ["clients.read", "clients.write", "loans.read", "loans.write", "tasks.read", "files.write", "inbox.read", "inbox.write", "reports.read", "realtors.read", "office.read", "contacts.read", "contacts.write"],
  processor: ["clients.read", "loans.read", "loans.write", "tasks.read", "files.write", "reports.read", "office.read"],
  partner: ["realtors.read", "clients.read", "loans.read", "office.read", "contacts.read", "inbox.read"],
  borrower: ["portal.read"],
};

export function roleCan(role: string | null | undefined, perm: string): boolean {
  const list = ROLE_PERMISSIONS[role as Role] ?? [];
  if (list.includes(perm)) return true;
  if (list.includes("tenant.admin") && (TENANT_PERMS as readonly string[]).includes(perm)) return true;
  return false;
}

export function clientScope(role: string): "own" | "all" {
  return role === "loan_officer" || role === "partner" ? "own" : "all";
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  actor: Actor;
  tenantId: number | null;
  tenantName: string | null;
  tenantSlug: string | null;
  customDomain: string | null;
  primaryColor: string | null;
  brandRadius: string | null;
  brandHeadline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  tenantStatus: string | null;
  planCode: string | null;
  trialEndsAt: string | null;
  /** due, paid, or none. Null for platform and borrower sessions. */
  startFeeStatus: string | null;
  modules: string[];
}

export interface CatalogModule {
  code: string;
  nameKey: string;
  summaryKey: string;
  category: "core" | "growth" | "communications" | "premium";
  kind: "product" | "service";
  sortOrder: number;
}

export interface CatalogPlan {
  code: string;
  nameKey: string;
  taglineKey: string;
  priceCents: number;
  seatLimit: number;
  isQuote: boolean;
  /** Cents due to open a trial. Zero on a quoted plan. */
  trialFeeCents: number;
  /** Null means no fixed cap. Zero means the plan does not include it. */
  includedLoans: number | null;
  includedEmails: number | null;
  includedLetters: number | null;
  includedSms: number | null;
  includedVoiceMinutes: number | null;
  sortOrder: number;
  modules: string[];
}

export interface CatalogAddon {
  code: string;
  nameKey: string;
  summaryKey: string;
  priceCents: number;
  billing: "monthly" | "once" | "usage";
  sortOrder: number;
}

export interface CatalogResponse {
  ok: true;
  modules: CatalogModule[];
  plans: CatalogPlan[];
  addons: CatalogAddon[];
  trialDays: number;
}

export interface WizardSelection {
  modules: string[];
  seats: number;
  customStyles: boolean;
  twilio: boolean;
  customDomain: boolean;
}

export interface PlanRecommendation {
  planCode: string;
  reasons: string[];
  addons: string[];
  /** Included in the plan price, so the wizard does not add them again. */
  waivedAddons: string[];
  trialDays: number;
}

export interface TenantListItem {
  id: number;
  name: string;
  slug: string;
  status: string;
  planCode: string | null;
  planNameKey: string | null;
  trialEndsAt: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  moduleCount: number;
  createdAt: string;
}

export interface ClientListItem {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  createdAt: string;
}

export interface LoanListItem {
  id: number;
  clientId: number;
  clientName: string;
  purpose: string;
  amountCents: number;
  stageName: string | null;
  status: string;
  createdAt: string;
}

export interface LoanBoardCard {
  id: number;
  clientId: number;
  clientName: string;
  purpose: string;
  amountCents: number;
  status: string;
  assigneeId: number | null;
  assigneeName: string | null;
  createdAt: string;
  address?: string;
}

export interface LoanBoardColumn {
  id: number;
  name: string;
  code?: string | null;
  isFunded: boolean;
  reminderOn: boolean;
  total: number;
  hasMore: boolean;
  items: LoanBoardCard[];
}

export interface LoanOfficerOption {
  id: number;
  name: string;
}

export interface TeamMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  publicSlug?: string;
}

export interface ActivityItem {
  id: number;
  tenantId: number | null;
  tenantName: string | null;
  actorType: string;
  action: string;
  summary: string;
  createdAt: string;
}

export interface GridQuery {
  page: number;
  limit: number;
  offset: number;
  sort: string;
  orderBy: string;
  dir: "ASC" | "DESC";
  search: string;
}

export type OfficeGroup = "home" | "grow" | "inbox" | "people" | "files" | "setup";

export interface OfficeSectionDef {
  id: string;
  module: string;
  group: OfficeGroup;
  sort: number;
  labelKey: string;
}

/** Menu catalog. The plan is the ceiling. A brokerage can hide, rename and reorder inside it. */
export const OFFICE_CATALOG: readonly OfficeSectionDef[] = [
  { id: "dashboard", module: "dashboard", group: "home", sort: 10, labelKey: "app.dashboard" },
  { id: "reports", module: "dashboard", group: "home", sort: 20, labelKey: "app.reports" },
  { id: "pipeline", module: "pipeline", group: "grow", sort: 30, labelKey: "app.pipeline" },
  { id: "application", module: "application", group: "grow", sort: 40, labelKey: "modules.application.name" },
  { id: "realtors", module: "realtors", group: "grow", sort: 50, labelKey: "modules.realtors.name" },
  { id: "broadcasts", module: "broadcasts", group: "grow", sort: 60, labelKey: "modules.broadcasts.name" },
  { id: "campaigns", module: "campaigns", group: "grow", sort: 62, labelKey: "modules.campaigns.name" },
  { id: "conversations", module: "conversations", group: "inbox", sort: 70, labelKey: "modules.conversations.name" },
  { id: "email", module: "email", group: "inbox", sort: 80, labelKey: "modules.email.name" },
  { id: "phone", module: "phone", group: "inbox", sort: 90, labelKey: "modules.phone.name" },
  { id: "transcripts", module: "transcripts", group: "inbox", sort: 95, labelKey: "modules.transcripts.name" },
  { id: "templates", module: "templates", group: "inbox", sort: 100, labelKey: "modules.templates.name" },
  { id: "calendar", module: "calendar", group: "inbox", sort: 110, labelKey: "modules.calendar.name" },
  { id: "contacts", module: "clients", group: "people", sort: 120, labelKey: "app.contacts" },
  { id: "clients", module: "clients", group: "people", sort: 130, labelKey: "app.clients" },
  { id: "groups", module: "groups", group: "people", sort: 140, labelKey: "modules.groups.name" },
  { id: "team", module: "team", group: "people", sort: 150, labelKey: "app.team" },
  { id: "tasks", module: "tasks", group: "files", sort: 160, labelKey: "modules.tasks.name" },
  { id: "documents", module: "documents", group: "files", sort: 170, labelKey: "app.documents" },
  { id: "compliance", module: "compliance", group: "files", sort: 180, labelKey: "modules.compliance.name" },
  { id: "letters", module: "letters", group: "files", sort: 190, labelKey: "modules.letters.name" },
  { id: "credit", module: "credit", group: "files", sort: 200, labelKey: "modules.credit.name" },
  { id: "calculators", module: "calculators", group: "files", sort: 210, labelKey: "modules.calculators.name" },
  { id: "website", module: "website", group: "setup", sort: 220, labelKey: "modules.website.name" },
  { id: "reminders", module: "automations", group: "setup", sort: 230, labelKey: "app.reminders" },
  { id: "billing", module: "brand", group: "setup", sort: 235, labelKey: "app.billing" },
  { id: "settings", module: "brand", group: "setup", sort: 240, labelKey: "app.settings" },
];

export const BROKER_ROLES = ["brokerage_owner", "leadership", "loan_officer", "processor", "partner"] as const;

/** "*" means every catalog section. A list is the only sections that role sees unless an override turns one on. */
export const OFFICE_ROLE_ALLOW: Record<string, readonly string[] | "*"> = {
  brokerage_owner: "*",
  leadership: "*",
  loan_officer: "*",
  processor: "*",
  partner: ["dashboard", "pipeline", "clients", "contacts", "calculators", "conversations"],
};

/** Hidden by default even when the allow list is "*". An explicit override can show them. */
export const OFFICE_ROLE_HIDDEN: Record<string, readonly string[]> = {
  loan_officer: ["team", "settings", "billing"],
  processor: ["team", "settings", "billing", "broadcasts", "campaigns", "phone", "realtors", "website", "conversations", "email", "transcripts"],
};

export type AllowanceKey = "seats" | "loans" | "emails" | "letters" | "sms" | "voice";
export type AllowanceState = "off" | "open" | "ok" | "watch" | "full" | "quote";

export interface AllowanceMeter {
  key: AllowanceKey;
  included: number | null;
  used: number;
  state: AllowanceState;
}

export interface SeatOffer {
  priceCents: number;
  included: number;
  extra: number;
  used: number;
}

export interface UsagePackOffer {
  code: string;
  meter: "emails" | "letters" | "loans";
  units: number;
  priceCents: number;
}

export interface McpUsage {
  enabled: boolean;
  calls: number;
  cents: number;
  priceCents: number;
  tokenPrefix: string | null;
}

/** Monthly contact allowance for Campaigns. Null when the plan does not include it. */
export interface CampaignOffer {
  included: number;
  packs: number;
  packSize: number;
  priceCents: number;
  used: number;
  ceiling: number;
  ceilingUsed: number;
}

export interface BrandProfile {
  name: string;
  phone: string;
  nmls: string;
  addressLine: string;
  city: string;
  region: string;
  postalCode: string;
  letterHold: boolean;
  supportEmail: string;
  primaryColor: string | null;
  brandRadius: string | null;
  brandHeadline: string | null;
  customDomain: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
}

export interface BillingSnapshot {
  planCode: string | null;
  priceCents: number;
  isQuote: boolean;
  trialEndsAt: string | null;
  startFeeCents: number;
  startFeeStatus: string;
  publishableKey: string | null;
  allowances: AllowanceMeter[];
  /** Null on a quote. Extra seats are $29 each and stay billed until removed. */
  seatOffer: SeatOffer | null;
  /** One-time packs for emails, letters and open loans. Texts and minutes are not sold. */
  packs: UsagePackOffer[];
  /** Null on Starter and Growth. Scale and Custom include 800, then $9 a month per 100. */
  campaignOffer: CampaignOffer | null;
  mcp: McpUsage;
}

export function defaultSectionVisible(role: string, sectionId: string): boolean {
  const allow = OFFICE_ROLE_ALLOW[role] ?? "*";
  if (allow !== "*" && !allow.includes(sectionId)) return false;
  return !(OFFICE_ROLE_HIDDEN[role] ?? []).includes(sectionId);
}

export function sectionVisible(input: {
  role: string;
  sectionId: string;
  module: string | null;
  modules: readonly string[];
  hidden: boolean;
  roleVisible: boolean | null;
}): boolean {
  if (input.module && !input.modules.includes(input.module)) return false;
  if (input.hidden) return false;
  if (input.roleVisible === false) return false;
  if (input.roleVisible === true) return true;
  return defaultSectionVisible(input.role, input.sectionId);
}

export interface OfficeNavItem {
  id: string;
  label: string | null;
  group: OfficeGroup;
  sort: number;
}

export interface OfficeMenuSection {
  id: string;
  module: string;
  group: OfficeGroup;
  sort: number;
  labelKey: string;
  customLabel: string | null;
  hidden: boolean;
  entitled: boolean;
}

export interface OfficeMenuRole {
  role: string;
  sectionId: string;
  visible: boolean;
}

export interface ContactItem {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  kind: string;
  status: string;
  clientId: number | null;
  createdAt: string;
}

export interface ThreadItem {
  id: number;
  channel: string;
  subject: string;
  status: string;
  unread: number;
  contactName: string | null;
  clientName: string | null;
  lastMessageAt: string | null;
  loanId?: number | null;
}

export interface ThreadMessage {
  id: number;
  direction: string;
  channel: string;
  body: string;
  status: string;
  callOutcome: string | null;
  forwardedTo: string | null;
  durationSec: number | null;
  transcript: string | null;
  createdAt: string;
}

export interface MailboxItem {
  id: number;
  email: string;
  displayName: string | null;
  assignedUserId: number | null;
  status: string;
  lastError: string | null;
}

export interface TranscriptItem {
  id: number;
  threadId: number;
  subject: string;
  transcript: string;
  emailed: boolean;
  createdAt: string;
}

export type RingStep = "blocked" | "browser" | "forward" | "voicemail" | "ended";

export interface PhoneSettings {
  forwardingEnabled: boolean;
  forwardingPhone: string | null;
  voicemailEnabled: boolean;
  greeting: string | null;
  browserCalls: boolean;
}

export interface PhoneLine {
  id: number;
  e164: string;
  label: string;
  assignedUserId: number | null;
  isPrimary: boolean;
  isActive: boolean;
  ringTimeoutSec: number;
  greeting: string | null;
}

export interface BlockedNumber {
  id: number;
  e164: string;
  note: string | null;
  blockCalls?: boolean;
  blockTexts?: boolean;
  createdAt?: string | null;
  createdBy?: string | null;
}

export interface PhoneDesk {
  twilio: boolean;
  canManage: boolean;
  settings: PhoneSettings;
  ring: RingStep[];
  lines: PhoneLine[];
  blocked: BlockedNumber[];
}

export interface TaskItem {
  id: number;
  loanId: number | null;
  loanName: string | null;
  title: string;
  status: string;
  column: string;
  priority: string;
  detail?: string;
  category?: string;
  dueOn: string | null;
  dueAt: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  position: number;
}

export interface DocumentItem {
  id: number;
  loanId: number;
  name: string;
  status: string;
  hasFile?: boolean;
}

export interface ComplianceItem {
  id: number;
  loanId: number;
  code: string;
  label: string;
  status: string;
  dueOn?: string;
  documentId?: number | null;
}

export interface EmailDetail {
  label: string;
  value: string;
}

export interface EmailDraft {
  subject: string;
  greeting: string;
  headline: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  details: EmailDetail[];
  footer: string;
}

export interface PlatformEmailItem extends EmailDraft {
  code: string;
}

export interface TemplateItem {
  id: number;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  greeting: string | null;
  headline: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  details: EmailDetail[];
  footer: string | null;
}

export type FlowStepType = "trigger" | "wait" | "send_email" | "send_letter" | "send_sms" | "notify_staff" | "condition" | "wait_for_reply" | "end";
export type FlowEdgeType = "next" | "yes" | "no" | "replied" | "no_reply";

export interface FlowStep {
  stepKey: string;
  stepType: FlowStepType;
  label: string;
  templateId: number | null;
  config: Record<string, unknown>;
  x: number;
  y: number;
}

export interface FlowEdge {
  sourceKey: string;
  targetKey: string;
  edgeType: FlowEdgeType;
}

export interface FlowSummary {
  id: number;
  name: string;
  description: string;
  stageId: number | null;
  stageName: string | null;
  enabled: boolean;
  stopOnReply: boolean;
  quietStartHour: number;
  quietEndHour: number;
  stepCount: number;
  activeRuns: number;
}

export interface FlowDetail {
  id: number;
  name: string;
  description: string;
  stageId: number | null;
  enabled: boolean;
  stopOnReply: boolean;
  quietStartHour: number;
  quietEndHour: number;
  steps: FlowStep[];
  edges: FlowEdge[];
}

export interface FlowRunItem {
  id: number;
  loanId: number;
  clientName: string;
  status: string;
  stepKey: string | null;
  nextRunAt: string | null;
  endReason: string | null;
  enteredAt: string;
}

export interface FlowItem extends FlowSummary {}

export interface CampaignTopic {
  id: number;
  name: string;
  subscribers: number;
}

export interface CampaignContact {
  id: number;
  email: string;
  name: string;
}

export interface CampaignItem {
  id: number;
  name: string;
  subject: string;
  topicName: string;
  status: string;
  audienceCount: number;
  openedCount: number;
  clickedCount: number;
  sentAt: string | null;
}

export interface CampaignPerson {
  id: number;
  name: string;
  email: string;
  onList: boolean;
}

export interface CampaignDesk {
  allowance: CampaignOffer;
  topics: CampaignTopic[];
  contacts: CampaignContact[];
  campaigns: CampaignItem[];
}

export interface BroadcastItem {
  id: number;
  name: string;
  channel: string;
  audience: string;
  body: string;
  status: string;
  createdAt: string;
  recipientCount?: number;
  sentCount?: number;
  templateId?: number | null;
}

export interface CreditItem {
  id: number;
  clientId: number | null;
  fileName: string | null;
  summary: string;
  scoreBand: string;
  status: string;
  createdAt: string;
}

export interface StageItem {
  id: number;
  name: string;
  code?: string | null;
  sort: number;
  isFunded: boolean;
}

export interface ReportOfficer {
  name: string;
  openLoans: number;
  funded: number;
}

export interface ReportSnapshot {
  openLoans: number;
  funded: number;
  conversionPct: number;
  avgDaysToClose: number | null;
  officers: ReportOfficer[];
  sources?: { code: string; count: number; share: number }[];
  purposes?: { code: string; count: number }[];
  revenueCents?: number;
  approvalPct?: number;
}
