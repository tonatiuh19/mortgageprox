/**
 * MortgageProx — Vercel serverless Express monolith.
 * Keep all runtime API logic inline in this file (no relative value imports).
 * `import type` from shared/ is allowed.
 */
import "dotenv/config";
import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import mysql from "mysql2/promise";
import { Resend } from "resend";
import Stripe from "stripe";
import { put } from "@vercel/blob";
import type {
  ActivityItem,
  Actor,
  AuthUser,
  BroadcastItem,
  CatalogAddon,
  CatalogModule,
  CatalogPlan,
  ClientListItem,
  ComplianceItem,
  ContactItem,
  CreditItem,
  DocumentItem,
  FlowDetail,
  FlowEdge,
  FlowItem,
  FlowRunItem,
  FlowStep,
  FlowSummary,
  GridQuery,
  LoanBoardCard,
  LoanBoardColumn,
  LoanListItem,
  LoanOfficerOption,
  MailboxItem,
  TranscriptItem,
  OfficeGroup,
  OfficeMenuRole,
  OfficeMenuSection,
  OfficeNavItem,
  OfficeSectionDef,
  PaginationInfo,
  PhoneDesk,
  PhoneLine,
  BlockedNumber,
  PhoneSettings,
  PlanRecommendation,
  AllowanceKey,
  AllowanceMeter,
  AllowanceState,
  BillingSnapshot,
  SeatOffer,
  UsagePackOffer,
  McpUsage,
  CampaignOffer,
  CampaignContact,
  CampaignDesk,
  CampaignItem,
  CampaignPerson,
  CampaignTopic,
  ReportSnapshot,
  RingStep,
  Role,
  StageItem,
  TaskItem,
  TeamMember,
  EmailDetail,
  EmailDraft,
  TemplateItem,
  TenantListItem,
  ThreadItem,
  ThreadMessage,
  WizardSelection,
} from "../shared/api";

const APP_NAME = "MortgageProx";
const COOKIE = "mp_session";
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_DAYS = 30;
const TRIAL_DAYS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GROWTH_MODULES = new Set(["tasks", "realtors", "scheduler", "calendar", "automations", "letters"]);
const MESSAGE_CHANNELS = ["sms", "email", "call", "note"] as const;
const CALL_OUTCOMES = ["answered", "missed", "forwarded", "voicemail"] as const;
const COMMS_MODULES = new Set(["conversations", "phone", "email", "broadcasts", "transcripts"]);
const MICROSOFT_SCOPES = "offline_access Mail.Read Mail.Send User.Read";
const PREMIUM_MODULES = new Set(["ai", "credit", "mcp", "campaigns"]);
const CAMPAIGN_PACK_SIZE = 100;
const CAMPAIGN_PACK_CENTS = 900;
const CAMPAIGN_INCLUDED = 800;
const CAMPAIGN_CEILING = 1000;
const MCP_CALL_CENTS = 3;
const MCP_PROTOCOL = "2025-03-26";

/** Must stay identical to ROLE_PERMISSIONS in shared/api.ts. */
const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  platform_owner: ["platform.read", "tenants.read", "tenants.write", "tenants.billing", "tenants.suspend", "plans.write", "activity.read"],
  platform_support: ["platform.read", "tenants.read", "tenants.suspend", "activity.read"],
  platform_billing: ["platform.read", "tenants.read", "tenants.billing", "plans.write", "activity.read"],
  brokerage_owner: ["tenant.admin"],
  leadership: ["tenant.admin"],
  loan_officer: ["clients.read", "clients.write", "loans.read", "loans.write", "tasks.read", "files.write", "inbox.read", "inbox.write", "reports.read", "realtors.read", "office.read", "contacts.read", "contacts.write"],
  processor: ["clients.read", "loans.read", "loans.write", "tasks.read", "files.write", "reports.read", "office.read"],
  partner: ["realtors.read", "clients.read", "loans.read", "office.read", "contacts.read", "inbox.read"],
  borrower: ["portal.read"],
};

const TENANT_PERMS = [
  "clients.read", "clients.write", "loans.read", "loans.write", "tasks.read", "files.write",
  "team.read", "team.manage", "settings.read", "settings.write", "inbox.read", "inbox.write",
  "reports.read", "realtors.read", "office.read", "contacts.read", "contacts.write",
];

const DEFAULT_STAGES: Array<[string, number, number, string]> = [
  ["Draft", 10, 0, "draft"],
  ["App Sent", 20, 0, "app_sent"],
  ["Application Received", 30, 0, "application_received"],
  ["Pre-Approved", 40, 0, "pre_approved"],
  ["Under Contract / Loan Setup", 50, 0, "under_contract"],
  ["Submitted to Underwriting", 60, 0, "submitted_uw"],
  ["Approved with Conditions", 70, 0, "approved_conditions"],
  ["Clear to Close", 80, 0, "clear_to_close"],
  ["Docs Out", 90, 0, "docs_out"],
  ["Loan Funded", 100, 1, "funded"],
];

const LEAD_SOURCES = ["current_client_referral", "past_client", "past_client_referral", "personal_friend", "realtor", "advertisement", "business_partner", "builder", "public_wizard", "other"];
const PROPERTY_TYPES = ["single_family", "condo", "townhouse", "multi", "manufactured", "other"];
const INCOME_TYPES = ["w2", "self_employed", "retired", "other"];
const NOTIFY_EVENTS = ["application", "voicemail", "sms", "email", "booking", "reminder"];
const LOAN_CHECKLIST: Array<[string, string, string, string]> = [
  ["Government-issued ID", "Provide a valid government-issued photo identification.", "document", "high"],
  ["Social Security card", "Provide the Social Security card issued by the Social Security Administration.", "document", "high"],
  ["Visa or work authorization", "Provide a current visa or work authorization document, if it applies.", "document", "high"],
  ["ITIN assignment letter", "Provide the IRS ITIN assignment letter, if it applies.", "document", "normal"],
];

function canMoveStage(role: string): boolean {
  return role === "brokerage_owner" || role === "leadership" || role === "loan_officer";
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

function stateCode(value: unknown): string {
  const raw = String(value || "").trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return STATE_CODES[raw.toLowerCase()] || "";
}

function sqlDay(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function mismoMoney(cents: unknown): string {
  return (num(cents) / 100).toFixed(2);
}

function mismoIncomeType(value: unknown): string {
  const kind = String(value || "");
  if (kind === "self_employed") return "SelfEmploymentIncome";
  if (kind === "retired") return "Retirement";
  if (kind === "other") return "Other";
  return "Base";
}

function mismoPropertyDetail(type: unknown, value: string): string {
  const kind = String(type || "single_family");
  const attached = kind === "condo" || kind === "townhouse" ? "Attached" : "Detached";
  const method = kind === "manufactured" ? "Manufactured" : "SiteBuilt";
  const units = kind === "multi" ? "2" : "1";
  const project = kind === "condo" ? "<ProjectLegalStructureType>Condominium</ProjectLegalStructureType>" : "";
  return `<PropertyEstimatedValueAmount>${value}</PropertyEstimatedValueAmount><PropertyUsageType>PrimaryResidence</PropertyUsageType><AttachmentType>${attached}</AttachmentType><ConstructionMethodType>${method}</ConstructionMethodType><FinancedUnitCount>${units}</FinancedUnitCount>${project}`;
}

/** MISMO 3.4 from the fields stored on the loan. It does not invent credit, assets, or a product. */
function mismoDocument(row: Record<string, unknown>): string {
  const purpose = String(row.purpose) === "refinance" ? "Refinance" : "Purchase";
  const amount = mismoMoney(row.amount_cents);
  const value = mismoMoney(row.property_value_cents);
  const down = num(row.down_payment_cents);
  const region = stateCode(row.region);
  const birthday = sqlDay(row.birthday);
  const applied = sqlDay(row.application_on);
  const closing = sqlDay(row.est_close_on);
  const email = String(row.client_email || "");
  const phone = String(row.client_phone || "").replace(/\D/g, "");
  const employer = String(row.employer || "");
  const job = String(row.job_title || "");
  const monthly = (num(row.annual_income_cents) / 1200).toFixed(2);
  const income = mismoIncomeType(row.income_type);
  const employment = String(row.income_type) === "self_employed" ? "SelfEmployed" : "Primary";
  const contacts = [
    phone ? `<CONTACT_POINT><CONTACT_POINT_TELEPHONE><ContactPointTelephoneValue>${xmlEscape(phone)}</ContactPointTelephoneValue></CONTACT_POINT_TELEPHONE></CONTACT_POINT>` : "",
    email ? `<CONTACT_POINT><CONTACT_POINT_EMAIL><ContactPointEmailValue>${xmlEscape(email)}</ContactPointEmailValue></CONTACT_POINT_EMAIL></CONTACT_POINT>` : "",
  ].filter(Boolean).join("");
  const office = String(row.brokerage_name || "");
  const nmls = String(row.nmls || "");
  const lender = office ? `<PARTY SequenceNumber="2"><LEGAL_ENTITY><LEGAL_ENTITY_DETAIL><FullName>${xmlEscape(office)}</FullName></LEGAL_ENTITY_DETAIL></LEGAL_ENTITY><ROLES><ROLE><ROLE_DETAIL><PartyRoleType>LoanOriginationCompany</PartyRoleType></ROLE_DETAIL>${nmls ? `<LICENSES><LICENSE><LICENSE_DETAIL><LicenseIdentifier>${xmlEscape(nmls)}</LicenseIdentifier><LicenseIssuingAuthorityName>NMLS</LicenseIssuingAuthorityName></LICENSE_DETAIL></LICENSE></LICENSES>` : ""}</ROLE></ROLES></PARTY>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" MISMOReferenceModelIdentifier="3.4.032420160128">
  <ABOUT_VERSIONS><ABOUT_VERSION>
    <AboutVersionIdentifier>3.4</AboutVersionIdentifier>
    <CreatedDatetime>${new Date().toISOString()}</CreatedDatetime>
  </ABOUT_VERSION></ABOUT_VERSIONS>
  <DEAL_SETS><DEAL_SET><DEALS><DEAL>
    <LOANS><LOAN LoanRoleType="SubjectLoan" SequenceNumber="1">
      <LOAN_IDENTIFIERS><LOAN_IDENTIFIER>
        <LoanIdentifier>${num(row.id)}</LoanIdentifier>
        <LoanIdentifierType>LenderLoan</LoanIdentifierType>
      </LOAN_IDENTIFIER></LOAN_IDENTIFIERS>
      <TERMS_OF_LOAN>
        <LoanPurposeType>${purpose}</LoanPurposeType>
        <NoteAmount>${amount}</NoteAmount>
        <BaseLoanAmount>${amount}</BaseLoanAmount>
      </TERMS_OF_LOAN>
      ${down > 0 ? `<DOWN_PAYMENTS><DOWN_PAYMENT><DownPaymentAmount>${mismoMoney(down)}</DownPaymentAmount></DOWN_PAYMENT></DOWN_PAYMENTS>` : ""}
      ${applied ? `<LOAN_DETAIL><ApplicationReceivedDate>${applied}</ApplicationReceivedDate></LOAN_DETAIL>` : ""}
      ${closing ? `<CLOSING_INFORMATION><CLOSING_INFORMATION_DETAIL><LoanEstimatedClosingDate>${closing}</LoanEstimatedClosingDate></CLOSING_INFORMATION_DETAIL></CLOSING_INFORMATION>` : ""}
    </LOAN></LOANS>
    <COLLATERALS><COLLATERAL><SUBJECT_PROPERTY>
      <ADDRESS>
        <AddressLineText>${xmlEscape(String(row.address_line || ""))}</AddressLineText>
        <CityName>${xmlEscape(String(row.city || ""))}</CityName>
        ${region ? `<StateCode>${region}</StateCode>` : ""}
        <PostalCode>${xmlEscape(String(row.postal_code || ""))}</PostalCode>
        <CountryCode>US</CountryCode>
      </ADDRESS>
      <PROPERTY_DETAIL>${mismoPropertyDetail(row.property_type, value)}</PROPERTY_DETAIL>
    </SUBJECT_PROPERTY></COLLATERAL></COLLATERALS>
    <PARTIES>
      <PARTY SequenceNumber="1"><INDIVIDUAL>
        <NAME>
          <FirstName>${xmlEscape(String(row.first_name || ""))}</FirstName>
          <LastName>${xmlEscape(String(row.last_name || ""))}</LastName>
        </NAME>
        ${contacts ? `<CONTACT_POINTS>${contacts}</CONTACT_POINTS>` : ""}
      </INDIVIDUAL>
      <ROLES><ROLE><BORROWER>
        ${birthday ? `<BORROWER_DETAIL><BorrowerBirthDate>${birthday}</BorrowerBirthDate></BORROWER_DETAIL>` : ""}
        <CURRENT_INCOME><CURRENT_INCOME_ITEMS><CURRENT_INCOME_ITEM SequenceNumber="1"><CURRENT_INCOME_ITEM_DETAIL>
          <CurrentIncomeMonthlyTotalAmount>${monthly}</CurrentIncomeMonthlyTotalAmount>
          <IncomeType>${income}</IncomeType>
          <EmploymentIncomeIndicator>${income === "Retirement" || income === "Other" ? "false" : "true"}</EmploymentIncomeIndicator>
        </CURRENT_INCOME_ITEM_DETAIL></CURRENT_INCOME_ITEM></CURRENT_INCOME_ITEMS></CURRENT_INCOME>
        ${employer || job ? `<EMPLOYERS><EMPLOYER SequenceNumber="1"><LEGAL_ENTITY><LEGAL_ENTITY_DETAIL><FullName>${xmlEscape(employer)}</FullName></LEGAL_ENTITY_DETAIL></LEGAL_ENTITY><EMPLOYMENT><EmploymentPositionDescription>${xmlEscape(job)}</EmploymentPositionDescription><EmploymentStatusType>Current</EmploymentStatusType><EmploymentClassificationType>${employment}</EmploymentClassificationType></EMPLOYMENT></EMPLOYER></EMPLOYERS>` : ""}
      </BORROWER><ROLE_DETAIL><PartyRoleType>Borrower</PartyRoleType></ROLE_DETAIL></ROLE></ROLES>
      </PARTY>
      ${lender}
    </PARTIES>
  </DEAL></DEALS></DEAL_SET></DEAL_SETS>
</MESSAGE>`;
}

function simplePdf(lines: string[]): Buffer {
  const safe = lines.slice(0, 40).map((line) => line.replace(/[^\x20-\x7E]/g, " ").replace(/[()\\]/g, " ").slice(0, 90));
  const stream = safe.map((line, index) => `BT /F1 11 Tf 48 ${740 - index * 16} Td (${line}) Tj ET`).join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function zipStore(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name.replace(/[^\w.\- ]/g, "_").slice(0, 80) || "file");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, file.data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(file.data.length, 20);
    cen.writeUInt32LE(file.data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += local.length + name.length + file.data.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, end]);
}

function decodeUpload(value: unknown, max = 800_000): { data: Buffer; type: string } | null {
  const raw = String(value || "");
  const match = raw.match(/^data:([\w./+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const data = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (data.length < 1 || data.length > max) return null;
  return { data, type: match[1].slice(0, 80) };
}

const WEEKDAY_HOURS = "1:540-1020,2:540-1020,3:540-1020,4:540-1020,5:540-1020";

function parseHours(raw: unknown): { day: number; start: number; end: number }[] {
  const text = String(raw || "").trim() || WEEKDAY_HOURS;
  const windows: { day: number; start: number; end: number }[] = [];
  for (const part of text.split(",")) {
    const match = part.trim().match(/^([0-6]):(\d{1,4})-(\d{1,4})$/);
    if (!match) continue;
    const start = Number(match[2]);
    const end = Number(match[3]);
    if (end > start && end <= 1440) windows.push({ day: Number(match[1]), start, end });
  }
  return windows;
}

function slotList(date: string, hours: string | null, slot: number, buffer: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const window = parseHours(hours).find((item) => item.day === day);
  if (!window) return [];
  const out: string[] = [];
  const step = Math.max(15, slot) + Math.max(0, buffer);
  for (let minute = window.start; minute + slot <= window.end; minute += step) {
    const hh = String(Math.floor(minute / 60)).padStart(2, "0");
    const mm = String(minute % 60).padStart(2, "0");
    out.push(`${date}T${hh}:${mm}:00`);
  }
  return out;
}

function loanFacts(body: Record<string, unknown> | undefined) {
  const propertyType = PROPERTY_TYPES.includes(String(body?.propertyType) as (typeof PROPERTY_TYPES)[number]) ? String(body?.propertyType) : "single_family";
  return {
    propertyType,
    address: clip(body?.addressLine, 160) || null,
    city: clip(body?.city, 80) || null,
    region: clip(body?.region, 40) || null,
    postal: clip(body?.postalCode, 20) || null,
    value: Math.max(0, Math.floor(Number(body?.propertyValueCents) || 0)),
    down: Math.max(0, Math.floor(Number(body?.downPaymentCents) || 0)),
    employer: clip(body?.employer, 160) || null,
    job: clip(body?.jobTitle, 120) || null,
    income: Math.max(0, Math.floor(Number(body?.annualIncomeCents) || 0)),
    incomeType: INCOME_TYPES.includes(String(body?.incomeType)) ? String(body?.incomeType) : null,
  };
}

async function seedLoanChecklist(tenantId: number, loanId: number) {
  const taskModule = await queryRows(`SELECT 1 AS ok FROM tenant_modules WHERE tenant_id = ? AND module_code = 'tasks' AND enabled = 1 LIMIT 1`, [tenantId]);
  if (!taskModule[0]) return;
  const templates = await queryRows(`SELECT title, detail, category, priority FROM task_templates WHERE tenant_id = ? ORDER BY id`, [tenantId]);
  const rows = templates.length
    ? templates.map((row) => [String(row.title), row.detail ? String(row.detail) : "", row.category ? String(row.category) : "document", String(row.priority || "normal")] as const)
    : LOAN_CHECKLIST;
  for (const [title, detail, category, priority] of rows) {
    await database().execute(
      `INSERT INTO tasks (tenant_id, loan_id, title, detail, category, status, column_key, priority, position) VALUES (?, ?, ?, ?, ?, 'open', 'todo', ?, 0)`,
      [tenantId, loanId, title, detail, category, priority],
    );
  }
}

async function notifyStaff(tenantId: number, event: string, headline: string, body: string, buttonLabel = "", buttonUrl = "") {
  const rows = await queryRows(
    `SELECT email, notify_also, notify_events FROM tenant_users WHERE tenant_id = ? AND status = 'active' AND notify_email = 1`,
    [tenantId],
  );
  const brand = await tenantBrand(tenantId);
  const subject = headline;
  const text = body;
  const rendered = renderEmail(brand, {
    subject,
    greeting: "",
    headline,
    body: text,
    buttonLabel,
    buttonUrl,
    details: [],
    footer: `${brand.name} is a mortgage brokerage. ${brand.name} is not a bank and does not approve loans.`,
  });
  for (const row of rows) {
    const events = String(row.notify_events || "application,voicemail,sms,booking,reminder").split(",").map((item) => item.trim());
    if (!events.includes(event)) continue;
    const targets = [String(row.email)];
    if (row.notify_also && EMAIL_RE.test(String(row.notify_also))) targets.push(String(row.notify_also));
    for (const to of targets) {
      try {
        await sendEmail(to, subject, rendered.text, { html: rendered.html, fromName: brand.name, replyTo: brand.replyTo });
      } catch (error) {
        console.error("[notify]", error instanceof Error ? error.message : error);
      }
    }
  }
}

async function officeSnapshot(tenantId: number, scope: string, userId: number) {
  const money = await queryRows(
    `SELECT SUM(CASE WHEN status = 'funded' THEN amount_cents ELSE 0 END) AS revenue,
            SUM(letter_active = 1) AS approved,
            COUNT(*) AS files
       FROM loans WHERE tenant_id = ? AND status <> 'archived' AND (? = 'all' OR assigned_user_id = ?)`,
    [tenantId, scope, userId],
  );
  const files = num(money[0]?.files);
  const purposeRows = await queryRows(
    `SELECT purpose, COUNT(*) AS total FROM loans WHERE tenant_id = ? AND status <> 'archived' AND (? = 'all' OR assigned_user_id = ?) GROUP BY purpose`,
    [tenantId, scope, userId],
  );
  return {
    revenueCents: num(money[0]?.revenue),
    approvalPct: files > 0 ? Math.round((num(money[0]?.approved) / files) * 1000) / 10 : 0,
    purposes: purposeRows.map((row) => ({ code: String(row.purpose), count: num(row.total) })),
  };
}

async function notifyApplication(tenantId: number, borrower: string) {
  const brand = await tenantBrand(tenantId);
  const templates = await queryRows(
    `SELECT subject, body FROM message_templates WHERE tenant_id = ? AND channel = 'email' AND name = 'Application' LIMIT 1`,
    [tenantId],
  );
  const fill = (value: string) => value.replace(/\{\{\s*borrower\s*\}\}/g, borrower);
  const headline = `New application for ${brand.name}`;
  const body = templates[0]?.body ? fill(String(templates[0].body)) : `${borrower} sent an application to ${brand.name}.`;
  const subject = templates[0]?.subject ? fill(String(templates[0].subject)) : headline;
  await notifyStaff(tenantId, "application", subject, body);
}

function applicantWelcome(language: "en" | "es", purpose: "purchase" | "refinance"): EmailDraft {
  const purchase = purpose === "purchase";
  if (language === "es") {
    return {
      subject: purchase ? "Recibimos tu solicitud de compra" : "Recibimos tu solicitud de refinanciamiento",
      greeting: "Hola {{firstName}},",
      headline: "Tu expediente está abierto.",
      body: purchase
        ? "{{brokerage}} ya tiene tu solicitud de compra. {{officer}} te acompaña. Una identificación con foto, los últimos dos recibos de pago, los W-2 de los últimos dos años y los estados de cuenta de los últimos dos meses ayudan a avanzar. Puedes enviarlos desde tu portal. Entra con este correo y te enviaremos un código."
        : "{{brokerage}} ya tiene tu solicitud de refinanciamiento. {{officer}} te acompaña. Ayuda tener una identificación con foto, los últimos dos recibos de pago, los W-2 de los últimos dos años, un estado de cuenta reciente de la hipoteca y los estados de cuenta de los últimos dos meses. Entra con este correo y te enviaremos un código.",
      buttonLabel: "Abrir tu portal",
      buttonUrl: "{{loginUrl}}",
      details: [],
      footer: "{{brokerage}} es una correduría hipotecaria. {{brokerage}} no es un banco y no aprueba préstamos.",
    };
  }
  return {
    subject: purchase ? "We have your purchase application" : "We have your refinance application",
    greeting: "Hello {{firstName}},",
    headline: "Your file is open.",
    body: purchase
      ? "{{brokerage}} has your purchase application. {{officer}} will walk this with you. A photo ID, the last two pay stubs, the last two years of W-2s, and the last two months of bank statements move this faster. You can send them from your portal. Sign in with this email and we will send you a code."
      : "{{brokerage}} has your refinance application. {{officer}} will walk this with you. It helps to have a photo ID, the last two pay stubs, the last two years of W-2s, a recent mortgage statement, and the last two months of bank statements. Sign in with this email and we will send you a code.",
    buttonLabel: "Open your portal",
    buttonUrl: "{{loginUrl}}",
    details: [],
    footer: "{{brokerage}} is a mortgage brokerage. {{brokerage}} is not a bank and does not approve loans.",
  };
}

async function welcomeApplicant(input: {
  req: Request;
  tenantId: number;
  clientId: number;
  loanId: number;
  assigned: number | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postal: string | null;
  purpose: "purchase" | "refinance";
  officerName: string;
  language: "en" | "es";
}): Promise<boolean> {
  const officer = input.officerName || (input.language === "es" ? "Tu oficial de préstamos" : "Your loan officer");
  try {
    await database().execute(
      `INSERT INTO borrowers (tenant_id, client_id, email, first_name, last_name, phone, address_line, city, region, postal_code, preferred_language, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE client_id = VALUES(client_id), first_name = VALUES(first_name), last_name = VALUES(last_name),
         phone = COALESCE(VALUES(phone), phone), address_line = COALESCE(VALUES(address_line), address_line),
         city = COALESCE(VALUES(city), city), region = COALESCE(VALUES(region), region),
         postal_code = COALESCE(VALUES(postal_code), postal_code), preferred_language = VALUES(preferred_language), status = 'active'`,
      [input.tenantId, input.clientId, input.email, input.firstName, input.lastName, input.phone, input.address, input.city, input.region, input.postal, input.language],
    );
  } catch (error) {
    console.error("[welcome] account", error instanceof Error ? error.message : error);
    return false;
  }
  try {
    const cap = await assertAllowance(input.tenantId, "emails", 1);
    if (cap) return false;
    const brand = await tenantBrand(input.tenantId);
    const draft = fillEmail(applicantWelcome(input.language, input.purpose), {
      firstName: input.firstName,
      brokerage: brand.name,
      officer,
      loginUrl: `${publicOrigin(input.req)}/login?email=${encodeURIComponent(input.email)}`,
    });
    if (input.officerName) draft.details = [{ label: input.language === "es" ? "Oficial" : "Loan officer", value: input.officerName }];
    const rendered = renderEmail(brand, draft);
    await sendEmail(input.email, draft.subject, rendered.text, { html: rendered.html, replyTo: brand.replyTo, fromName: brand.name });
    const existing = await queryRows(
      `SELECT id FROM conversation_threads WHERE tenant_id = ? AND client_id = ? AND channel = 'email' ORDER BY id DESC LIMIT 1`,
      [input.tenantId, input.clientId],
    );
    const threadId = existing[0]
      ? num(existing[0].id)
      : num((await database().execute(
        `INSERT INTO conversation_threads (tenant_id, client_id, loan_id, channel, subject, status, unread_count, last_message_at, assigned_user_id)
         VALUES (?, ?, ?, 'email', ?, 'open', 0, NOW(), ?)`,
        [input.tenantId, input.clientId, input.loanId, draft.subject.slice(0, 160), input.assigned],
      ))[0]?.insertId);
    await database().execute(
      `INSERT INTO conversation_messages (tenant_id, thread_id, direction, channel, body, status) VALUES (?, ?, 'out', 'email', ?, 'sent')`,
      [input.tenantId, threadId, draft.body],
    );
    await database().execute(`UPDATE conversation_threads SET last_message_at = NOW(), subject = ? WHERE id = ?`, [draft.subject.slice(0, 160), threadId]);
    return true;
  } catch (error) {
    console.error("[welcome] send", error instanceof Error ? error.message : error);
    return false;
  }
}

async function openSlots(tenantId: number, userId: number | null, date: string): Promise<string[]> {
  const settings = userId
    ? await queryRows(`SELECT slot_minutes, buffer_minutes, advance_days, min_hours, hours_json FROM scheduler_settings WHERE tenant_id = ? AND user_id = ? LIMIT 1`, [tenantId, userId])
    : [];
  const row = settings[0];
  const slot = Math.min(120, Math.max(15, num(row?.slot_minutes) || 30));
  const buffer = Math.min(60, Math.max(0, num(row?.buffer_minutes)));
  const advance = Math.min(90, Math.max(1, num(row?.advance_days) || 21));
  const minHours = Math.min(72, Math.max(0, row ? num(row.min_hours) : 2));
  const start = new Date(`${date}T12:00:00Z`).getTime();
  if (!Number.isFinite(start)) return [];
  if (start > Date.now() + advance * 86_400_000 + 86_400_000) return [];
  const earliest = new Date(Date.now() + minHours * 3_600_000);
  const booked = await queryRows(
    `SELECT DATE_FORMAT(starts_at, '%Y-%m-%dT%H:%i:00') AS stamp FROM appointments
      WHERE tenant_id = ? AND starts_at >= ? AND starts_at < DATE_ADD(?, INTERVAL 1 DAY) AND (? IS NULL OR user_id = ? OR user_id IS NULL)`,
    [tenantId, `${date} 00:00:00`, `${date} 00:00:00`, userId, userId],
  );
  const taken = new Set(booked.map((item) => String(item.stamp)));
  return slotList(date, row?.hours_json ? String(row.hours_json) : null, slot, buffer).filter((stamp) => {
    if (taken.has(stamp)) return false;
    return new Date(stamp).getTime() >= earliest.getTime();
  });
}

/** Keep identical to OFFICE_CATALOG, OFFICE_ROLE_ALLOW and OFFICE_ROLE_HIDDEN in shared/api.ts. */
const OFFICE_CATALOG: readonly OfficeSectionDef[] = [
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

const BROKER_ROLES = ["brokerage_owner", "leadership", "loan_officer", "processor", "partner"];
const OFFICE_ROLE_ALLOW: Record<string, readonly string[] | "*"> = {
  brokerage_owner: "*",
  leadership: "*",
  loan_officer: "*",
  processor: "*",
  partner: ["dashboard", "pipeline", "clients", "contacts", "calculators", "conversations"],
};
const OFFICE_ROLE_HIDDEN: Record<string, readonly string[]> = {
  loan_officer: ["team", "settings", "billing"],
  processor: ["team", "settings", "billing", "broadcasts", "campaigns", "phone", "realtors", "website", "conversations", "email", "transcripts"],
};
const COMPLIANCE_ITEMS: Array<[string, string]> = [
  ["intent", "Intent to proceed"],
  ["disclosures", "Disclosures sent"],
  ["identity", "Identity collected"],
  ["income", "Income documents"],
  ["steering", "Anti-steering note"],
];

function defaultSectionVisible(role: string, sectionId: string): boolean {
  const allow = OFFICE_ROLE_ALLOW[role] ?? "*";
  if (allow !== "*" && !allow.includes(sectionId)) return false;
  return !(OFFICE_ROLE_HIDDEN[role] ?? []).includes(sectionId);
}

function sectionVisible(input: {
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

type SqlRow = Record<string, unknown>;
interface Tx {
  execute(sql: string, params?: any[]): Promise<[any, any]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}
interface Db {
  execute(sql: string, params?: any[]): Promise<[any, any]>;
  getConnection(): Promise<Tx>;
}

const outbox: Array<{ to: string; subject: string; text: string; html?: string }> = [];
let testDb: Db | null = null;
let pool: mysql.Pool | null = null;

function notifySandbox(): boolean {
  return process.env.VITEST === "true" || process.env.NOTIFY_SANDBOX === "true";
}

function database(): Db {
  if (process.env.VITEST === "true") {
    if (!testDb) throw new Error("Vitest DB is mocked. Call __test.setDb before a route that reads the database.");
    return testDb;
  }
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 4000),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === "false" ? undefined : { minVersion: "TLSv1.2" },
      waitForConnections: true,
      connectionLimit: 5,
      enableKeepAlive: true,
      connectTimeout: 20_000,
    });
  }
  return pool;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(`${process.env.JWT_SECRET || "dev"}:${value}`).digest("hex");
}

function roleCan(role: string | null | undefined, perm: string): boolean {
  const list = ROLE_PERMISSIONS[role as Role] ?? [];
  if (list.includes(perm)) return true;
  if (list.includes("tenant.admin") && TENANT_PERMS.includes(perm)) return true;
  return false;
}

function clientScope(role: string): "own" | "all" {
  return role === "loan_officer" || role === "partner" ? "own" : "all";
}

// Keep in step with client/lib/wizard.ts. Transcripts and Twilio require conversations or phone.
function withWizardRules(input: WizardSelection): WizardSelection {
  const numbers = input.modules.includes("conversations") || input.modules.includes("phone");
  return {
    ...input,
    modules: numbers ? input.modules : input.modules.filter((code) => code !== "transcripts"),
    twilio: numbers ? input.twilio : false,
  };
}

function recommendPlan(input: WizardSelection): PlanRecommendation {
  const choice = withWizardRules(input);
  const mods = new Set(choice.modules);
  const comms = choice.twilio || [...mods].some((code) => COMMS_MODULES.has(code));
  const premium = [...mods].some((code) => PREMIUM_MODULES.has(code));
  const growth = [...mods].some((code) => GROWTH_MODULES.has(code));
  const addons: string[] = [];
  if (choice.twilio) addons.push("twilio");
  if (choice.customDomain) addons.push("custom_domain");
  if (choice.seats > 25) addons.push("extra_seat");

  const reasons: string[] = [];
  let planCode = "starter";
  if (choice.seats > 25) {
    planCode = "custom";
    reasons.push("recommend.reason.seatsCustom");
  } else if (comms || premium || choice.seats > 10 || choice.customDomain) {
    planCode = "scale";
    const domainOnly = choice.customDomain && !comms && !premium && choice.seats <= 10;
    reasons.push(domainOnly ? "recommend.reason.domain" : comms ? "recommend.reason.communications" : choice.seats > 10 ? "recommend.reason.seats" : "recommend.reason.premium");
  } else if (growth || choice.seats > 3) {
    planCode = "growth";
    reasons.push(choice.seats > 3 && !growth ? "recommend.reason.seats" : "recommend.reason.growth");
  } else {
    reasons.push("recommend.reason.starter");
  }
  if (choice.customDomain && reasons[0] !== "recommend.reason.domain") reasons.push("recommend.reason.domain");
  if (mods.has("mcp")) reasons.push("recommend.reason.mcp");
  if (mods.has("campaigns")) reasons.push("recommend.reason.campaigns");
  const waivedAddons = planCode === "scale" || planCode === "custom" ? ["twilio", "custom_domain"] : [];
  return { planCode, reasons, addons: [...new Set(addons)], waivedAddons, trialDays: TRIAL_DAYS };
}

const PLAN_RANK: Record<string, number> = { starter: 1, growth: 2, scale: 3, custom: 4 };

function moduleMinimumPlan(category: string): "starter" | "growth" | "scale" {
  if (category === "growth") return "growth";
  if (category === "communications" || category === "premium") return "scale";
  return "starter";
}

function planIncludesModule(planCode: string, category: string): boolean {
  if (planCode === "custom") return true;
  return (PLAN_RANK[planCode] || 0) >= PLAN_RANK[moduleMinimumPlan(category)];
}

function moduleChange(input: { role: string; planCode: string; category: string; turningOn: boolean }): { ok: true } | { error: string; plan?: string } {
  if (input.role !== "brokerage_owner") return { error: "errors.forbidden" };
  if (!input.turningOn && input.category === "core") return { error: "errors.billing.core" };
  if (input.turningOn && !planIncludesModule(input.planCode, input.category)) {
    return { error: "errors.billing.upgrade", plan: moduleMinimumPlan(input.category) };
  }
  return { ok: true };
}

function upgradeChange(input: { role: string; from: string; to: string }): { ok: true } | { error: string } {
  if (input.role !== "brokerage_owner") return { error: "errors.forbidden" };
  if (input.to === "custom" || input.from === "custom") return { error: "errors.billing.quote" };
  if ((PLAN_RANK[input.to] || 0) <= (PLAN_RANK[input.from] || 0)) return { error: "errors.billing.downgrade" };
  if (input.to !== "growth" && input.to !== "scale") return { error: "validation.wizard" };
  return { ok: true };
}

function parseWizard(body: unknown): WizardSelection | null {
  if (!body || typeof body !== "object") return null;
  const source = body as Record<string, unknown>;
  const modules = Array.isArray(source.modules)
    ? [...new Set(source.modules.map(String).filter((code) => /^[a-z0-9_]{2,40}$/.test(code)))]
    : [];
  const seats = Math.floor(Number(source.seats));
  if (!Number.isFinite(seats) || seats < 1 || seats > 200) return null;
  return {
    modules,
    seats,
    customStyles: Boolean(source.customStyles),
    twilio: Boolean(source.twilio),
    customDomain: Boolean(source.customDomain),
  };
}

function parseGridQuery(query: Record<string, unknown>, sortMap: Record<string, string>, fallback: string): GridQuery {
  const page = Math.min(10_000, Math.max(1, Math.floor(Number(query.page) || 1)));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 25)));
  const requested = String(query.sort || fallback);
  const sort = sortMap[requested] ? requested : fallback;
  const dir = String(query.dir || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";
  const search = String(query.search || "").trim().slice(0, 80);
  return { page, limit, offset: (page - 1) * limit, sort, orderBy: sortMap[sort], dir, search };
}

function likeTerm(search: string): string {
  return `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function pagination(page: number, limit: number, total: number): PaginationInfo {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit) || 1) };
}

function wantsCsv(query: Record<string, unknown>): boolean {
  return String(query.format || "") === "csv";
}

function sendCsv(res: { setHeader: (name: string, value: string) => void; send: (body: string) => void }, filename: string, header: string[], rows: unknown[][]) {
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const body = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(body);
}

const SITE_CODES = ["home", "about", "loans", "faq", "contact"] as const;
const PROFILE_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles"];
const PROFILE_FOCUS = ["purchase", "refinance", "fha", "va", "conventional", "jumbo"];

function defaultSitePage(code: string, name: string): { title: string; body: string } {
  if (code === "about") return { title: `About ${name}`, body: `${name} is a mortgage brokerage. ${name} is not a bank and does not approve loans.` };
  if (code === "loans") return { title: "Loan options", body: "Purchase and refinance. A loan officer walks through the options that fit the file." };
  if (code === "faq") return { title: "Questions", body: "How long does a file take?\nMost files move in a few weeks once the documents are in.\n\nWho approves the loan?\nA lender makes that decision." };
  if (code === "contact") return { title: "Contact", body: "Send a note and the office will reply." };
  return { title: name, body: `${name} helps people buy and refinance a home.` };
}

function slugOk(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length >= 3 && value.length <= 48;
}

function iso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function num(value: unknown): number {
  return Number(value || 0);
}

function optionalNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const PLATFORM_HOST = "mortgageprox.com";

function tenantHost(slug: string): string {
  return `${slug}.${PLATFORM_HOST}`;
}

/** `northwind.mortgageprox.com` is a brokerage. The apex, www, and app are the platform. */
function tenantSlugFromHost(host: string): string | null {
  const bare = host.toLowerCase().split(":")[0].replace(/\.$/, "");
  const suffix = `.${PLATFORM_HOST}`;
  if (!bare.endsWith(suffix)) return null;
  const label = bare.slice(0, -suffix.length);
  if (!label || label.includes(".") || label === "www" || label === "app") return null;
  return /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(label) ? label : null;
}

/** A customer's own hostname. MortgageProx and Vercel hosts are refused. */
function normalizeHostname(value: unknown): string | null {
  const raw = String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0].replace(/\.$/, "");
  if (!raw || raw.length > 253 || raw === PLATFORM_HOST || raw.endsWith(`.${PLATFORM_HOST}`) || raw.endsWith(".vercel.app")) return null;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(raw) ? raw : null;
}

function requestHost(req: Request): string {
  return String(req.headers["x-mp-host"] || req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
}

type PublicTenant = {
  id: number;
  name: string;
  slug: string;
  customDomain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
};

/** A brokerage address, a suspended address, or a host that is not a brokerage. */
async function publicTenant(host: string): Promise<PublicTenant | "none" | "hidden"> {
  const slug = tenantSlugFromHost(host);
  const domain = slug ? null : normalizeHostname(host);
  if (!slug && !domain) return "none";
  const rows = await queryRows(
    `SELECT id, name, slug, status, custom_domain, logo_url, primary_color FROM tenants WHERE ${slug ? "slug" : "custom_domain"} = ? LIMIT 1`,
    [slug || domain],
  );
  if (!rows[0]) return "none";
  if (String(rows[0].status) === "suspended") return "hidden";
  return {
    id: num(rows[0].id),
    name: String(rows[0].name),
    slug: String(rows[0].slug),
    customDomain: rows[0].custom_domain ? String(rows[0].custom_domain) : null,
    logoUrl: rows[0].logo_url ? String(rows[0].logo_url) : null,
    primaryColor: rows[0].primary_color ? String(rows[0].primary_color) : null,
  };
}

function tenantLegalStarter(name: string): { terms: string; privacy: string } {
  const brokerage = name.replace(/\s+/g, " ").trim().slice(0, 160) || "This brokerage";
  return {
    terms: `# Terms\n\nThese terms cover your use of ${brokerage}'s website, application and borrower portal.\n\n## Who you are working with\n\n${brokerage} is a mortgage brokerage. ${brokerage} is not a bank and does not approve, deny or fund loans. A lender makes those decisions.\n\n## Your information\n\nYou agree to give accurate information and to upload documents that are yours to share. ${brokerage} uses that information to work on your loan file and to contact you about it.\n\n## Messages\n\nBy giving a phone number or email, you agree that ${brokerage} may contact you about your loan, documents and appointments.\n\n## Your portal\n\nThe borrower portal is for you. Do not share your sign-in code. You can ask ${brokerage} to close your access.\n`,
    privacy: `# Privacy policy\n\n${brokerage} collects the contact details, loan information and documents you choose to share so the team can work on your file.\n\n## What is stored\n\nYour name, email, phone, loan details, messages and files you upload stay with ${brokerage}.\n\n## Who can see it\n\nPeople at ${brokerage} who work on your file can see it. ${brokerage} does not sell your personal information.\n\n## How long\n\n${brokerage} keeps your file while your loan is open and for the period the brokerage must retain records. You can ask ${brokerage} what they still hold.\n`,
  };
}

function emailTemplateValues(tenantId: number, name: string, channel: string, draft: EmailDraft | null, plainBody: string): unknown[] {
  return [
    tenantId,
    name,
    channel,
    draft?.subject || null,
    draft?.body || plainBody,
    draft?.greeting || null,
    draft?.headline || null,
    draft?.buttonLabel || null,
    draft?.buttonUrl || null,
    draft ? JSON.stringify(draft.details) : null,
    draft?.footer || null,
  ];
}

async function insertRows(conn: Tx | Db, into: string, rows: unknown[][], tail = "") {
  if (!rows.length || !rows[0]?.length) return;
  const tuple = `(${new Array(rows[0].length).fill("?").join(", ")})`;
  await conn.execute(`${into} VALUES ${rows.map(() => tuple).join(", ")}${tail}`, rows.flat());
}

async function seedTenantEmails(conn: Tx | Db, tenantId: number, name: string) {
  await insertRows(
    conn,
    `INSERT INTO message_templates (tenant_id, name, channel, subject, body, greeting, headline, button_label, button_url, details_json, footer)`,
    tenantEmailStarters(name).map((starter) => emailTemplateValues(tenantId, starter.name, "email", starter.draft, "")),
  );
}

async function seedTenantLegal(conn: Tx | Db, tenantId: number, name: string) {
  const pages = tenantLegalStarter(name);
  await conn.execute(
    `INSERT INTO tenant_legal_pages (tenant_id, code, body_md) VALUES (?, 'terms', ?), (?, 'privacy', ?)`,
    [tenantId, pages.terms, tenantId, pages.privacy],
  );
}

function legalMarkdown(value: unknown): string | null {
  const body = String(value ?? "").replace(/\r\n/g, "\n").trim();
  if (body.length < 1 || body.length > 100_000) return null;
  return body;
}

function normalizeHex(value: unknown): string | null {
  let raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("#")) raw = raw.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(raw)) raw = raw.split("").map((ch) => `${ch}${ch}`).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toUpperCase()}`;
}

function sniffImage(bytes: Buffer): "png" | "jpeg" | "webp" | "ico" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return "ico";
  return null;
}

function readImageUpload(dataUrl: unknown, kind: "logo" | "favicon"): { bytes: Buffer; ext: string; contentType: string } | { error: string } {
  const raw = String(dataUrl || "");
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
  if (!match) return { error: "errors.brand.file" };
  const bytes = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  const detected = sniffImage(bytes);
  const allowed = kind === "favicon" ? new Set(["png", "jpeg", "webp", "ico"]) : new Set(["png", "jpeg", "webp"]);
  if (!detected || !allowed.has(detected)) return { error: kind === "favicon" ? "errors.brand.favicon" : "errors.brand.file" };
  if (bytes.length > (kind === "favicon" ? 512_000 : 1_000_000)) return { error: "errors.brand.large" };
  const contentType = detected === "jpeg" ? "image/jpeg" : detected === "ico" ? "image/x-icon" : `image/${detected}`;
  return { bytes, ext: detected === "jpeg" ? "jpg" : detected, contentType };
}

async function storeBrandFile(tenantId: number, kind: string, file: { bytes: Buffer; ext: string; contentType: string }): Promise<string | null> {
  if (process.env.VITEST === "true") return `https://blob.test/${tenantId}/${kind}.${file.ext}`;
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) return null;
  const blob = await put(`brand/${tenantId}/${kind}.${file.ext}`, file.bytes, {
    access: "public",
    token,
    contentType: file.contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}

function parseBrand(value: unknown): { accent: string; radius: string; headline: string } | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const accent = normalizeHex(source.accent);
  const radius = String(source.radius || "");
  const headline = String(source.headline || "");
  if (!accent) return null;
  if (radius !== "sharp" && radius !== "soft" && radius !== "round") return null;
  if (headline !== "serif" && headline !== "sans" && headline !== "italic") return null;
  return { accent, radius, headline };
}

function slugify(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug || "brokerage";
}

/** The first `{slug}.mortgageprox.com` that no brokerage already has. */
async function nextTenantSlug(name: string, conn: Tx | Db = database()): Promise<string | null> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (candidate.length > 80) return null;
    const taken = await queryRows(`SELECT id FROM tenants WHERE slug = ? LIMIT 1`, [candidate], conn);
    if (!taken.length) return candidate;
  }
  return null;
}

/** Public path segment for one banker. `Maya Chen` becomes `maya-chen`. */
function personSlugBase(firstName: string, lastName: string): string {
  const folded = `${firstName} ${lastName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  if (slugOk(folded)) return folded;
  return "banker";
}

/** A slug this person can own. Pass `current` to skip the link that is being replaced. */
async function takePersonSlug(tenantId: number, userId: number, base: string, current: string | null, conn: Tx | Db = database()): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const candidate = `${base.slice(0, Math.max(1, 48 - suffix.length)).replace(/-+$/g, "")}${suffix}`;
    if (!slugOk(candidate) || candidate === current) continue;
    const taken = await queryRows(
      `SELECT id FROM tenant_users WHERE tenant_id = ? AND public_slug = ? AND id <> ? LIMIT 1`,
      [tenantId, candidate, userId],
      conn,
    );
    if (!taken.length) return candidate;
  }
  const fallback = `${base.slice(0, 39).replace(/-+$/g, "")}-${crypto.randomBytes(3).toString("hex")}`.slice(0, 48);
  return slugOk(fallback) ? fallback : `banker-${crypto.randomBytes(3).toString("hex")}`;
}

/** Keep the person's public slug. Create `first-last` the first time they need a link. */
async function ensurePersonSlug(tenantId: number, userId: number, conn: Tx | Db = database()): Promise<string> {
  for (let round = 0; round < 3; round++) {
    const rows = await queryRows(
      `SELECT first_name, last_name, public_slug FROM tenant_users WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [userId, tenantId],
      conn,
    );
    if (!rows[0]) return "";
    if (rows[0].public_slug) return String(rows[0].public_slug);
    const next = await takePersonSlug(tenantId, userId, personSlugBase(String(rows[0].first_name || ""), String(rows[0].last_name || "")), null, conn);
    try {
      const [result] = await conn.execute(
        `UPDATE tenant_users SET public_slug = ? WHERE id = ? AND tenant_id = ? AND public_slug IS NULL`,
        [next, userId, tenantId],
      );
      if (num((result as { affectedRows?: number }).affectedRows)) return next;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "ER_DUP_ENTRY") throw error;
    }
  }
  const saved = await queryRows(`SELECT public_slug FROM tenant_users WHERE id = ? AND tenant_id = ? LIMIT 1`, [userId, tenantId], conn);
  return saved[0]?.public_slug ? String(saved[0].public_slug) : "";
}

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

async function queryRows(sql: string, params: any[] = [], conn: Tx | Db = database()): Promise<SqlRow[]> {
  const [result] = await conn.execute(sql, params);
  return Array.isArray(result) ? (result as SqlRow[]) : [];
}

function readCookie(req: Request, name: string): string {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq > 0 && trimmed.slice(0, eq) === name) return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return "";
}

async function openBrokerageSession(res: Response, userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  await database().execute(
    `INSERT INTO sessions (actor, user_id, token_hash, expires_at) VALUES ('brokerage', ?, ?, DATE_ADD(NOW(), INTERVAL ${SESSION_DAYS} DAY))`,
    [userId, sha256(token)],
  );
  await database().execute(`UPDATE tenant_users SET last_login_at = NOW() WHERE id = ?`, [userId]);
  setSessionCookie(res, token);
}

function setSessionCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`,
  );
}

function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

type EmailBrand = {
  name: string;
  logoUrl: string | null;
  accent: string;
  radius: "sharp" | "soft" | "round";
  headline: "serif" | "sans" | "italic";
  replyTo: string | null;
};

const PLATFORM_BRAND: EmailBrand = {
  name: APP_NAME,
  logoUrl: null,
  accent: "#2F4FD8",
  radius: "soft",
  headline: "serif",
  replyTo: null,
};

const PLATFORM_EMAIL_CODES = ["sign_in", "workspace_ready", "invite", "transcript"] as const;

function emailEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fillEmail(draft: EmailDraft, vars: Record<string, string>): EmailDraft {
  const apply = (value: string) => value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (token, key: string) => (key in vars ? vars[key] : token));
  return {
    subject: apply(draft.subject).slice(0, 160),
    greeting: apply(draft.greeting).slice(0, 160),
    headline: apply(draft.headline).slice(0, 200),
    body: apply(draft.body).slice(0, 8000),
    buttonLabel: apply(draft.buttonLabel).slice(0, 80),
    buttonUrl: apply(draft.buttonUrl).slice(0, 500),
    details: draft.details.slice(0, 6).map((detail) => ({ label: apply(detail.label).slice(0, 40), value: apply(detail.value).slice(0, 160) })),
    footer: apply(draft.footer).slice(0, 240),
  };
}

function safeHttpUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

function readEmailDetails(value: unknown): EmailDetail[] {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const details: EmailDetail[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const label = clip((item as { label?: unknown }).label, 40);
    const rowValue = clip((item as { value?: unknown }).value, 160);
    if (label && rowValue) details.push({ label, value: rowValue });
    if (details.length === 6) break;
  }
  return details;
}

function platformEmailDefaults(code: string): EmailDraft {
  const bank = "MortgageProx is not a bank and does not approve loans.";
  if (code === "workspace_ready") {
    return {
      subject: "Your office is open",
      greeting: "Hello {{firstName}},",
      headline: "You're in.",
      body: "{{brokerage}} is open. This code is here if you come back on another device. It expires in {{minutes}} minutes.",
      buttonLabel: "Enter your office",
      buttonUrl: "{{appUrl}}",
      details: [{ label: "Address", value: "{{host}}" }, { label: "Code", value: "{{code}}" }],
      footer: bank,
    };
  }
  if (code === "invite") {
    return {
      subject: "You are invited to {{brokerage}}",
      greeting: "Hello {{firstName}},",
      headline: "Your seat is ready.",
      body: "{{inviter}} added you to {{brokerage}}. Use this code to sign in. It expires in {{minutes}} minutes.",
      buttonLabel: "Go to sign in",
      buttonUrl: "{{loginUrl}}",
      details: [{ label: "Office", value: "{{brokerage}}" }, { label: "Code", value: "{{code}}" }],
      footer: "You are receiving this because someone at {{brokerage}} created an account for you.",
    };
  }
  if (code === "transcript") {
    return {
      subject: "Call transcript",
      greeting: "Hello {{firstName}},",
      headline: "The words from the call",
      body: "{{transcript}}",
      buttonLabel: "Open your office",
      buttonUrl: "{{appUrl}}",
      details: [],
      footer: "Sent from MortgageProx for your office.",
    };
  }
  return {
    subject: "Your MortgageProx sign-in code",
    greeting: "Hello,",
    headline: "Your sign-in code",
    body: "Use this code to enter MortgageProx. It expires in {{minutes}} minutes. If you did not ask for this, you can ignore this email.",
    buttonLabel: "Go to sign in",
    buttonUrl: "{{loginUrl}}",
    details: [{ label: "Code", value: "{{code}}" }],
    footer: bank,
  };
}

async function saveMessageTemplate(tenantId: number, id: number, body: unknown): Promise<boolean> {
  if (!tenantId || !id || !body || typeof body !== "object") return false;
  const source = body as Record<string, unknown>;
  const name = clip(source.name, 120);
  const channel = ["sms", "email", "note"].includes(String(source.channel)) ? String(source.channel) : "";
  if (name.length < 2 || !channel) return false;
  const draft = channel === "email" ? parseEmailDraft(source) : null;
  const text = draft?.body || clip(source.body, 4000);
  if (text.length < 2 || (channel === "email" && !draft)) return false;
  const [updated] = await database().execute(
    `UPDATE message_templates
        SET name = ?, channel = ?, subject = ?, body = ?, greeting = ?, headline = ?, button_label = ?, button_url = ?, details_json = ?, footer = ?
      WHERE id = ? AND tenant_id = ?`,
    [name, channel, draft?.subject || clip(source.subject, 160) || null, text, draft?.greeting || null, draft?.headline || null, draft?.buttonLabel || null, draft?.buttonUrl || null, draft ? JSON.stringify(draft.details) : null, draft?.footer || null, id, tenantId],
  );
  return num((updated as { affectedRows?: number }).affectedRows) === 1;
}

function templateItem(row: Record<string, unknown>): TemplateItem {
  return {
    id: num(row.id),
    name: String(row.name),
    channel: String(row.channel),
    subject: row.subject ? String(row.subject) : null,
    body: String(row.body || ""),
    greeting: row.greeting ? String(row.greeting) : null,
    headline: row.headline ? String(row.headline) : null,
    buttonLabel: row.button_label ? String(row.button_label) : null,
    buttonUrl: row.button_url ? String(row.button_url) : null,
    details: readEmailDetails(row.details_json),
    footer: row.footer ? String(row.footer) : null,
  };
}

function emailDraftFromRow(row: Record<string, unknown>, bodyKey: string): EmailDraft {
  return {
    subject: String(row.subject || ""),
    greeting: String(row.greeting || ""),
    headline: String(row.headline || ""),
    body: String(row[bodyKey] || ""),
    buttonLabel: row.button_label ? String(row.button_label) : "",
    buttonUrl: row.button_url ? String(row.button_url) : "",
    details: readEmailDetails(row.details_json),
    footer: String(row.footer || ""),
  };
}

function parseEmailDraft(body: unknown): EmailDraft | null {
  if (!body || typeof body !== "object") return null;
  const source = body as Record<string, unknown>;
  const subject = clip(source.subject, 160);
  const headline = clip(source.headline, 200);
  const text = clip(source.body, 4000);
  if (subject.length < 1 || headline.length < 1 || text.length < 1) return null;
  return {
    subject,
    greeting: clip(source.greeting, 160),
    headline,
    body: text,
    buttonLabel: clip(source.buttonLabel, 80),
    buttonUrl: clip(source.buttonUrl, 500),
    details: readEmailDetails(source.details),
    footer: clip(source.footer, 240),
  };
}

async function loadPlatformEmail(code: string): Promise<EmailDraft> {
  const fallback = platformEmailDefaults(code);
  const rows = await queryRows(
    `SELECT subject, greeting, headline, body_text, button_label, button_url, details_json, footer FROM platform_emails WHERE code = ? LIMIT 1`,
    [code],
  );
  if (!rows[0]) return fallback;
  const draft = emailDraftFromRow(rows[0], "body_text");
  if (!draft.subject || !draft.headline || !draft.body) return fallback;
  return draft;
}

function renderEmail(brand: EmailBrand, draft: EmailDraft): { html: string; text: string } {
  const cardRadius = brand.radius === "sharp" ? "8px" : brand.radius === "round" ? "28px" : "18px";
  const buttonRadius = brand.radius === "sharp" ? "6px" : brand.radius === "round" ? "999px" : "14px";
  const headlineFont = brand.headline === "sans" ? "Inter, Arial, sans-serif" : "Georgia, 'Times New Roman', serif";
  const headlineStyle = brand.headline === "italic" ? "font-style:italic;" : "";
  const logo = safeHttpUrl(brand.logoUrl || "");
  const buttonHref = safeHttpUrl(draft.buttonUrl);
  const mark = logo
    ? `<img src="${emailEscape(logo)}" alt="${emailEscape(brand.name)}" height="36" style="display:block;margin:0 auto 20px;max-width:180px;height:36px;border:0;">`
    : `<p style="margin:0 0 20px;text-align:center;font-family:${headlineFont};${headlineStyle}font-size:22px;color:#0B0F19;">${emailEscape(brand.name)}</p>`;
  const greeting = draft.greeting
    ? `<p style="margin:0 0 8px;text-align:center;font-family:Inter,Arial,sans-serif;font-size:13px;color:#78716C;">${emailEscape(draft.greeting)}</p>`
    : "";
  const button = draft.buttonLabel && buttonHref
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;"><tr><td style="background:${emailEscape(brand.accent)};border-radius:${buttonRadius};"><a href="${emailEscape(buttonHref)}" style="display:inline-block;padding:14px 28px;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${emailEscape(draft.buttonLabel)}</a></td></tr></table>`
    : "";
  const details = draft.details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#ffffff;border:1px solid #E7E5E4;border-radius:${cardRadius};"><tr><td style="padding:8px 20px 16px;">${draft.details.map((detail) => `<p style="margin:16px 0 0;font-family:Inter,Arial,sans-serif;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#78716C;">${emailEscape(detail.label)}</p><p style="margin:4px 0 0;font-family:Inter,Arial,sans-serif;font-size:16px;color:#0B0F19;">${emailEscape(detail.value)}</p>`).join("")}</td></tr></table>`
    : "";
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#F3F1EC;">
    <div style="display:none;max-height:0;overflow:hidden;">${emailEscape(draft.headline)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F1EC;"><tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:28px 8px 8px;">${mark}${greeting}
          <h1 style="margin:0;text-align:center;font-family:${headlineFont};${headlineStyle}font-size:36px;line-height:1.15;font-weight:500;color:#0B0F19;">${emailEscape(draft.headline)}</h1>
          <p style="margin:18px 0 0;font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:#292524;">${emailEscape(draft.body).replace(/\n/g, "<br>")}</p>
          ${button}${details}
          <p style="margin:28px 0 0;text-align:center;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.5;color:#78716C;">${emailEscape(draft.footer)}</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
  const text = [
    draft.greeting,
    draft.headline,
    draft.body,
    draft.buttonLabel && buttonHref ? `${draft.buttonLabel}: ${buttonHref}` : "",
    ...draft.details.map((detail) => `${detail.label}: ${detail.value}`),
    draft.footer,
  ].filter(Boolean).join("\n\n");
  return { html, text };
}

function fromHeader(fromName?: string): string {
  const raw = process.env.SMTP_FROM || "MortgageProx <no-reply@disruptinglabs.com>";
  const match = raw.match(/<([^>]+)>/);
  const email = match?.[1] || "no-reply@disruptinglabs.com";
  const name = (fromName || APP_NAME).replace(/[<>"]/g, "").slice(0, 80) || APP_NAME;
  return `${name} <${email}>`;
}

function appOrigin(req?: Request): string {
  if (req) return publicOrigin(req);
  return (process.env.PUBLIC_APP_URL || "http://localhost:8080").replace(/\/$/, "");
}

async function sendEmail(to: string, subject: string, text: string, options?: { html?: string; replyTo?: string | null; fromName?: string }) {
  const html = options?.html || renderEmail(PLATFORM_BRAND, {
    subject,
    greeting: "",
    headline: subject,
    body: text,
    buttonLabel: "",
    buttonUrl: "",
    details: [],
    footer: `${APP_NAME} is not a bank and does not approve loans.`,
  }).html;
  if (notifySandbox()) {
    outbox.push({ to, subject, text, html });
    return;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("email not configured");
  const resend = new Resend(key);
  const replyTo = options?.replyTo && EMAIL_RE.test(options.replyTo) ? options.replyTo : undefined;
  const result = await resend.emails.send({
    from: fromHeader(options?.fromName),
    to,
    subject,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
  });
  if (result.error) throw new Error(result.error.message);
}

async function tenantBrand(tenantId: number): Promise<EmailBrand> {
  const rows = await queryRows(
    `SELECT name, logo_url, primary_color, brand_radius, brand_headline, support_email FROM tenants WHERE id = ? LIMIT 1`,
    [tenantId],
  );
  const row = rows[0];
  const radius = row?.brand_radius === "sharp" || row?.brand_radius === "round" ? row.brand_radius : "soft";
  const headline = row?.brand_headline === "sans" || row?.brand_headline === "italic" ? row.brand_headline : "serif";
  const accent = normalizeHex(row?.primary_color) || PLATFORM_BRAND.accent;
  return {
    name: row?.name ? String(row.name) : APP_NAME,
    logoUrl: row?.logo_url ? String(row.logo_url) : null,
    accent,
    radius,
    headline,
    replyTo: row?.support_email && EMAIL_RE.test(String(row.support_email)) ? String(row.support_email) : null,
  };
}

function tenantEmailStarters(name: string): Array<{ name: string; draft: EmailDraft }> {
  const brokerage = name.replace(/\s+/g, " ").trim().slice(0, 160) || "This brokerage";
  const footer = `${brokerage} is a mortgage brokerage. ${brokerage} is not a bank and does not approve loans.`;
  return [
    {
      name: "Welcome",
      draft: {
        subject: "Welcome to {{brokerage}}",
        greeting: "Hello {{firstName}},",
        headline: "Welcome. Your file has a home.",
        body: "{{brokerage}} is ready to walk with you. Reply to this email when you want the next step.",
        buttonLabel: "Open your portal",
        buttonUrl: "{{portalUrl}}",
        details: [],
        footer,
      },
    },
    {
      name: "Document request",
      draft: {
        subject: "Documents for your loan",
        greeting: "Hello {{firstName}},",
        headline: "Two documents will move this forward.",
        body: "When you have a moment, send a photo ID and the last two pay stubs. {{officer}} is on the file.",
        buttonLabel: "Upload documents",
        buttonUrl: "{{portalUrl}}",
        details: [{ label: "Needed", value: "Photo ID" }, { label: "Needed", value: "Last two pay stubs" }],
        footer,
      },
    },
    {
      name: "Task assigned",
      draft: {
        subject: "A task is yours",
        greeting: "Hello {{firstName}},",
        headline: "A task is waiting.",
        body: "{{task}}",
        buttonLabel: "Open your tasks",
        buttonUrl: "{{appUrl}}",
        details: [{ label: "From", value: "{{brokerage}}" }],
        footer: `You are receiving this because you have an account with ${brokerage}.`,
      },
    },
    {
      name: "Payment receipt",
      draft: {
        subject: "Payment received",
        greeting: "Hello {{firstName}},",
        headline: "We received your payment.",
        body: "{{brokerage}} recorded this payment on your file.",
        buttonLabel: "View your file",
        buttonUrl: "{{portalUrl}}",
        details: [{ label: "Amount", value: "{{amount}}" }, { label: "Date", value: "{{date}}" }, { label: "Reference", value: "{{reference}}" }],
        footer,
      },
    },
  ];
}

async function findAccount(email: string): Promise<{ actor: Actor; id: number; status: string } | null> {
  const platform = await queryRows(
    `SELECT id, status FROM platform_users WHERE email = ? LIMIT 1`,
    [email],
  );
  if (platform[0]) return { actor: "platform", id: num(platform[0].id), status: String(platform[0].status) };
  const brokerage = await queryRows(
    `SELECT id, status FROM tenant_users WHERE email = ? LIMIT 1`,
    [email],
  );
  if (brokerage[0]) return { actor: "brokerage", id: num(brokerage[0].id), status: String(brokerage[0].status) };
  const borrower = await queryRows(
    `SELECT id, status FROM borrowers WHERE email = ? LIMIT 1`,
    [email],
  );
  if (borrower[0]) return { actor: "borrower", id: num(borrower[0].id), status: String(borrower[0].status) };
  return null;
}

async function issueOtp(actor: Actor, userId: number, email: string, ip: string, kind: "sign_in" | "workspace_ready" | "invite", vars: Record<string, string>, origin: string) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await database().execute(
    `INSERT INTO otp_codes (actor, user_id, code_hash, purpose, expires_at, ip_address)
     VALUES (?, ?, ?, 'login', DATE_ADD(NOW(), INTERVAL ${OTP_TTL_MINUTES} MINUTE), ?)`,
    [actor, userId, sha256(code), ip || null],
  );
  const draft = fillEmail(await loadPlatformEmail(kind), {
    ...vars,
    code,
    minutes: String(OTP_TTL_MINUTES),
    loginUrl: `${origin}/login`,
    appUrl: `${origin}/app`,
    portalUrl: `${origin}/portal`,
    app: APP_NAME,
  });
  const rendered = renderEmail(PLATFORM_BRAND, draft);
  await sendEmail(email, draft.subject, rendered.text, { html: rendered.html });
}

async function loadUser(actor: Actor, userId: number): Promise<AuthUser | null> {
  if (actor === "platform") {
    const rows = await queryRows(
      `SELECT id, email, first_name, last_name, role, status FROM platform_users WHERE id = ? LIMIT 1`,
      [userId],
    );
    const row = rows[0];
    if (!row || row.status !== "active") return null;
    return {
      id: num(row.id),
      email: String(row.email),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      role: String(row.role) as Role,
      actor,
      tenantId: null,
      tenantName: null,
      tenantSlug: null,
      customDomain: null,
      primaryColor: null,
      brandRadius: null,
      brandHeadline: null,
      logoUrl: null,
      faviconUrl: null,
      tenantStatus: null,
      planCode: null,
      trialEndsAt: null,
      startFeeStatus: null,
      modules: [],
    };
  }
  if (actor === "borrower") {
    const rows = await queryRows(
      `SELECT b.id, b.email, b.first_name, b.last_name, b.status, b.tenant_id, t.name AS tenant_name, t.slug AS tenant_slug, t.custom_domain,
              t.primary_color, t.brand_radius, t.brand_headline, t.logo_url, t.favicon_url, t.status AS tenant_status
         FROM borrowers b JOIN tenants t ON t.id = b.tenant_id WHERE b.id = ? LIMIT 1`,
      [userId],
    );
    const row = rows[0];
    if (!row || row.status !== "active") return null;
    return {
      id: num(row.id),
      email: String(row.email),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      role: "borrower",
      actor,
      tenantId: num(row.tenant_id),
      tenantName: String(row.tenant_name),
      tenantSlug: row.tenant_slug ? String(row.tenant_slug) : null,
      customDomain: row.custom_domain ? String(row.custom_domain) : null,
      primaryColor: row.primary_color ? String(row.primary_color) : null,
      brandRadius: row.brand_radius ? String(row.brand_radius) : null,
      brandHeadline: row.brand_headline ? String(row.brand_headline) : null,
      logoUrl: row.logo_url ? String(row.logo_url) : null,
      faviconUrl: row.favicon_url ? String(row.favicon_url) : null,
      tenantStatus: String(row.tenant_status),
    planCode: null,
    trialEndsAt: null,
    startFeeStatus: null,
    modules: ["portal"],
  };
  }
  const rows = await queryRows(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status,
            t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug, t.custom_domain,
            t.primary_color, t.brand_radius, t.brand_headline, t.logo_url, t.favicon_url, t.status AS tenant_status, t.trial_ends_at,
            p.code AS plan_code
       FROM tenant_users u
       JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN plans p ON p.id = t.plan_id
      WHERE u.id = ? LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row || row.status !== "active") return null;
  const modules = await queryRows(
    `SELECT module_code FROM tenant_modules WHERE tenant_id = ? AND enabled = 1 ORDER BY module_code`,
    [num(row.tenant_id)],
  );
  const fees = await queryRows(
    `SELECT start_fee_status FROM tenant_subscriptions WHERE tenant_id = ? LIMIT 1`,
    [num(row.tenant_id)],
  );
  return {
    id: num(row.id),
    email: String(row.email),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    role: String(row.role) as Role,
    actor,
    tenantId: num(row.tenant_id),
    tenantName: String(row.tenant_name),
    tenantSlug: row.tenant_slug ? String(row.tenant_slug) : null,
    customDomain: row.custom_domain ? String(row.custom_domain) : null,
    primaryColor: row.primary_color ? String(row.primary_color) : null,
    brandRadius: row.brand_radius ? String(row.brand_radius) : null,
    brandHeadline: row.brand_headline ? String(row.brand_headline) : null,
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    faviconUrl: row.favicon_url ? String(row.favicon_url) : null,
    tenantStatus: String(row.tenant_status),
    planCode: row.plan_code ? String(row.plan_code) : null,
    trialEndsAt: iso(row.trial_ends_at),
    startFeeStatus: fees[0]?.start_fee_status ? String(fees[0].start_fee_status) : null,
    modules: modules.map((item) => String(item.module_code)),
  };
}

async function sessionUser(req: Request): Promise<AuthUser | null> {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const rows = await queryRows(
    `SELECT actor, user_id FROM sessions
      WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
    [sha256(token)],
  );
  if (!rows[0]) return null;
  return loadUser(String(rows[0].actor) as Actor, num(rows[0].user_id));
}

function trialOver(user: AuthUser): boolean {
  return user.tenantStatus === "trial" && !!user.trialEndsAt && new Date(user.trialEndsAt).getTime() < Date.now();
}

function deny(res: Response, status: number, error: string) {
  res.status(status).json({ error });
  return false;
}

function requirePerm(user: AuthUser, perm: string, res: Response): boolean {
  if (!roleCan(user.role, perm)) return deny(res, 403, "errors.forbidden");
  return true;
}

function requireWritable(user: AuthUser, res: Response): boolean {
  if (user.actor === "brokerage" && user.tenantStatus === "suspended") return deny(res, 403, "errors.suspended");
  if (user.actor === "brokerage" && trialOver(user)) return deny(res, 403, "errors.trialEnded");
  return true;
}

async function logActivity(entry: {
  tenantId?: number | null;
  actorType: string;
  actorId?: number | null;
  action: string;
  summary: string;
}, conn: Tx | Db = database()) {
  await conn.execute(
    `INSERT INTO activity_log (tenant_id, actor_type, actor_id, action, summary) VALUES (?, ?, ?, ?, ?)`,
    [entry.tenantId ?? null, entry.actorType, entry.actorId ?? null, entry.action, entry.summary.slice(0, 255)],
  );
}

function clip(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function catalogSection(id: string): OfficeSectionDef | undefined {
  return OFFICE_CATALOG.find((section) => section.id === id);
}

async function seedTenantOffice(conn: Tx | Db, tenantId: number) {
  await insertRows(
    conn,
    `INSERT INTO tenant_sections (tenant_id, section_id, module_code, custom_label, sort_order, nav_group, is_hidden)`,
    OFFICE_CATALOG.map((section) => [tenantId, section.id, section.module, null, section.sort, section.group, 0]),
    " ON DUPLICATE KEY UPDATE section_id = section_id",
  );
  const roles: unknown[][] = [];
  for (const section of OFFICE_CATALOG) {
    for (const role of BROKER_ROLES) roles.push([tenantId, role, section.id, defaultSectionVisible(role, section.id) ? 1 : 0]);
  }
  await insertRows(
    conn,
    `INSERT INTO tenant_role_sections (tenant_id, role, section_id, is_visible)`,
    roles,
    " ON DUPLICATE KEY UPDATE section_id = section_id",
  );
}

async function ensureOffice(tenantId: number) {
  const rows = await queryRows(`SELECT section_id FROM tenant_sections WHERE tenant_id = ?`, [tenantId]);
  const have = new Set(rows.map((row) => String(row.section_id)));
  if (OFFICE_CATALOG.every((section) => have.has(section.id))) return;
  await seedTenantOffice(database(), tenantId);
}

async function requireBroker(req: Request, res: Response, perm: string, write = false): Promise<AuthUser | null> {
  const user = await sessionUser(req);
  if (!user || user.actor !== "brokerage" || !user.tenantId) {
    deny(res, 401, "errors.unauthorized");
    return null;
  }
  if (!requirePerm(user, perm, res)) return null;
  if (write && !requireWritable(user, res)) return null;
  return user;
}

async function requireModule(user: AuthUser, code: string, res: Response): Promise<boolean> {
  const rows = await queryRows(
    `SELECT 1 AS ok FROM tenant_modules WHERE tenant_id = ? AND module_code = ? AND enabled = 1 LIMIT 1`,
    [user.tenantId, code],
  );
  if (!rows.length) return deny(res, 403, "errors.forbidden");
  return true;
}

function parseMenu(body: unknown): {
  sections: Array<{ id: string; customLabel: string | null; hidden: boolean; sort: number }>;
  roles: Array<{ role: string; sectionId: string; visible: boolean }>;
} | null {
  if (!body || typeof body !== "object") return null;
  const source = body as Record<string, unknown>;
  if (!Array.isArray(source.sections) || !Array.isArray(source.roles)) return null;
  const sections = [];
  for (const raw of source.sections) {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const id = String(row.id || "");
    if (!catalogSection(id)) return null;
    const sort = Math.floor(Number(row.sort));
    if (!Number.isFinite(sort) || sort < 0 || sort > 10000) return null;
    const label = clip(row.customLabel, 80);
    sections.push({ id, customLabel: label || null, hidden: Boolean(row.hidden), sort });
  }
  const roles = [];
  for (const raw of source.roles) {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const role = String(row.role || "");
    const sectionId = String(row.sectionId || "");
    if (!BROKER_ROLES.includes(role) || !catalogSection(sectionId)) return null;
    roles.push({ role, sectionId, visible: Boolean(row.visible) });
  }
  return { sections, roles };
}

async function saveOfficeMenu(tenantId: number, body: unknown): Promise<boolean> {
  const menu = parseMenu(body);
  if (!menu) return false;
  await ensureOffice(tenantId);
  for (const section of menu.sections) {
    await database().execute(
      `UPDATE tenant_sections SET custom_label = ?, is_hidden = ?, sort_order = ? WHERE tenant_id = ? AND section_id = ?`,
      [section.customLabel, section.hidden ? 1 : 0, section.sort, tenantId, section.id],
    );
  }
  for (const role of menu.roles) {
    await database().execute(
      `UPDATE tenant_role_sections SET is_visible = ? WHERE tenant_id = ? AND role = ? AND section_id = ?`,
      [role.visible ? 1 : 0, tenantId, role.role, role.sectionId],
    );
  }
  return true;
}

async function loadMenu(tenantId: number, modules: string[]): Promise<{ sections: OfficeMenuSection[]; roles: OfficeMenuRole[] }> {
  await ensureOffice(tenantId);
  const sections = await queryRows(
    `SELECT section_id, module_code, custom_label, sort_order, nav_group, is_hidden FROM tenant_sections WHERE tenant_id = ? ORDER BY sort_order, section_id`,
    [tenantId],
  );
  const roles = await queryRows(`SELECT role, section_id, is_visible FROM tenant_role_sections WHERE tenant_id = ?`, [tenantId]);
  return {
    sections: sections.map((row): OfficeMenuSection => {
      const def = catalogSection(String(row.section_id));
      return {
        id: String(row.section_id),
        module: String(row.module_code),
        group: String(row.nav_group) as OfficeGroup,
        sort: num(row.sort_order),
        labelKey: def?.labelKey || "app.dashboard",
        customLabel: row.custom_label ? String(row.custom_label) : null,
        hidden: num(row.is_hidden) === 1,
        entitled: modules.includes(String(row.module_code)),
      };
    }),
    roles: roles.map((row): OfficeMenuRole => ({
      role: String(row.role),
      sectionId: String(row.section_id),
      visible: num(row.is_visible) === 1,
    })),
  };
}

/** US numbers become +1 and ten digits. Anything else is refused. */
function toE164(value: unknown): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * The same order the other offices use. A blocked caller stops.
 * Otherwise the desk rings, then the cell, then voicemail.
 * An empty plan ends the call instead of ringing forever.
 */
function ringPlan(input: {
  blocked: boolean;
  browser: boolean;
  forwardingPhone: string | null;
  voicemail: boolean;
}): RingStep[] {
  if (input.blocked) return ["blocked"];
  const steps: RingStep[] = [];
  if (input.browser) steps.push("browser");
  if (input.forwardingPhone) steps.push("forward");
  if (input.voicemail) steps.push("voicemail");
  if (!steps.length) steps.push("ended");
  return steps;
}

async function twilioReady(tenantId: number): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return false;
  const rows = await queryRows(
    `SELECT 1 AS ok FROM tenant_addons WHERE tenant_id = ? AND addon_code = 'twilio' AND enabled = 1 LIMIT 1`,
    [tenantId],
  );
  return rows.length > 0;
}

type TwilioSend = { ok: true; sid: string } | { ok: false; error: string };

async function twilioPost(path: string, fields: Record<string, string>): Promise<TwilioSend> {
  if (notifySandbox()) return { ok: true, sid: "sandbox" };
  const account = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!account || !token) return { ok: false, error: "errors.twilio" };
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(account)}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${account}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
  });
  const payload = await response.json().catch(() => ({})) as { sid?: string; message?: string };
  if (!response.ok) {
    console.error("[twilio]", payload.message || response.status);
    return { ok: false, error: "errors.twilio" };
  }
  return { ok: true, sid: String(payload.sid || "") };
}

async function officeLine(tenantId: number): Promise<string | null> {
  const rows = await queryRows(
    `SELECT e164 FROM phone_lines WHERE tenant_id = ? AND is_active = 1 ORDER BY is_primary DESC, id ASC LIMIT 1`,
    [tenantId],
  );
  return toE164(rows[0]?.e164);
}

async function partyPhone(tenantId: number, clientId: number, contactId: number): Promise<string | null> {
  if (clientId) {
    const rows = await queryRows(`SELECT phone FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1`, [clientId, tenantId]);
    const phone = toE164(rows[0]?.phone);
    if (phone) return phone;
  }
  if (contactId) {
    const rows = await queryRows(`SELECT phone FROM contacts WHERE id = ? AND tenant_id = ? LIMIT 1`, [contactId, tenantId]);
    return toE164(rows[0]?.phone);
  }
  return null;
}

async function numberBlocked(tenantId: number, e164: string, kind: "calls" | "texts"): Promise<boolean> {
  const column = kind === "calls" ? "block_calls" : "block_texts";
  const rows = await queryRows(
    `SELECT 1 AS ok FROM blocked_numbers WHERE tenant_id = ? AND e164 = ? AND ${column} = 1 LIMIT 1`,
    [tenantId, e164],
  );
  return rows.length > 0;
}

async function sendTwilioMessage(tenantId: number, to: string, body: string): Promise<TwilioSend> {
  if (!(await twilioReady(tenantId))) return { ok: false, error: "errors.twilio" };
  const line = await officeLine(tenantId);
  if (!line) return { ok: false, error: "errors.call.line" };
  if (await numberBlocked(tenantId, to, "texts")) return { ok: false, error: "errors.call.blocked" };
  return twilioPost("/Messages.json", { From: line, To: to, Body: body });
}

async function placeTwilioCall(tenantId: number, userId: number, to: string): Promise<TwilioSend> {
  if (!(await twilioReady(tenantId))) return { ok: false, error: "errors.twilio" };
  const line = await officeLine(tenantId);
  if (!line) return { ok: false, error: "errors.call.line" };
  const staff = toE164(await forwardingNumber(tenantId, userId));
  if (!staff) return { ok: false, error: "errors.call.forward" };
  if (await numberBlocked(tenantId, to, "calls")) return { ok: false, error: "errors.call.blocked" };
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Connecting your call.</Say><Dial callerId="${xmlEscape(line)}">${xmlEscape(to)}</Dial></Response>`;
  return twilioPost("/Calls.json", { From: line, To: staff, Twiml: twiml });
}

async function tenantModules(tenantId: number): Promise<string[]> {
  const rows = await queryRows(`SELECT module_code FROM tenant_modules WHERE tenant_id = ? AND enabled = 1`, [tenantId]);
  return rows.map((row) => String(row.module_code));
}

async function deliverMessage(
  user: AuthUser,
  channel: string,
  body: string,
  subject: string,
  contactId: number,
  clientId: number,
  options?: { placeCall?: boolean },
): Promise<{ messageStatus: string; error?: string; status: number; notice?: string }> {
  if (channel === "note") return { messageStatus: "sent", status: 200 };
  if (channel === "call") {
    if (!options?.placeCall) return { messageStatus: "sent", status: 200, notice: "app.callLogged" };
    if (!user.tenantId) return { messageStatus: "failed", error: "errors.twilio", status: 409 };
    const to = await partyPhone(user.tenantId, clientId, contactId);
    if (!to) return { messageStatus: "failed", error: "validation.phone", status: 400 };
    const placed = await placeTwilioCall(user.tenantId, user.id, to);
    if ("error" in placed) return { messageStatus: "failed", error: placed.error, status: placed.error.startsWith("validation.") ? 400 : 409 };
    return { messageStatus: "sent", status: 200, notice: "app.callPlaced" };
  }
  if (channel === "email") {
    if (!user.modules.includes("email")) return { messageStatus: "failed", error: "errors.forbidden", status: 403 };
    let email = "";
    if (clientId && user.tenantId) {
      const rows = await queryRows(`SELECT email FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1`, [clientId, user.tenantId]);
      email = String(rows[0]?.email || "");
    }
    if (!email && contactId && user.tenantId) {
      const rows = await queryRows(`SELECT email FROM contacts WHERE id = ? AND tenant_id = ? LIMIT 1`, [contactId, user.tenantId]);
      email = String(rows[0]?.email || "");
    }
    if (!EMAIL_RE.test(email)) return { messageStatus: "failed", error: "validation.email", status: 400 };
    const brand = user.tenantId ? await tenantBrand(user.tenantId) : PLATFORM_BRAND;
    const draft = fillEmail({
      subject: subject || brand.name,
      greeting: "Hello,",
      headline: subject || brand.name,
      body,
      buttonLabel: "",
      buttonUrl: "",
      details: [],
      footer: `${brand.name} is a mortgage brokerage. ${brand.name} is not a bank and does not approve loans.`,
    }, { brokerage: brand.name, firstName: user.firstName });
    const rendered = renderEmail(brand, draft);
    await sendEmail(email, draft.subject, rendered.text, { html: rendered.html, replyTo: brand.replyTo, fromName: brand.name });
    return { messageStatus: "sent", status: 200, notice: "app.emailSent" };
  }
  if (channel === "sms") {
    if (!user.tenantId) return { messageStatus: "failed", error: "errors.twilio", status: 409 };
    const to = await partyPhone(user.tenantId, clientId, contactId);
    if (!to) return { messageStatus: "failed", error: "validation.phone", status: 400 };
    const sent = await sendTwilioMessage(user.tenantId, to, body);
    if ("error" in sent) return { messageStatus: "failed", error: sent.error, status: sent.error.startsWith("validation.") ? 400 : 409 };
    return { messageStatus: "sent", status: 200, notice: "app.textSent" };
  }
  return { messageStatus: "failed", error: "validation.wizard", status: 400 };
}

async function callMeta(
  tenantId: number,
  userId: number,
  channel: string,
  body: Record<string, unknown> | undefined,
): Promise<{ outcome: string | null; forwardedTo: string | null; duration: number | null; error?: string }> {
  if (channel !== "call") return { outcome: null, forwardedTo: null, duration: null };
  const outcome = CALL_OUTCOMES.includes(String(body?.outcome) as (typeof CALL_OUTCOMES)[number]) ? String(body?.outcome) : null;
  const rawDuration = body?.durationSec;
  let duration: number | null = null;
  if (rawDuration != null && rawDuration !== "") {
    duration = Math.floor(Number(rawDuration));
    if (!Number.isFinite(duration) || duration < 0 || duration > 86_400) return { outcome, forwardedTo: null, duration: null, error: "validation.wizard" };
  }
  if (outcome !== "forwarded") return { outcome, forwardedTo: null, duration };
  const forwardedTo = toE164(body?.forwardedTo) || await forwardingNumber(tenantId, userId);
  if (!forwardedTo) return { outcome, forwardedTo: null, duration, error: "validation.phone" };
  return { outcome, forwardedTo, duration };
}

async function forwardingNumber(tenantId: number, userId: number): Promise<string | null> {
  const rows = await queryRows(
    `SELECT forwarding_phone FROM user_phone_settings WHERE tenant_id = ? AND user_id = ? AND forwarding_enabled = 1 LIMIT 1`,
    [tenantId, userId],
  );
  return rows[0]?.forwarding_phone ? String(rows[0].forwarding_phone) : null;
}

async function transcriptMeta(
  tenantId: number,
  userId: number,
  channel: string,
  raw: unknown,
): Promise<{ transcript: string | null; emailed: boolean; error?: string }> {
  const transcript = clip(raw, 8000);
  if (!transcript) return { transcript: null, emailed: false };
  if (channel !== "call") return { transcript: null, emailed: false, error: "validation.wizard" };
  const mods = await tenantModules(tenantId);
  if (!mods.includes("transcripts")) return { transcript: null, emailed: false, error: "errors.forbidden" };
  const people = await queryRows(
    `SELECT email, first_name FROM tenant_users WHERE id = ? AND tenant_id = ? AND status = 'active' LIMIT 1`,
    [userId, tenantId],
  );
  const email = normalizeEmail(people[0]?.email);
  let emailed = false;
  if (EMAIL_RE.test(email)) {
    const origin = appOrigin();
    const draft = fillEmail(await loadPlatformEmail("transcript"), {
      firstName: people[0]?.first_name ? String(people[0].first_name) : "",
      transcript,
      appUrl: `${origin}/app`,
    });
    const rendered = renderEmail(PLATFORM_BRAND, draft);
    await sendEmail(email, draft.subject, rendered.text, { html: rendered.html });
    emailed = true;
  }
  return { transcript, emailed };
}

async function writeMessage(
  tenantId: number,
  threadId: number,
  direction: "in" | "out",
  channel: string,
  body: string,
  status: string,
  createdBy: number,
  meta: { outcome: string | null; forwardedTo: string | null; duration: number | null; transcript: string | null; emailed: boolean },
): Promise<void> {
  await database().execute(
    `INSERT INTO conversation_messages
      (tenant_id, thread_id, direction, channel, body, status, call_outcome, forwarded_to, duration_sec, transcript, transcript_emailed_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 1, NOW(), NULL), ?)`,
    [tenantId, threadId, direction, channel, body, status, meta.outcome, meta.forwardedTo, meta.duration, meta.transcript, meta.emailed ? 1 : 0, createdBy],
  );
}

function mapMessage(item: Record<string, unknown>): ThreadMessage {
  return {
    id: num(item.id),
    direction: String(item.direction),
    channel: String(item.channel),
    body: String(item.body),
    status: String(item.status),
    callOutcome: item.call_outcome == null ? null : String(item.call_outcome),
    forwardedTo: item.forwarded_to == null ? null : String(item.forwarded_to),
    durationSec: item.duration_sec == null ? null : num(item.duration_sec),
    transcript: item.transcript == null ? null : String(item.transcript),
    createdAt: iso(item.created_at) || "",
  };
}

function microsoftReady(): { clientId: string; clientSecret: string } | null {
  const clientId = String(process.env.MICROSOFT_CLIENT_ID || process.env.OFFICE365_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.MICROSOFT_CLIENT_SECRET || process.env.OFFICE365_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function microsoftRedirect(req: Request): string {
  if (process.env.MICROSOFT_REDIRECT_URI) return process.env.MICROSOFT_REDIRECT_URI;
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:8081");
  return `${proto}://${host}/api/public/microsoft/callback`;
}

function signState(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", process.env.JWT_SECRET || "dev").update(body).digest("base64url");
  return `${body}.${sig}`;
}

function readState(state: string): Record<string, unknown> | null {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) return null;
  const expect = crypto.createHmac("sha256", process.env.JWT_SECRET || "dev").update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expect);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Microsoft account picker. Work and personal accounts both use the common endpoint. */
function microsoftAuthUrl(clientId: string, redirectUri: string, state: string, loginHint: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: MICROSOFT_SCOPES,
    state,
    prompt: "login",
    login_hint: loginHint,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

async function insertCredit(tenantId: number, body: Record<string, unknown> | undefined, borrowerId: number | null): Promise<{ id: number; error?: string; status: number }> {
  const summary = clip(body?.summary, 4000);
  const bands = ["unknown", "excellent", "good", "fair", "poor"];
  const scoreBand = bands.includes(String(body?.scoreBand)) ? String(body?.scoreBand) : "unknown";
  const clientId = Math.floor(Number(body?.clientId) || 0);
  if (summary.length < 2) return { id: 0, error: "validation.wizard", status: 400 };
  if (clientId) {
    const owned = await queryRows(`SELECT id FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1`, [clientId, tenantId]);
    if (!owned[0]) return { id: 0, error: "errors.notFound", status: 404 };
  }
  const loanId = Math.floor(Number(body?.loanId) || 0);
  if (loanId) {
    const owned = await queryRows(`SELECT id FROM loans WHERE id = ? AND tenant_id = ? LIMIT 1`, [loanId, tenantId]);
    if (!owned[0]) return { id: 0, error: "errors.notFound", status: 404 };
  }
  let fileName: string | null = null;
  let fileType: string | null = null;
  let fileData: Buffer | null = null;
  const raw = String(body?.fileBase64 || "");
  if (raw) {
    const payload = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    fileData = Buffer.from(payload, "base64");
    if (!fileData.length || fileData.length > 500_000) return { id: 0, error: "validation.wizard", status: 400 };
    fileName = clip(body?.fileName, 180) || "summary";
    fileType = clip(body?.fileType, 80) || "application/octet-stream";
  }
  const [inserted] = await database().execute(
    `INSERT INTO credit_analyses (tenant_id, client_id, borrower_id, loan_id, file_name, file_type, file_data, summary, score_band, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded')`,
    [tenantId, clientId || null, borrowerId, loanId || null, fileName, fileType, fileData, summary, scoreBand],
  );
  return { id: num((inserted as { insertId?: number }).insertId), status: 201 };
}

type AllowanceCaps = Record<AllowanceKey, number | null>;

type BillingRow = {
  planId: number;
  planCode: string | null;
  priceCents: number;
  quoted: boolean;
  trialEndsAt: string | null;
  startFeeCents: number;
  startFeeStatus: string;
  customerId: string | null;
  subscriptionId: string | null;
  checkoutSessionId: string | null;
  priceId: string | null;
  includedSeats: number;
  extraSeats: number;
  caps: AllowanceCaps;
};

const METER_KEYS: AllowanceKey[] = ["seats", "loans", "emails", "letters", "sms", "voice"];

/** Null is no cap. Zero is not included. A quote is settled with the brokerage, not a meter. */
function meterState(used: number, included: number | null, quoted: boolean): AllowanceState {
  if (quoted) return "quote";
  if (included == null) return "open";
  if (included <= 0) return "off";
  if (used >= included) return "full";
  if (used * 5 >= included * 4) return "watch";
  return "ok";
}

function allowanceDecision(used: number, included: number | null, add: number, quoted: boolean): string | null {
  if (quoted || included == null) return null;
  if (included <= 0) return "errors.billing.notIncluded";
  if (used + Math.max(0, add) > included) return "errors.billing.allowance";
  return null;
}

function seatChange(input: { used: number; included: number; extra: number; action: "add" | "remove"; quoted: boolean }): { extra: number } | { error: string } {
  if (input.quoted || input.included <= 0) return { error: "errors.billing.notIncluded" };
  if (input.action === "add") return { extra: input.extra + 1 };
  if (input.extra <= 0) return { error: "errors.billing.noExtraSeat" };
  if (input.used > input.included + input.extra - 1) return { error: "errors.billing.seatInUse" };
  return { extra: input.extra - 1 };
}

function campaignIncluded(planCode: string | null, stored: number | null): number {
  if (stored != null && stored > 0) return stored;
  if (planCode === "scale" || planCode === "custom") return CAMPAIGN_INCLUDED;
  return 0;
}

function campaignRoom(input: {
  used: number;
  included: number;
  packs: number;
  adding: number;
  platformUsed: number;
  platformAdding: number;
  ceiling: number;
  confirmPacks: number | null;
  priceCents: number;
}): { ok: true; packsToBuy: number; allowance: number } | { error: string; packs?: number; priceCents?: number } {
  const used = Math.max(0, Math.floor(input.used));
  const included = Math.max(0, Math.floor(input.included));
  const packs = Math.max(0, Math.floor(input.packs));
  const adding = Math.max(0, Math.floor(input.adding));
  const ceiling = Math.max(0, Math.floor(input.ceiling));
  const platformUsed = Math.max(0, Math.floor(input.platformUsed));
  const platformAdding = Math.max(0, Math.floor(input.platformAdding));
  const price = Math.max(0, Math.floor(input.priceCents));
  if (included <= 0) return { error: "errors.billing.notIncluded" };
  if (platformUsed + platformAdding > ceiling) return { error: "errors.campaigns.capacity" };
  const allowance = included + packs * CAMPAIGN_PACK_SIZE;
  const short = Math.max(0, used + adding - allowance);
  const packsToBuy = short === 0 ? 0 : Math.ceil(short / CAMPAIGN_PACK_SIZE);
  if (packsToBuy === 0 || input.confirmPacks === packsToBuy) {
    return { ok: true, packsToBuy, allowance: allowance + packsToBuy * CAMPAIGN_PACK_SIZE };
  }
  return { error: "errors.campaigns.pack", packs: packsToBuy, priceCents: packsToBuy * price };
}

function campaignPackChange(input: { used: number; included: number; packs: number; action: "add" | "remove" }): { packs: number } | { error: string } {
  const packs = Math.max(0, Math.floor(input.packs));
  const included = Math.max(0, Math.floor(input.included));
  const used = Math.max(0, Math.floor(input.used));
  if (included <= 0) return { error: "errors.billing.notIncluded" };
  if (input.action === "add") return { packs: packs + 1 };
  if (packs <= 0) return { error: "errors.campaigns.noPack" };
  if (used > included + (packs - 1) * CAMPAIGN_PACK_SIZE) return { error: "errors.campaigns.packInUse" };
  return { packs: packs - 1 };
}

function campaignHtml(body: string): string {
  const safe = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<p>${safe}</p><p><a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p>`;
}

function verifyResendWebhook(raw: string, headers: { id: string; timestamp: string; signature: string }, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const ts = Number(headers.timestamp);
  if (!headers.id || !Number.isFinite(ts) || Math.abs(nowSec - ts) > 300) return false;
  const trimmed = secret.trim();
  if (!trimmed) return false;
  const key = Buffer.from(trimmed.replace(/^whsec_/, ""), "base64");
  if (!key.length) return false;
  const signed = crypto.createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${raw}`).digest("base64");
  return headers.signature.split(" ").some((part) => {
    const value = part.startsWith("v1,") ? part.slice(3) : "";
    if (!value || value.length !== signed.length) return false;
    return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(signed));
  });
}

function packApplies(meter: string, included: number | null, quoted: boolean): boolean {
  if (quoted || included == null || included <= 0) return false;
  return meter === "emails" || meter === "letters" || meter === "loans";
}

function sameMonth(value: unknown, monthStart: string): boolean {
  if (!value) return false;
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return text === monthStart.slice(0, 10);
}

function smsSegments(body: string): number {
  const text = body.trim();
  if (!text) return 1;
  const unicode = /[^\u0000-\u007F]/.test(text);
  const size = unicode ? 70 : 160;
  return Math.max(1, Math.ceil([...text].length / size));
}

function voiceMinutes(durationSec: number | null): number {
  if (!durationSec || durationSec <= 0) return 1;
  return Math.ceil(durationSec / 60);
}

function utcMonthStart(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}-01 00:00:00`;
}

function outboundUnits(channel: string, body: string, durationSec: number | null): { key: "emails" | "sms" | "voice"; add: number } | null {
  if (channel === "email") return { key: "emails", add: 1 };
  if (channel === "sms") return { key: "sms", add: smsSegments(body) };
  if (channel === "call") return { key: "voice", add: voiceMinutes(durationSec) };
  return null;
}

let stripeSingleton: Stripe | null = null;

function stripeOrNull(): Stripe | null {
  if (process.env.VITEST === "true") return null;
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return null;
  if (!stripeSingleton) stripeSingleton = new Stripe(key);
  return stripeSingleton;
}

function stripePublishableKey(): string | null {
  const key = String(process.env.STRIPE_PUBLISHABLE_KEY || "").trim();
  return key.startsWith("pk_") ? key : null;
}

function publicUrl(value: unknown): string | null {
  const raw = String(value || "").trim().slice(0, 240);
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().slice(0, 240);
  } catch {
    return null;
  }
}

function publicOrigin(req: Request): string {
  const origin = String(req.headers.origin || "");
  if (/^https?:\/\/[a-z0-9.:-]+$/i.test(origin)) return origin.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  let host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:8080").split(",")[0].trim();
  // Vite proxies /api to :8081 and rewrites Host. Share links and emails must stay on the app.
  if (host === "localhost:8081" || host === "127.0.0.1:8081" || host === "[::1]:8081") host = "localhost:8080";
  return `${proto}://${host}`;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

function trialEndUnix(isoValue: string | null): number | undefined {
  if (!isoValue) return undefined;
  const unix = Math.floor(new Date(isoValue).getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(unix) || unix < now + 120) return undefined;
  return Math.max(unix, now + 48 * 3600 + 60);
}

async function loadBillingRow(tenantId: number): Promise<BillingRow | null> {
  const rows = await queryRows(
    `SELECT p.id AS plan_id, p.code AS plan_code, p.price_cents, p.is_quote, p.seat_limit,
            p.included_loans, p.included_emails, p.included_letters, p.included_sms, p.included_voice_minutes,
            p.stripe_price_id, s.extra_seats, s.trial_ends_at, s.start_fee_cents, s.start_fee_status,
            s.stripe_customer_id, s.stripe_subscription_id, s.stripe_checkout_session_id
       FROM tenant_subscriptions s
       JOIN plans p ON p.id = s.plan_id
      WHERE s.tenant_id = ? LIMIT 1`,
    [tenantId],
  );
  const row = rows[0];
  if (!row) return null;
  const quoted = Boolean(row.is_quote);
  const includedSeats = num(row.seat_limit);
  const extraSeats = num(row.extra_seats);
  const month = utcMonthStart();
  const grants = await queryRows(`SELECT meter, units, period_start FROM tenant_usage_grants WHERE tenant_id = ?`, [tenantId]);
  const bonus = (meter: "emails" | "letters" | "loans") => grants.reduce((sum, grant) => {
    if (String(grant.meter) !== meter) return sum;
    if (meter === "loans") return grant.period_start == null ? sum + num(grant.units) : sum;
    return sameMonth(grant.period_start, month) ? sum + num(grant.units) : sum;
  }, 0);
  const lifted = (base: number | null, add: number) => (base == null ? null : base + add);
  return {
    planId: num(row.plan_id),
    planCode: row.plan_code ? String(row.plan_code) : null,
    priceCents: num(row.price_cents),
    quoted,
    trialEndsAt: iso(row.trial_ends_at),
    startFeeCents: num(row.start_fee_cents),
    startFeeStatus: row.start_fee_status ? String(row.start_fee_status) : "none",
    customerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
    subscriptionId: row.stripe_subscription_id ? String(row.stripe_subscription_id) : null,
    checkoutSessionId: row.stripe_checkout_session_id ? String(row.stripe_checkout_session_id) : null,
    priceId: row.stripe_price_id ? String(row.stripe_price_id) : null,
    includedSeats,
    extraSeats,
    caps: {
      seats: quoted || includedSeats <= 0 ? null : includedSeats + extraSeats,
      loans: quoted ? null : lifted(optionalNum(row.included_loans), bonus("loans")),
      emails: quoted ? null : lifted(optionalNum(row.included_emails), bonus("emails")),
      letters: quoted ? null : lifted(optionalNum(row.included_letters), bonus("letters")),
      sms: quoted ? null : optionalNum(row.included_sms),
      voice: quoted ? null : optionalNum(row.included_voice_minutes),
    },
  };
}

async function usageCounts(tenantId: number): Promise<Record<AllowanceKey, number>> {
  const start = utcMonthStart();
  const rows = await queryRows(
    `SELECT
       (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = ? AND status = 'active') AS seats,
       (SELECT COUNT(*) FROM loans WHERE tenant_id = ? AND status = 'open') AS loans,
       (SELECT COUNT(*) FROM conversation_messages WHERE tenant_id = ? AND direction = 'out' AND channel = 'email' AND status <> 'failed' AND created_at >= ?) AS emails,
       (SELECT COALESCE(SUM(GREATEST(1, CEILING(CHAR_LENGTH(body) / 160))), 0) FROM conversation_messages WHERE tenant_id = ? AND direction = 'out' AND channel = 'sms' AND status <> 'failed' AND created_at >= ?) AS sms,
       (SELECT COALESCE(SUM(CASE WHEN duration_sec IS NULL OR duration_sec < 1 THEN 1 ELSE CEILING(duration_sec / 60) END), 0) FROM conversation_messages WHERE tenant_id = ? AND direction = 'out' AND channel = 'call' AND created_at >= ?) AS voice,
       (SELECT COALESCE(SUM(sent_count), 0) FROM broadcasts WHERE tenant_id = ? AND channel = 'email' AND created_at >= ?) AS broadcast_emails,
       (SELECT COALESCE(SUM(sent_count * GREATEST(1, CEILING(CHAR_LENGTH(body) / 160))), 0) FROM broadcasts WHERE tenant_id = ? AND channel = 'sms' AND created_at >= ?) AS broadcast_sms`,
    [tenantId, tenantId, tenantId, start, tenantId, start, tenantId, start, tenantId, start, tenantId, start],
  );
  const row = rows[0] || {};
  return {
    seats: num(row.seats),
    loans: num(row.loans),
    emails: num(row.emails) + num(row.broadcast_emails),
    letters: 0,
    sms: num(row.sms) + num(row.broadcast_sms),
    voice: num(row.voice),
  };
}

const MCP_TOOLS = [
  {
    name: "list_loans",
    description: "Loans for this brokerage. Read only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["open", "funded", "archived"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "get_loan",
    description: "One loan, with the client name and stage. Read only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "integer", minimum: 1 } },
    },
  },
  {
    name: "list_clients",
    description: "Clients and leads for this brokerage. Read only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["lead", "active", "archived"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "get_client",
    description: "One client. Read only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "integer", minimum: 1 } },
    },
  },
  {
    name: "list_tasks",
    description: "Tasks for this brokerage when the task board is on. Read only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        loanId: { type: "integer", minimum: 1 },
        status: { type: "string", enum: ["open", "done"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
] as const;

const MCP_TOOL_NAMES = new Set<string>(MCP_TOOLS.map((tool) => tool.name));

type McpDecision =
  | { kind: "result"; result: unknown }
  | { kind: "notify" }
  | { kind: "call"; name: string; args: Record<string, unknown> }
  | { kind: "error"; code: number; message: string };

function mcpDecision(method: string, params: Record<string, unknown>): McpDecision {
  if (method === "initialize") {
    const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : MCP_PROTOCOL;
    const protocolVersion = requested === "2024-11-05" || requested === "2025-06-18" ? requested : MCP_PROTOCOL;
    return {
      kind: "result",
      result: {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: APP_NAME, version: "1.0.0" },
        instructions: "Read only. Pipeline, clients and tasks. Each successful tool call is 3 cents. Writes are not available.",
      },
    };
  }
  if (method.startsWith("notifications/")) return { kind: "notify" };
  if (method === "ping" || method === "resources/list" || method === "prompts/list") {
    return { kind: "result", result: method === "ping" ? {} : method === "resources/list" ? { resources: [] } : { prompts: [] } };
  }
  if (method === "tools/list") return { kind: "result", result: { tools: MCP_TOOLS } };
  if (method === "tools/call") {
    const name = typeof params.name === "string" ? params.name : "";
    const args = params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
      ? params.arguments as Record<string, unknown>
      : {};
    if (!MCP_TOOL_NAMES.has(name)) return { kind: "error", code: -32602, message: "Unknown tool" };
    return { kind: "call", name, args };
  }
  return { kind: "error", code: -32601, message: "Method not found" };
}

function readMcpMessage(body: unknown): { id: string | number | null; method: string; params: Record<string, unknown> } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  if (row.jsonrpc !== "2.0" || typeof row.method !== "string" || !row.method) return null;
  let id: string | number | null = null;
  if (row.id !== undefined) {
    if (typeof row.id !== "string" && typeof row.id !== "number") return null;
    id = row.id;
  }
  const params = row.params && typeof row.params === "object" && !Array.isArray(row.params) ? row.params as Record<string, unknown> : {};
  return { id, method: row.method, params };
}

function mcpToolContent(data: unknown, isError = false) {
  return { content: [{ type: "text", text: isError ? String(data) : JSON.stringify(data) }], isError };
}

function mcpLimit(value: unknown): number | null {
  if (value == null || value === "") return 20;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) return null;
  return parsed;
}

function mcpRecordId(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function mcpChoice(value: unknown, allowed: readonly string[]): string | null | "bad" {
  if (value == null || value === "") return null;
  const status = String(value).trim().toLowerCase();
  return allowed.includes(status) ? status : "bad";
}

function mcpDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mintMcpToken(): { token: string; hash: string; prefix: string } {
  const token = `mp_mcp_${crypto.randomBytes(24).toString("base64url")}`;
  return { token, hash: sha256(token), prefix: token.slice(0, 12) };
}

async function syncMcpInvoice(tenantId: number): Promise<void> {
  const stripe = stripeOrNull();
  if (!stripe) return;
  const sub = await queryRows(`SELECT stripe_customer_id FROM tenant_subscriptions WHERE tenant_id = ? LIMIT 1`, [tenantId]);
  const customer = sub[0]?.stripe_customer_id ? String(sub[0].stripe_customer_id) : "";
  if (!customer) return;
  const conn = await database().getConnection();
  let ids: number[] = [];
  try {
    await conn.beginTransaction();
    const pending = await queryRows(
      `SELECT id FROM mcp_calls WHERE tenant_id = ? AND invoiced = 0 ORDER BY id ASC LIMIT 200 FOR UPDATE`,
      [tenantId],
      conn,
    );
    ids = pending.map((row) => num(row.id)).filter((id) => id > 0);
    if (!ids.length) {
      await conn.commit();
      return;
    }
    await conn.execute(
      `UPDATE mcp_calls SET invoiced = 1 WHERE tenant_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
      [tenantId, ...ids],
    );
    await conn.commit();
  } catch (error) {
    try { await conn.rollback(); } catch { /* the claim did not stick */ }
    console.error("[mcp.invoice]", error instanceof Error ? error.message : error);
    return;
  } finally {
    conn.release();
  }
  try {
    await stripe.invoiceItems.create(
      {
        customer,
        amount: ids.length * MCP_CALL_CENTS,
        currency: "usd",
        description: `MCP reads (${ids.length})`,
      },
      { idempotencyKey: `mcp-${tenantId}-${ids[0]}-${ids[ids.length - 1]}` },
    );
  } catch (error) {
    console.error("[mcp.invoice]", error instanceof Error ? error.message : error);
    await database().execute(
      `UPDATE mcp_calls SET invoiced = 0 WHERE tenant_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
      [tenantId, ...ids],
    );
  }
}

async function mcpUsage(tenantId: number): Promise<McpUsage> {
  const enabled = await queryRows(
    `SELECT 1 AS ok FROM tenant_modules WHERE tenant_id = ? AND module_code = 'mcp' AND enabled = 1 LIMIT 1`,
    [tenantId],
  );
  if (!enabled.length) return { enabled: false, calls: 0, cents: 0, priceCents: MCP_CALL_CENTS, tokenPrefix: null };
  const prefix = await queryRows(`SELECT mcp_token_prefix FROM tenants WHERE id = ? LIMIT 1`, [tenantId]);
  const calls = await queryRows(
    `SELECT COUNT(*) AS n FROM mcp_calls WHERE tenant_id = ? AND created_at >= ?`,
    [tenantId, utcMonthStart()],
  );
  const count = num(calls[0]?.n);
  return {
    enabled: true,
    calls: count,
    cents: count * MCP_CALL_CENTS,
    priceCents: MCP_CALL_CENTS,
    tokenPrefix: prefix[0]?.mcp_token_prefix ? String(prefix[0].mcp_token_prefix) : null,
  };
}

async function runMcpTool(tenantId: number, name: string, args: Record<string, unknown>): Promise<{ bill: boolean; result: unknown }> {
  const limit = mcpLimit(args.limit);
  if (name === "list_loans" || name === "list_clients" || name === "list_tasks") {
    if (limit == null) return { bill: false, result: mcpToolContent("limit must be from 1 to 50", true) };
  }
  if (name === "list_loans") {
    const status = mcpChoice(args.status, ["open", "funded", "archived"]);
    if (status === "bad") return { bill: false, result: mcpToolContent("status must be open, funded or archived", true) };
    const rows = await queryRows(
      `SELECT l.id, l.purpose, l.amount_cents, l.status, s.name AS stage, c.first_name, c.last_name
         FROM loans l
         JOIN clients c ON c.id = l.client_id AND c.tenant_id = l.tenant_id
         LEFT JOIN pipeline_stages s ON s.id = l.stage_id AND s.tenant_id = l.tenant_id
        WHERE l.tenant_id = ? AND (? IS NULL OR l.status = ?)
        ORDER BY l.id DESC
        LIMIT ${limit ?? 20}`,
      [tenantId, status, status],
    );
    return {
      bill: true,
      result: mcpToolContent({
        loans: rows.map((row) => ({
          id: num(row.id),
          purpose: String(row.purpose || ""),
          amountCents: num(row.amount_cents),
          status: String(row.status || ""),
          stage: row.stage ? String(row.stage) : null,
          client: `${String(row.first_name || "")} ${String(row.last_name || "")}`.trim(),
        })),
      }),
    };
  }
  if (name === "get_loan" || name === "get_client") {
    const id = mcpRecordId(args.id);
    if (!id) return { bill: false, result: mcpToolContent("id is required", true) };
    if (name === "get_loan") {
      const rows = await queryRows(
        `SELECT l.id, l.client_id, l.purpose, l.amount_cents, l.status, s.name AS stage, c.first_name, c.last_name
           FROM loans l
           JOIN clients c ON c.id = l.client_id AND c.tenant_id = l.tenant_id
           LEFT JOIN pipeline_stages s ON s.id = l.stage_id AND s.tenant_id = l.tenant_id
          WHERE l.tenant_id = ? AND l.id = ?
          LIMIT 1`,
        [tenantId, id],
      );
      const row = rows[0];
      return {
        bill: true,
        result: mcpToolContent(row ? {
          found: true,
          id: num(row.id),
          clientId: num(row.client_id),
          purpose: String(row.purpose || ""),
          amountCents: num(row.amount_cents),
          status: String(row.status || ""),
          stage: row.stage ? String(row.stage) : null,
          client: `${String(row.first_name || "")} ${String(row.last_name || "")}`.trim(),
        } : { found: false }),
      };
    }
    const rows = await queryRows(
      `SELECT id, first_name, last_name, email, phone, status, source FROM clients WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tenantId, id],
    );
    const row = rows[0];
    return {
      bill: true,
      result: mcpToolContent(row ? {
        found: true,
        id: num(row.id),
        firstName: String(row.first_name || ""),
        lastName: String(row.last_name || ""),
        email: row.email ? String(row.email) : null,
        phone: row.phone ? String(row.phone) : null,
        status: String(row.status || ""),
        source: row.source ? String(row.source) : null,
      } : { found: false }),
    };
  }
  if (name === "list_clients") {
    const status = mcpChoice(args.status, ["lead", "active", "archived"]);
    if (status === "bad") return { bill: false, result: mcpToolContent("status must be lead, active or archived", true) };
    const rows = await queryRows(
      `SELECT id, first_name, last_name, email, phone, status, source
         FROM clients
        WHERE tenant_id = ? AND (? IS NULL OR status = ?)
        ORDER BY id DESC
        LIMIT ${limit ?? 20}`,
      [tenantId, status, status],
    );
    return {
      bill: true,
      result: mcpToolContent({
        clients: rows.map((row) => ({
          id: num(row.id),
          firstName: String(row.first_name || ""),
          lastName: String(row.last_name || ""),
          email: row.email ? String(row.email) : null,
          phone: row.phone ? String(row.phone) : null,
          status: String(row.status || ""),
          source: row.source ? String(row.source) : null,
        })),
      }),
    };
  }
  const loanId = args.loanId == null || args.loanId === "" ? null : mcpRecordId(args.loanId);
  if (args.loanId != null && args.loanId !== "" && !loanId) return { bill: false, result: mcpToolContent("loanId must be a positive id", true) };
  const status = mcpChoice(args.status, ["open", "done"]);
  if (status === "bad") return { bill: false, result: mcpToolContent("status must be open or done", true) };
  const taskModule = await queryRows(
    `SELECT 1 AS ok FROM tenant_modules WHERE tenant_id = ? AND module_code = 'tasks' AND enabled = 1 LIMIT 1`,
    [tenantId],
  );
  if (!taskModule[0]) return { bill: false, result: mcpToolContent("The task board is not on for this office", true) };
  const rows = await queryRows(
    `SELECT t.id, t.title, t.status, t.column_key, t.priority, t.due_on, t.due_at, t.loan_id, t.client_id,
            t.assigned_user_id, u.first_name, u.last_name
       FROM tasks t
       LEFT JOIN tenant_users u ON u.id = t.assigned_user_id
      WHERE t.tenant_id = ? AND (? IS NULL OR t.loan_id = ?) AND (? IS NULL OR t.status = ?)
      ORDER BY t.id DESC
      LIMIT ${limit ?? 20}`,
    [tenantId, loanId, loanId, status, status],
  );
  return {
    bill: true,
    result: mcpToolContent({
      tasks: rows.map((row) => ({
        id: num(row.id),
        title: String(row.title || ""),
        status: String(row.status || ""),
        column: String(row.column_key || "todo"),
        priority: String(row.priority || "normal"),
        dueOn: mcpDate(row.due_on),
        dueAt: iso(row.due_at),
        assigneeId: row.assigned_user_id == null ? null : num(row.assigned_user_id),
        assigneeName: row.first_name ? `${row.first_name} ${row.last_name}` : null,
        loanId: row.loan_id == null ? null : num(row.loan_id),
        clientId: row.client_id == null ? null : num(row.client_id),
      })),
    }),
  };
}

async function mcpTenant(token: string): Promise<{ id: number } | { status: number; error: string }> {
  if (!token || token.length > 200) return { status: 401, error: "errors.unauthorized" };
  const rows = await queryRows(
    `SELECT id, status, trial_ends_at FROM tenants WHERE mcp_token_hash = ? LIMIT 1`,
    [sha256(token)],
  );
  if (!rows[0]) return { status: 401, error: "errors.unauthorized" };
  const status = String(rows[0].status || "");
  if (status === "suspended") return { status: 403, error: "errors.suspended" };
  if (status === "trial" && rows[0].trial_ends_at && new Date(String(rows[0].trial_ends_at)).getTime() < Date.now()) {
    return { status: 403, error: "errors.trialEnded" };
  }
  const enabled = await queryRows(
    `SELECT 1 AS ok FROM tenant_modules WHERE tenant_id = ? AND module_code = 'mcp' AND enabled = 1 LIMIT 1`,
    [num(rows[0].id)],
  );
  if (!enabled.length) return { status: 403, error: "errors.forbidden" };
  return { id: num(rows[0].id) };
}

async function campaignPriceCents(): Promise<number> {
  const rows = await queryRows(`SELECT price_cents FROM addons WHERE code = 'campaign_pack' LIMIT 1`);
  return num(rows[0]?.price_cents) || CAMPAIGN_PACK_CENTS;
}

async function campaignCeiling(): Promise<number> {
  const rows = await queryRows(`SELECT setting_value FROM platform_settings WHERE setting_key = 'campaign_contact_ceiling' LIMIT 1`);
  const value = num(rows[0]?.setting_value);
  return value > 0 ? value : CAMPAIGN_CEILING;
}

async function campaignAccount(tenantId: number): Promise<{ planCode: string | null; included: number; packs: number; used: number; platformUsed: number; ceiling: number; priceCents: number }> {
  const rows = await queryRows(
    `SELECT p.code AS plan_code,
            COALESCE(s.campaign_included, p.included_campaign_contacts) AS included,
            COALESCE(s.campaign_packs, 0) AS packs,
            (SELECT COUNT(DISTINCT email) FROM campaign_contacts WHERE tenant_id = s.tenant_id AND status = 'subscribed') AS used,
            (SELECT COUNT(DISTINCT email) FROM campaign_contacts WHERE status = 'subscribed') AS platform_used
       FROM tenant_subscriptions s
       JOIN plans p ON p.id = s.plan_id
      WHERE s.tenant_id = ? LIMIT 1`,
    [tenantId],
  );
  const row = rows[0] || {};
  const planCode = row.plan_code ? String(row.plan_code) : null;
  const [ceiling, priceCents] = await Promise.all([campaignCeiling(), campaignPriceCents()]);
  return {
    planCode,
    included: campaignIncluded(planCode, optionalNum(row.included)),
    packs: num(row.packs),
    used: num(row.used),
    platformUsed: num(row.platform_used),
    ceiling,
    priceCents,
  };
}

async function campaignOfferFor(tenantId: number): Promise<CampaignOffer | null> {
  const account = await campaignAccount(tenantId);
  if (account.included <= 0) return null;
  return {
    included: account.included,
    packs: account.packs,
    packSize: CAMPAIGN_PACK_SIZE,
    priceCents: account.priceCents,
    used: account.used,
    ceiling: account.ceiling,
    ceilingUsed: account.platformUsed,
  };
}

function campaignResend(): Resend | null {
  if (notifySandbox()) return null;
  const key = String(process.env.RESEND_API_KEY || "").trim();
  if (!key) return null;
  return new Resend(key);
}

async function ensureCampaignSegment(resend: Resend): Promise<string | null> {
  const saved = await queryRows(`SELECT setting_value FROM platform_settings WHERE setting_key = 'resend_campaign_segment_id' LIMIT 1`);
  if (saved[0]?.setting_value) return String(saved[0].setting_value);
  const listed = await resend.segments.list();
  const existing = listed.data?.data?.find((item) => item.name === "MortgageProx campaigns");
  const created = existing ? { data: existing, error: null } : await resend.segments.create({ name: "MortgageProx campaigns" });
  const id = created.data?.id || "";
  if (!id) return null;
  await database().execute(
    `INSERT INTO platform_settings (setting_key, setting_value) VALUES ('resend_campaign_segment_id', ?)
     ON DUPLICATE KEY UPDATE setting_value = IF(setting_value = '', VALUES(setting_value), setting_value)`,
    [id],
  );
  const again = await queryRows(`SELECT setting_value FROM platform_settings WHERE setting_key = 'resend_campaign_segment_id' LIMIT 1`);
  return again[0]?.setting_value ? String(again[0].setting_value) : id;
}

async function ensureCampaignTopic(resend: Resend, topicId: number, tenantId: number, name: string): Promise<string | null> {
  const rows = await queryRows(`SELECT resend_topic_id FROM campaign_topics WHERE id = ? AND tenant_id = ? LIMIT 1`, [topicId, tenantId]);
  if (!rows[0]) return null;
  if (rows[0].resend_topic_id) return String(rows[0].resend_topic_id);
  const topicName = `${tenantId} ${name}`.replace(/\s+/g, " ").trim().slice(0, 50);
  const created = await resend.topics.create({ name: topicName, defaultSubscription: "opt_out" });
  let id = created.data?.id || "";
  if (!id) {
    const listed = await resend.topics.list();
    id = listed.data?.data?.find((item) => item.name === topicName)?.id || "";
  }
  if (!id) return null;
  await database().execute(
    `UPDATE campaign_topics SET resend_topic_id = ? WHERE id = ? AND tenant_id = ? AND resend_topic_id IS NULL`,
    [id, topicId, tenantId],
  );
  const again = await queryRows(`SELECT resend_topic_id FROM campaign_topics WHERE id = ? AND tenant_id = ? LIMIT 1`, [topicId, tenantId]);
  return again[0]?.resend_topic_id ? String(again[0].resend_topic_id) : id;
}

async function syncCampaignContact(resend: Resend, input: { email: string; name: string; segmentId: string; topicId: string; subscription: "opt_in" | "opt_out" }): Promise<boolean> {
  const parts = input.name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");
  if (input.subscription === "opt_in") {
    const created = await resend.contacts.create({
      email: input.email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      unsubscribed: false,
      segments: [{ id: input.segmentId }],
      topics: [{ id: input.topicId, subscription: "opt_in" }],
    });
    if (!created.error) return true;
  }
  await resend.contacts.segments.add({ email: input.email, segmentId: input.segmentId });
  const topic = await resend.contacts.topics.update({
    email: input.email,
    topics: [{ id: input.topicId, subscription: input.subscription }],
  });
  return !topic.error;
}

async function ensureCampaignPackPrice(stripe: Stripe): Promise<string | null> {
  const rows = await queryRows(`SELECT price_cents, stripe_price_id FROM addons WHERE code = 'campaign_pack' LIMIT 1`);
  if (!rows[0]) return null;
  if (rows[0].stripe_price_id) return String(rows[0].stripe_price_id);
  const product = await stripe.products.create({ name: "MortgageProx campaign contacts", metadata: { addon: "campaign_pack" } });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: num(rows[0].price_cents) || CAMPAIGN_PACK_CENTS,
    recurring: { interval: "month" },
  });
  await database().execute(`UPDATE addons SET stripe_price_id = ? WHERE code = 'campaign_pack' AND stripe_price_id IS NULL`, [price.id]);
  const saved = await queryRows(`SELECT stripe_price_id FROM addons WHERE code = 'campaign_pack' LIMIT 1`);
  return saved[0]?.stripe_price_id ? String(saved[0].stripe_price_id) : price.id;
}

async function chargeCampaignPacks(tenantId: number, previous: number, next: number): Promise<string | null> {
  const stripe = stripeOrNull();
  if (!stripe) return "errors.stripe";
  const row = await loadBillingRow(tenantId);
  if (!row?.subscriptionId) return "errors.billing.subscription";
  const priceId = await ensureCampaignPackPrice(stripe);
  if (!priceId) return "errors.server";
  const [claimed] = await database().execute(
    `UPDATE tenant_subscriptions SET campaign_packs = ? WHERE tenant_id = ? AND campaign_packs = ?`,
    [next, tenantId, previous],
  );
  if (!num((claimed as { affectedRows?: number }).affectedRows)) return "errors.duplicate";
  try {
    await applyExtraSeats(stripe, row.subscriptionId, priceId, next);
  } catch (error) {
    await database().execute(`UPDATE tenant_subscriptions SET campaign_packs = ? WHERE tenant_id = ?`, [previous, tenantId]);
    console.error("[campaigns.packs]", error instanceof Error ? error.message : error);
    return "errors.billing.card";
  }
  return null;
}

function campaignIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Math.floor(Number(item))).filter((item) => item > 0))].slice(0, 100);
}

async function applyCampaignWebhook(payload: { type?: string; data?: Record<string, unknown> }): Promise<void> {
  const type = String(payload.type || "");
  const data = payload.data || {};
  const kind = type === "email.opened" ? "opened" : type === "email.clicked" ? "clicked" : type.includes("unsubscribed") ? "unsubscribed" : "";
  if (!kind) return;
  const broadcastId = String(data.broadcast_id || "");
  const email = normalizeEmail(Array.isArray(data.to) ? data.to[0] : data.email || data.to);
  if (!broadcastId || !EMAIL_RE.test(email)) return;
  const campaigns = await queryRows(
    `SELECT id, tenant_id, topic_id FROM campaigns WHERE resend_broadcast_id = ? LIMIT 1`,
    [broadcastId],
  );
  const campaign = campaigns[0];
  if (!campaign) return;
  const campaignId = num(campaign.id);
  const [inserted] = await database().execute(
    `INSERT IGNORE INTO campaign_events (campaign_id, email, event_type) VALUES (?, ?, ?)`,
    [campaignId, email, kind],
  );
  if (!num((inserted as { affectedRows?: number }).affectedRows)) return;
  if (kind === "opened" || kind === "clicked") {
    const column = kind === "opened" ? "opened_count" : "clicked_count";
    await database().execute(`UPDATE campaigns SET ${column} = ${column} + 1 WHERE id = ?`, [campaignId]);
    return;
  }
  const contacts = await queryRows(
    `SELECT id FROM campaign_contacts WHERE tenant_id = ? AND email = ? LIMIT 1`,
    [num(campaign.tenant_id), email],
  );
  if (!contacts[0]) return;
  await database().execute(
    `UPDATE campaign_subscriptions SET status = 'unsubscribed' WHERE contact_id = ? AND topic_id = ?`,
    [num(contacts[0].id), num(campaign.topic_id)],
  );
  const still = await queryRows(
    `SELECT 1 AS ok FROM campaign_subscriptions WHERE contact_id = ? AND status = 'subscribed' LIMIT 1`,
    [num(contacts[0].id)],
  );
  if (!still[0]) {
    await database().execute(
      `UPDATE campaign_contacts SET status = 'unsubscribed', unsubscribed_at = NOW() WHERE id = ?`,
      [num(contacts[0].id)],
    );
  }
}

async function billingSnapshot(tenantId: number): Promise<BillingSnapshot | null> {
  const row = await loadBillingRow(tenantId);
  if (!row) return null;
  const used = await usageCounts(tenantId);
  const mcp = await mcpUsage(tenantId);
  if (mcp.enabled) await syncMcpInvoice(tenantId);
  const seatPrice = await queryRows(`SELECT price_cents FROM addons WHERE code = 'extra_seat' LIMIT 1`);
  const seatOffer: SeatOffer | null = row.quoted || row.includedSeats <= 0 ? null : {
    priceCents: num(seatPrice[0]?.price_cents) || 2900,
    included: row.includedSeats,
    extra: row.extraSeats,
    used: used.seats,
  };
  const packRows = await queryRows(`SELECT code, meter, units, price_cents FROM usage_packs ORDER BY price_cents, code`);
  const packs: UsagePackOffer[] = packRows.flatMap((item) => {
    const meter = String(item.meter);
    if (!packApplies(meter, row.caps[meter as AllowanceKey] ?? null, row.quoted)) return [];
    if (meter !== "emails" && meter !== "letters" && meter !== "loans") return [];
    return [{ code: String(item.code), meter, units: num(item.units), priceCents: num(item.price_cents) }];
  });
  const campaignOffer = await campaignOfferFor(tenantId);
  return {
    planCode: row.planCode,
    priceCents: row.priceCents,
    isQuote: row.quoted,
    trialEndsAt: row.trialEndsAt,
    startFeeCents: row.startFeeCents,
    startFeeStatus: row.startFeeStatus,
    publishableKey: stripePublishableKey(),
    allowances: METER_KEYS.map((key): AllowanceMeter => ({
      key,
      included: row.caps[key],
      used: used[key],
      state: meterState(used[key], row.caps[key], row.quoted),
    })),
    seatOffer,
    packs,
    campaignOffer,
    mcp,
  };
}

async function assertAllowance(tenantId: number, key: AllowanceKey, add: number): Promise<string | null> {
  const row = await loadBillingRow(tenantId);
  if (!row) return null;
  const used = await usageCounts(tenantId);
  return allowanceDecision(used[key], row.caps[key], add, row.quoted);
}

async function ensurePlanPrice(stripe: Stripe, row: Pick<BillingRow, "planId" | "planCode" | "priceCents" | "priceId">): Promise<string | null> {
  if (row.priceCents <= 0 || !row.planCode) return null;
  if (row.priceId) return row.priceId;
  const product = await stripe.products.create({
    name: `MortgageProx ${row.planCode}`,
    metadata: { planCode: row.planCode },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: row.priceCents,
    recurring: { interval: "month" },
  });
  await database().execute(`UPDATE plans SET stripe_price_id = ? WHERE id = ? AND stripe_price_id IS NULL`, [price.id, row.planId]);
  return price.id;
}

async function priceForPlan(stripe: Stripe, planCode: string): Promise<{ planId: number; priceId: string } | null> {
  const rows = await queryRows(`SELECT id, code, price_cents, stripe_price_id, is_quote FROM plans WHERE code = ? LIMIT 1`, [planCode]);
  const row = rows[0];
  if (!row || Boolean(row.is_quote)) return null;
  const priceId = await ensurePlanPrice(stripe, {
    planId: num(row.id),
    planCode: String(row.code),
    priceCents: num(row.price_cents),
    priceId: row.stripe_price_id ? String(row.stripe_price_id) : null,
  });
  if (!priceId) return null;
  return { planId: num(row.id), priceId };
}

async function retargetSubscription(stripe: Stripe, subscriptionId: string, priceId: string): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data.find((entry) => entry.price.recurring) || subscription.items.data[0];
  if (!item) throw new Error("missing subscription item");
  if (item.price.id === priceId) return;
  const trialing = subscription.status === "trialing";
  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price: priceId }],
    proration_behavior: trialing ? "none" : "always_invoice",
    payment_behavior: "error_if_incomplete",
  });
}

async function ensureExtraSeatPrice(stripe: Stripe): Promise<string | null> {
  const rows = await queryRows(`SELECT price_cents, stripe_price_id FROM addons WHERE code = 'extra_seat' LIMIT 1`);
  if (!rows[0]) return null;
  if (rows[0].stripe_price_id) return String(rows[0].stripe_price_id);
  const product = await stripe.products.create({ name: "MortgageProx extra seat", metadata: { addon: "extra_seat" } });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: num(rows[0].price_cents) || 2900,
    recurring: { interval: "month" },
  });
  await database().execute(`UPDATE addons SET stripe_price_id = ? WHERE code = 'extra_seat' AND stripe_price_id IS NULL`, [price.id]);
  const saved = await queryRows(`SELECT stripe_price_id FROM addons WHERE code = 'extra_seat' LIMIT 1`);
  return saved[0]?.stripe_price_id ? String(saved[0].stripe_price_id) : price.id;
}

async function applyExtraSeats(stripe: Stripe, subscriptionId: string, priceId: string, quantity: number): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data.find((entry) => entry.price.id === priceId);
  if (quantity <= 0) {
    if (!item) return;
    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, deleted: true }],
      proration_behavior: "always_invoice",
      payment_behavior: "error_if_incomplete",
    });
    return;
  }
  await stripe.subscriptions.update(subscriptionId, {
    items: item ? [{ id: item.id, quantity }] : [{ price: priceId, quantity }],
    proration_behavior: "always_invoice",
    payment_behavior: "error_if_incomplete",
  });
}

async function grantUsagePack(intent: Stripe.PaymentIntent): Promise<void> {
  if (intent.status !== "succeeded" || intent.metadata?.purpose !== "usage_pack") return;
  const tenantId = Math.floor(Number(intent.metadata.tenantId) || 0);
  const meter = String(intent.metadata.meter || "");
  const units = Math.floor(Number(intent.metadata.units) || 0);
  if (!tenantId || units <= 0 || (meter !== "emails" && meter !== "letters" && meter !== "loans")) return;
  const period = meter === "loans" ? null : utcMonthStart();
  await database().execute(
    `INSERT IGNORE INTO tenant_usage_grants (tenant_id, meter, units, period_start, stripe_payment_intent_id) VALUES (?, ?, ?, ?, ?)`,
    [tenantId, meter, units, period, intent.id],
  );
}

async function fulfillStartFee(stripe: Stripe, session: Stripe.Checkout.Session, tenantIdOverride = 0): Promise<void> {
  if (session.payment_status === "unpaid") return;
  if (!tenantIdOverride && session.metadata?.purpose !== "start_fee") return;
  const tenantId = tenantIdOverride || Math.floor(Number(session.metadata?.tenantId || session.client_reference_id) || 0);
  if (!tenantId) return;
  const row = await loadBillingRow(tenantId);
  if (!row || row.startFeeCents <= 0 || row.quoted) return;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || row.customerId;
  if (!customerId) return;
  const full = session.payment_intent && typeof session.payment_intent !== "string"
    ? session
    : await stripe.checkout.sessions.retrieve(session.id, { expand: ["payment_intent.payment_method"] });
  if (full.payment_status === "unpaid") return;
  const amount = full.amount_total ?? row.startFeeCents;
  if (row.startFeeStatus !== "paid") {
    await stripe.customers.createBalanceTransaction(customerId, {
      amount: -Math.abs(amount),
      currency: "usd",
      description: "Trial start fee credited to the first invoice",
    }, { idempotencyKey: `mp-start-credit-${full.id}` });
    await database().execute(
      `UPDATE tenant_subscriptions
          SET start_fee_status = 'paid', start_fee_credit_cents = ?, stripe_customer_id = ?, stripe_checkout_session_id = ?
        WHERE tenant_id = ?`,
      [amount, customerId, full.id, tenantId],
    );
  }
  if (!row.subscriptionId) {
    const priceId = await ensurePlanPrice(stripe, row);
    if (!priceId) return;
    const intent = full.payment_intent;
    const method = intent && typeof intent !== "string" ? intent.payment_method : null;
    const paymentMethod = !method ? undefined : typeof method === "string" ? method : method.id;
    const trialEnd = trialEndUnix(row.trialEndsAt);
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      ...(trialEnd ? { trial_end: trialEnd } : {}),
      ...(paymentMethod ? { default_payment_method: paymentMethod } : {}),
      billing_mode: { type: "flexible" },
      metadata: { tenantId: String(tenantId) },
    }, { idempotencyKey: `mp-start-sub-${tenantId}` });
    await database().execute(
      `UPDATE tenant_subscriptions SET stripe_subscription_id = ? WHERE tenant_id = ? AND stripe_subscription_id IS NULL`,
      [subscription.id, tenantId],
    );
  }
}

async function syncStartFee(row: BillingRow): Promise<void> {
  if (row.startFeeStatus !== "due" || !row.checkoutSessionId) return;
  const stripe = stripeOrNull();
  if (!stripe) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(row.checkoutSessionId, {
      expand: ["payment_intent.payment_method"],
    });
    if (session.status === "complete" && session.payment_status !== "unpaid") await fulfillStartFee(stripe, session);
  } catch (error) {
    console.error("[billing.sync]", error instanceof Error ? error.message : error);
  }
}

async function applySubscriptionStatus(subscriptionId: string, status: "active" | "canceled"): Promise<void> {
  await database().execute(`UPDATE tenant_subscriptions SET status = ? WHERE stripe_subscription_id = ?`, [status, subscriptionId]);
  if (status === "active") {
    await database().execute(
      `UPDATE tenants t JOIN tenant_subscriptions s ON s.tenant_id = t.id
          SET t.status = 'active' WHERE s.stripe_subscription_id = ? AND t.status = 'trial'`,
      [subscriptionId],
    );
  }
}

const TASK_ZONE = "America/Chicago";
const TASK_COLUMNS = ["todo", "doing", "waiting", "done"] as const;
const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

function taskZoneParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TASK_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: pick("year"), month: pick("month"), day: pick("day"), hour: pick("hour") };
}

function chicagoAt(year: number, month: number, day: number, hour: number): Date {
  let guess = new Date(Date.UTC(year, month - 1, day, hour + 6, 0, 0));
  for (let pass = 0; pass < 8; pass += 1) {
    const parts = taskZoneParts(guess);
    if (parts.year === year && parts.month === month && parts.day === day && parts.hour === hour) return guess;
    const wanted = Date.UTC(year, month - 1, day);
    const got = Date.UTC(parts.year, parts.month - 1, parts.day);
    guess = new Date(guess.getTime() + (wanted - got) + (hour - parts.hour) * 3_600_000);
  }
  return guess;
}

function taskDueOn(dueAt: Date | null): string | null {
  if (!dueAt || !Number.isFinite(dueAt.getTime())) return null;
  const parts = taskZoneParts(dueAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function taskBoardScope(): string {
  return `(? = 'all' OR t.assigned_user_id = ? OR (t.assigned_user_id IS NULL AND (t.loan_id IS NULL OR l.assigned_user_id = ? OR l.assigned_user_id IS NULL)))`;
}

function taskVisibleTo(
  scope: "own" | "all",
  viewerId: number,
  task: { assigneeId: number | null; loanId: number | null; loanAssigneeId: number | null },
): boolean {
  if (scope === "all") return true;
  if (task.assigneeId === viewerId) return true;
  if (task.assigneeId != null) return false;
  if (task.loanId == null) return true;
  return task.loanAssigneeId == null || task.loanAssigneeId === viewerId;
}

function boardPagination(columnCounts: number[], page: number, limit: number): { page: number; limit: number; total: number; totalPages: number } {
  const total = columnCounts.reduce((sum, count) => sum + count, 0);
  const fullest = columnCounts.reduce((max, count) => Math.max(max, count), 0);
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(fullest / limit)) };
}

function loanStageMove(currentStatus: string, targetFunded: boolean): { status: "open" | "funded"; checkOpenCap: boolean } {
  const status = targetFunded ? "funded" : "open";
  return { status, checkOpenCap: currentStatus !== "open" && status === "open" };
}

function taskReminderSlots(priority: string, dueAt: Date): { kind: "before" | "at"; fireAt: Date }[] {
  if (priority === "low" || !Number.isFinite(dueAt.getTime())) return [];
  if (priority === "urgent") {
    return [
      { kind: "before", fireAt: new Date(dueAt.getTime() - 3_600_000) },
      { kind: "at", fireAt: dueAt },
    ];
  }
  const parts = taskZoneParts(dueAt);
  const shift = priority === "normal" ? -1 : 0;
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + shift));
  return [{ kind: "at", fireAt: chicagoAt(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), 9) }];
}

const flowHooks: {
  planFlowStep?: (input: {
    step: { stepKey: string; stepType: string; config: Record<string, unknown> } | null;
    edges: { sourceKey: string; targetKey: string; edgeType: string }[];
    now: Date;
    waitingSince: Date | null;
    quietStart: number;
    quietEnd: number;
    ctx: { purpose: string; hasEmail: boolean; hasPhone: boolean; replied: boolean; stopOnReply: boolean };
    smsReady: boolean;
    emailAllowed: boolean;
    smsAllowed: boolean | "later";
  }) => { kind: string; reason?: string; channel?: string; then?: string | null; edge?: string; until?: string; stepKey?: string };
  reminderLibrary?: (name: string) => unknown;
  quietUntil?: (now: Date, start: number, end: number) => Date | null;
} = {};

function buildApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({
    limit: "2mb",
    verify(req, _res, buf) {
      const url = String(req.url || "");
      if (url.startsWith("/api/stripe/webhook") || url.startsWith("/api/resend/webhook")) {
        (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      }
    },
  }));

  const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.VITEST === "true",
    message: { error: "errors.rateLimited" },
  });

  const mcpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.VITEST === "true",
    message: { error: "errors.rateLimited" },
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "mortgageprox" });
  });

  app.get("/api/cron/trial-reminders", (req, res) => {
    const expected = process.env.CRON_SECRET || "";
    if (!expected || req.headers.authorization !== `Bearer ${expected}`) return deny(res, 401, "errors.unauthorized");
    res.json({ ok: true, reminded: 0 });
  });

  app.get("/api/cron/daily", async (req, res) => {
    const expected = process.env.CRON_SECRET || "";
    if (!expected || req.headers.authorization !== `Bearer ${expected}`) return deny(res, 401, "errors.unauthorized");
    const failed: string[] = [];
    let flows = 0;
    let tasks = 0;
    try {
      flows = await advanceDueFlows(25);
    } catch (error) {
      failed.push("flows");
      console.error("[cron.daily.flows]", error instanceof Error ? error.message : error);
    }
    try {
      tasks = await sendDueTaskReminders(25);
    } catch (error) {
      failed.push("tasks");
      console.error("[cron.daily.tasks]", error instanceof Error ? error.message : error);
    }
    if (failed.length === 2) return deny(res, 500, "errors.server");
    res.json({ ok: failed.length === 0, reminded: 0, flows, tasks, failed });
  });

  app.get("/api/cron/flow-reminders", async (req, res) => {
    const expected = process.env.CRON_SECRET || "";
    if (!expected || req.headers.authorization !== `Bearer ${expected}`) return deny(res, 401, "errors.unauthorized");
    try {
      const advanced = await advanceDueFlows(25);
      res.json({ ok: true, advanced });
    } catch (error) {
      console.error("[flows.cron]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/public/host", async (req, res) => {
    try {
      const found = await publicTenant(requestHost(req));
      if (found === "none" || found === "hidden") return res.json({ ok: true, tenant: null });
      res.json({
        ok: true,
        tenant: {
          name: found.name,
          slug: found.slug,
          host: tenantHost(found.slug),
          customDomain: found.customDomain,
          primaryColor: found.primaryColor,
          logoUrl: found.logoUrl,
        },
      });
    } catch (error) {
      console.error("[host]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/public/catalog", async (_req, res) => {
    try {
      const modules = await queryRows(
        `SELECT code, name_key, summary_key, category, kind, sort_order FROM modules WHERE kind = 'product' ORDER BY sort_order`,
      );
      const plans = await queryRows(
        `SELECT id, code, name_key, tagline_key, price_cents, seat_limit, is_quote, trial_fee_cents,
                included_loans, included_emails, included_letters, included_sms, included_voice_minutes, sort_order
           FROM plans WHERE is_public = 1 ORDER BY sort_order`,
      );
      const links = await queryRows(
        `SELECT p.code AS plan_code, pm.module_code
           FROM plan_modules pm JOIN plans p ON p.id = pm.plan_id`,
      );
      const addons = await queryRows(
        `SELECT code, name_key, summary_key, price_cents, billing, sort_order FROM addons ORDER BY sort_order`,
      );
      const byPlan = new Map<string, string[]>();
      for (const link of links) {
        const code = String(link.plan_code);
        byPlan.set(code, [...(byPlan.get(code) ?? []), String(link.module_code)]);
      }
      res.json({
        ok: true,
        trialDays: TRIAL_DAYS,
        modules: modules.map((row): CatalogModule => ({
          code: String(row.code),
          nameKey: String(row.name_key),
          summaryKey: String(row.summary_key),
          category: String(row.category) as CatalogModule["category"],
          kind: "product",
          sortOrder: num(row.sort_order),
        })),
        plans: plans.map((row): CatalogPlan => ({
          code: String(row.code),
          nameKey: String(row.name_key),
          taglineKey: String(row.tagline_key),
          priceCents: num(row.price_cents),
          seatLimit: num(row.seat_limit),
          isQuote: Boolean(row.is_quote),
          trialFeeCents: num(row.trial_fee_cents),
          includedLoans: optionalNum(row.included_loans),
          includedEmails: optionalNum(row.included_emails),
          includedLetters: optionalNum(row.included_letters),
          includedSms: optionalNum(row.included_sms),
          includedVoiceMinutes: optionalNum(row.included_voice_minutes),
          sortOrder: num(row.sort_order),
          modules: byPlan.get(String(row.code)) ?? [],
        })),
        addons: addons.map((row): CatalogAddon => ({
          code: String(row.code),
          nameKey: String(row.name_key),
          summaryKey: String(row.summary_key),
          priceCents: num(row.price_cents),
          billing: String(row.billing) as CatalogAddon["billing"],
          sortOrder: num(row.sort_order),
        })),
      });
    } catch (error) {
      console.error("[catalog]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  type WizardSignup = {
    selection: WizardSelection;
    brokerageName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    domain: string | null;
    brand: { accent: string; radius: string; headline: string } | null;
  };

  function readWizardSignup(body: unknown): { signup: WizardSignup } | { error: string } {
    if (!body || typeof body !== "object") return { error: "validation.wizard" };
    const source = body as Record<string, unknown>;
    const parsed = parseWizard(source.selection ?? source);
    const selection = parsed ? withWizardRules(parsed) : null;
    const brokerageName = String(source.brokerageName || "").trim().slice(0, 160);
    const domain = selection?.customDomain ? normalizeHostname(source.domain) : null;
    if (selection?.customDomain && source.domain && !domain) return { error: "validation.domain" };
    const brand = parseBrand(source.brand);
    if (source.brand && !brand) return { error: "validation.color" };
    const firstName = String(source.firstName || "").trim().slice(0, 100);
    const lastName = String(source.lastName || "").trim().slice(0, 100);
    const email = normalizeEmail(source.email);
    const phone = String(source.phone || "").trim().slice(0, 20);
    if (!selection || brokerageName.length < 2 || firstName.length < 1 || lastName.length < 1 || !EMAIL_RE.test(email)) {
      return { error: "validation.wizard" };
    }
    return { signup: { selection, brokerageName, firstName, lastName, email, phone, domain, brand } };
  }

  async function provisionBrokerage(
    signup: WizardSignup,
    billing: { startFee: number; status: string; sessionId: string | null; customerId: string | null },
  ): Promise<{ tenantId: number; userId: number; slug: string; recommendation: PlanRecommendation }> {
    const recommendation = recommendPlan(signup.selection);
    const plans = await queryRows(`SELECT id, code, seat_limit, is_quote, trial_fee_cents FROM plans WHERE code = ? LIMIT 1`, [recommendation.planCode]);
    if (!plans[0]) throw new Error("missing plan");
    const planId = num(plans[0].id);
    const quoted = Boolean(plans[0].is_quote);
    const seats = recommendation.planCode === "custom" ? signup.selection.seats : Math.max(signup.selection.seats, num(plans[0].seat_limit));
    const product = await queryRows(`SELECT code, category FROM modules WHERE kind = 'product'`);
    const known = new Set(product.map((row) => String(row.code)));
    const enabled = new Set(product.filter((row) => row.category === "core").map((row) => String(row.code)));
    for (const code of signup.selection.modules) if (known.has(code)) enabled.add(code);
    const conn = await database().getConnection();
    let tenantId = 0;
    let userId = 0;
    let slug = "";
    try {
      await conn.beginTransaction();
      const free = await nextTenantSlug(signup.brokerageName, conn);
      if (!free) throw new Error("slug exhausted");
      slug = free;
      const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86400_000);
      const trialSql = quoted ? null : trialEnds.toISOString().slice(0, 19).replace("T", " ");
      const [inserted] = await conn.execute(
        `INSERT INTO tenants (name, slug, status, plan_id, phone, support_email, custom_domain, primary_color, brand_radius, brand_headline, trial_ends_at, wizard_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [signup.brokerageName, slug, quoted ? "active" : "trial", planId, signup.phone || null, signup.email, signup.domain, signup.brand?.accent ?? null, signup.brand?.radius ?? "soft", signup.brand?.headline ?? "serif", trialSql, JSON.stringify({ selection: signup.selection, recommendation, brand: signup.brand })],
      );
      tenantId = num((inserted as { insertId?: number }).insertId);
      const [userInsert] = await conn.execute(
        `INSERT INTO tenant_users (tenant_id, email, first_name, last_name, phone, role, status)
         VALUES (?, ?, ?, ?, ?, 'brokerage_owner', 'active')`,
        [tenantId, signup.email, signup.firstName, signup.lastName, signup.phone || null],
      );
      userId = num((userInsert as { insertId?: number }).insertId);
      await ensurePersonSlug(tenantId, userId, conn);
      await conn.execute(`UPDATE tenants SET owner_user_id = ? WHERE id = ?`, [userId, tenantId]);
      await conn.execute(
        `INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, seats, trial_ends_at, start_fee_cents, start_fee_status, stripe_customer_id, stripe_checkout_session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, planId, quoted ? "active" : "trial", seats, trialSql, billing.startFee, billing.status, billing.customerId, billing.sessionId],
      );
      await insertRows(conn, `INSERT INTO tenant_modules (tenant_id, module_code, enabled)`, [...enabled].map((code) => [tenantId, code, 1]));
      await insertRows(conn, `INSERT INTO tenant_addons (tenant_id, addon_code, enabled)`, recommendation.addons.map((code) => [tenantId, code, 1]));
      await insertRows(conn, `INSERT INTO pipeline_stages (tenant_id, name, sort_order, is_funded, code)`, DEFAULT_STAGES.map(([name, order, funded, code]) => [tenantId, name, order, funded, code]));
      await seedTenantOffice(conn, tenantId);
      await seedTenantLegal(conn, tenantId, signup.brokerageName);
      await seedTenantEmails(conn, tenantId, signup.brokerageName);
      await seedReminderLibrary(tenantId, signup.brokerageName, conn);
      await logActivity({
        tenantId,
        actorType: "system",
        action: "tenant.created",
        summary: quoted
          ? `${signup.brokerageName} opened a custom package`
          : `${signup.brokerageName} started a ${TRIAL_DAYS}-day trial on ${recommendation.planCode}`,
      }, conn);
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
    return { tenantId, userId, slug, recommendation };
  }

  async function openPaidWizard(stripe: Stripe, session: Stripe.Checkout.Session, ip: string, origin: string): Promise<{ email: string; emailSent: boolean; recommendation: PlanRecommendation | null; userId: number; name: string; host: string } | null> {
    if (session.metadata?.purpose !== "wizard_start") return null;
    const intentId = Math.floor(Number(session.metadata.intentId) || 0);
    if (!intentId) return null;
    const rows = await queryRows(
      `SELECT id, email, payload_json, status, tenant_id, email_sent, stripe_customer_id FROM wizard_intents WHERE id = ? LIMIT 1`,
      [intentId],
    );
    const intent = rows[0];
    if (!intent) return null;
    const full = session.payment_intent ? session : await stripe.checkout.sessions.retrieve(session.id, { expand: ["payment_intent.payment_method"] });
    if (full.payment_status === "unpaid") return null;
    let tenantId = num(intent.tenant_id);
    let recommendation: PlanRecommendation | null = null;
    if (!tenantId) {
      const signup = readWizardSignup(typeof intent.payload_json === "string" ? JSON.parse(intent.payload_json) : intent.payload_json);
      if (!("signup" in signup)) return null;
      const customerId = typeof full.customer === "string" ? full.customer : full.customer?.id || (intent.stripe_customer_id ? String(intent.stripe_customer_id) : null);
      try {
        const created = await provisionBrokerage(signup.signup, {
          startFee: num(full.amount_total),
          status: "due",
          sessionId: full.id,
          customerId,
        });
        tenantId = created.tenantId;
        recommendation = created.recommendation;
      } catch (error) {
        const owners = await queryRows(`SELECT tenant_id FROM tenant_users WHERE email = ? LIMIT 1`, [String(intent.email)]);
        tenantId = num(owners[0]?.tenant_id);
        if (!tenantId) throw error;
      }
      await database().execute(
        `UPDATE wizard_intents SET status = 'paid', tenant_id = ?, stripe_checkout_session_id = ? WHERE id = ? AND tenant_id IS NULL`,
        [tenantId, full.id, intentId],
      );
    }
    const owners = await queryRows(
      `SELECT u.id, u.email, u.first_name, t.name, t.slug FROM tenant_users u JOIN tenants t ON t.id = u.tenant_id WHERE u.tenant_id = ? AND u.role = 'brokerage_owner' LIMIT 1`,
      [tenantId],
    );
    const owner = owners[0];
    const fresh = await queryRows(`SELECT email_sent FROM wizard_intents WHERE id = ? LIMIT 1`, [intentId]);
    const welcome = (async () => {
      let sent = Boolean(fresh[0]?.email_sent);
      if (!sent && owner) {
        try {
          await issueOtp("brokerage", num(owner.id), String(owner.email), ip, "workspace_ready", {
            firstName: owner.first_name ? String(owner.first_name) : "",
            brokerage: owner.name ? String(owner.name) : APP_NAME,
            host: owner.slug ? tenantHost(String(owner.slug)) : "",
          }, origin);
          sent = true;
        } catch (error) {
          sent = false;
          console.error("[wizard] otp email failed", error instanceof Error ? error.message : error);
        }
        await database().execute(`UPDATE wizard_intents SET email_sent = ? WHERE id = ?`, [sent ? 1 : 0, intentId]);
      }
      return sent;
    })();
    const [, emailSent] = await Promise.all([fulfillStartFee(stripe, full, tenantId), welcome]);
    return {
      email: String(intent.email),
      emailSent,
      recommendation,
      userId: owner ? num(owner.id) : 0,
      name: owner?.name ? String(owner.name) : "",
      host: owner?.slug ? tenantHost(String(owner.slug)) : "",
    };
  }

  app.get("/api/public/wizard/host", async (req, res) => {
    const name = String(req.query.name || "").trim();
    if (name.length < 2 || name.length > 160) return deny(res, 400, "validation.wizard");
    try {
      const slug = await nextTenantSlug(name);
      if (!slug) return deny(res, 409, "errors.duplicate");
      res.json({ ok: true, slug, host: tenantHost(slug) });
    } catch (error) {
      console.error("[wizard.host]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/public/wizard/recommend", (req, res) => {
    const selection = parseWizard(req.body);
    if (!selection) return deny(res, 400, "validation.wizard");
    res.json({ ok: true, recommendation: recommendPlan(withWizardRules(selection)) });
  });

  app.post("/api/public/wizard/checkout", async (req, res) => {
    const read = readWizardSignup(req.body);
    if ("error" in read) return deny(res, 400, read.error);
    const signup = read.signup;
    const stripe = stripeOrNull();
    const publishableKey = stripePublishableKey();
    if (!stripe || !publishableKey) return deny(res, 503, "errors.stripe");
    try {
      const existing = await findAccount(signup.email);
      if (existing) return deny(res, 409, "errors.accountExists");
      const recommendation = recommendPlan(signup.selection);
      const plans = await queryRows(`SELECT id, is_quote, trial_fee_cents FROM plans WHERE code = ? LIMIT 1`, [recommendation.planCode]);
      if (!plans[0]) return deny(res, 500, "errors.server");
      const startFee = Boolean(plans[0].is_quote) ? 0 : num(plans[0].trial_fee_cents);
      if (startFee <= 0) return deny(res, 409, "errors.billing.notIncluded");
      const payload = JSON.stringify(signup);
      const payloadHash = sha256(payload);
      const open = await queryRows(
        `SELECT id, stripe_checkout_session_id FROM wizard_intents WHERE email = ? AND payload_hash = ? AND status = 'open' ORDER BY id DESC LIMIT 1`,
        [signup.email, payloadHash],
      );
      if (open[0]?.stripe_checkout_session_id) {
        const current = await stripe.checkout.sessions.retrieve(String(open[0].stripe_checkout_session_id));
        if (current.status === "open" && current.client_secret) {
          res.json({ ok: true, clientSecret: current.client_secret, publishableKey, intentId: num(open[0].id) });
          return;
        }
      }
      const [inserted] = await database().execute(
        `INSERT INTO wizard_intents (email, payload_json, payload_hash, amount_cents) VALUES (?, ?, ?, ?)`,
        [signup.email, payload, payloadHash, startFee],
      );
      const intentId = num((inserted as { insertId?: number }).insertId);
      const customer = await stripe.customers.create({
        email: signup.email,
        name: signup.brokerageName,
        metadata: { intentId: String(intentId) },
      });
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "elements",
        customer: customer.id,
        return_url: `${publicOrigin(req)}/start?intent=${intentId}`,
        metadata: { intentId: String(intentId), purpose: "wizard_start" },
        payment_intent_data: {
          setup_future_usage: "off_session",
          metadata: { intentId: String(intentId), purpose: "wizard_start" },
        },
        wallet_options: { link: { display: "never" } },
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: startFee,
            product_data: { name: "MortgageProx trial start" },
          },
        }],
      });
      if (!session.client_secret) return deny(res, 502, "errors.stripe");
      await database().execute(
        `UPDATE wizard_intents SET stripe_customer_id = ?, stripe_checkout_session_id = ? WHERE id = ?`,
        [customer.id, session.id, intentId],
      );
      res.json({ ok: true, clientSecret: session.client_secret, publishableKey, intentId });
    } catch (error) {
      console.error("[wizard.checkout]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/public/wizard/complete", async (req, res) => {
    const intentId = Math.floor(Number(req.body?.intentId) || 0);
    const stripe = stripeOrNull();
    if (!intentId) return deny(res, 400, "validation.wizard");
    if (!stripe) return deny(res, 503, "errors.stripe");
    try {
      const rows = await queryRows(`SELECT stripe_checkout_session_id FROM wizard_intents WHERE id = ? LIMIT 1`, [intentId]);
      const sessionId = rows[0]?.stripe_checkout_session_id ? String(rows[0].stripe_checkout_session_id) : "";
      if (!sessionId) return deny(res, 404, "errors.notFound");
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.payment_method"] });
      if (session.payment_status === "unpaid") return deny(res, 402, "errors.paymentRequired");
      const opened = await openPaidWizard(stripe, session, req.ip || "", publicOrigin(req));
      if (!opened) return deny(res, 402, "errors.paymentRequired");
      if (opened.userId) await openBrokerageSession(res, opened.userId);
      res.status(201).json({ ok: true, email: opened.email, emailSent: opened.emailSent, recommendation: opened.recommendation, name: opened.name, host: opened.host });
    } catch (error) {
      console.error("[wizard.complete]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/public/wizard/start", async (req, res) => {
    const read = readWizardSignup(req.body);
    if ("error" in read) return deny(res, 400, read.error);
    const signup = read.signup;
    try {
      const existing = await findAccount(signup.email);
      if (existing) return deny(res, 409, "errors.accountExists");
      if (signup.domain) {
        const takenDomain = await queryRows(`SELECT id FROM tenants WHERE custom_domain = ? LIMIT 1`, [signup.domain]);
        if (takenDomain.length) return deny(res, 409, "errors.duplicate");
      }
      const recommendation = recommendPlan(signup.selection);
      const plans = await queryRows(`SELECT is_quote, trial_fee_cents FROM plans WHERE code = ? LIMIT 1`, [recommendation.planCode]);
      if (!plans[0]) return deny(res, 500, "errors.server");
      const startFee = Boolean(plans[0].is_quote) ? 0 : num(plans[0].trial_fee_cents);
      if (startFee > 0) return deny(res, 402, "errors.paymentRequired");
      const created = await provisionBrokerage(signup, { startFee: 0, status: "none", sessionId: null, customerId: null });
      await openBrokerageSession(res, created.userId);
      let emailSent = true;
      try {
        await issueOtp("brokerage", created.userId, signup.email, req.ip || "", "workspace_ready", {
          firstName: signup.firstName,
          brokerage: signup.brokerageName,
          host: tenantHost(created.slug),
        }, publicOrigin(req));
      } catch (error) {
        emailSent = false;
        console.error("[wizard] otp email failed", error instanceof Error ? error.message : error);
      }
      res.status(201).json({ ok: true, email: signup.email, emailSent, recommendation: created.recommendation, name: signup.brokerageName, host: tenantHost(created.slug) });
    } catch (error) {
      console.error("[wizard]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/auth/otp/request", otpLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!EMAIL_RE.test(email)) return deny(res, 400, "validation.email");
    try {
      const account = await findAccount(email);
      let sent = false;
      if (account && account.status === "active") {
        try {
          await issueOtp(account.actor, account.id, email, req.ip || "", "sign_in", {}, publicOrigin(req));
          sent = true;
        } catch (error) {
          console.error("[otp] send failed", error instanceof Error ? error.message : error);
          return deny(res, 502, "errors.otpSendFailed");
        }
      }
      res.json({ ok: true, sent });
    } catch (error) {
      console.error("[otp] request", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/auth/otp/verify", otpLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return deny(res, 400, "validation.otpInvalid");
    try {
      const account = await findAccount(email);
      if (!account || account.status !== "active") return deny(res, 401, "errors.authInvalid");
      const otps = await queryRows(
        `SELECT id, code_hash, attempts FROM otp_codes
          WHERE actor = ? AND user_id = ? AND purpose = 'login' AND consumed_at IS NULL AND expires_at > NOW()
          ORDER BY id DESC LIMIT 1`,
        [account.actor, account.id],
      );
      const otp = otps[0];
      if (!otp) return deny(res, 401, "errors.authInvalid");
      if (num(otp.attempts) >= OTP_MAX_ATTEMPTS) return deny(res, 401, "errors.authLocked");
      if (String(otp.code_hash) !== sha256(code)) {
        await database().execute(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?`, [otp.id]);
        return deny(res, 401, "errors.authInvalid");
      }
      const [consumed] = await database().execute(
        `UPDATE otp_codes SET consumed_at = NOW() WHERE id = ? AND consumed_at IS NULL AND code_hash = ?`,
        [otp.id, sha256(code)],
      );
      if (num((consumed as { affectedRows?: number }).affectedRows) !== 1) return deny(res, 401, "errors.authInvalid");
      const token = crypto.randomBytes(32).toString("hex");
      await database().execute(
        `INSERT INTO sessions (actor, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ${SESSION_DAYS} DAY))`,
        [account.actor, account.id, sha256(token)],
      );
      const table = account.actor === "platform" ? "platform_users" : account.actor === "borrower" ? "borrowers" : "tenant_users";
      await database().execute(`UPDATE \`${table}\` SET last_login_at = NOW() WHERE id = ?`, [account.id]);
      setSessionCookie(res, token);
      const user = await loadUser(account.actor, account.id);
      res.json({ ok: true, user });
    } catch (error) {
      console.error("[otp] verify", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      res.json({ ok: true, user });
    } catch (error) {
      console.error("[me]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const token = readCookie(req, COOKIE);
      if (token) await database().execute(`UPDATE sessions SET revoked_at = NOW() WHERE token_hash = ?`, [sha256(token)]);
      clearSessionCookie(res);
      res.json({ ok: true });
    } catch (error) {
      console.error("[logout]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/command/tenants", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.read", res)) return;
      const grid = parseGridQuery(req.query as Record<string, unknown>, {
        name: "t.name",
        status: "t.status",
        created: "t.created_at",
        trial: "t.trial_ends_at",
      }, "created");
      const status = ["trial", "active", "suspended"].includes(String(req.query.status || "")) ? String(req.query.status) : "";
      const term = likeTerm(grid.search);
      const where = `WHERE (? = '' OR t.name LIKE ? ESCAPE '\\\\' OR t.slug LIKE ? ESCAPE '\\\\' OR u.email LIKE ? ESCAPE '\\\\')
        AND (? = '' OR t.status = ?)`;
      const params = [grid.search, term, term, term, status, status];
      const countRows = await queryRows(
        `SELECT COUNT(*) AS total FROM tenants t LEFT JOIN tenant_users u ON u.id = t.owner_user_id ${where}`,
        params,
      );
      const items = await queryRows(
        `SELECT t.id, t.name, t.slug, t.status, t.trial_ends_at, t.created_at, p.code AS plan_code, p.name_key AS plan_name_key,
                u.email AS owner_email, u.first_name, u.last_name,
                (SELECT COUNT(*) FROM tenant_modules tm WHERE tm.tenant_id = t.id AND tm.enabled = 1) AS module_count
           FROM tenants t
           LEFT JOIN plans p ON p.id = t.plan_id
           LEFT JOIN tenant_users u ON u.id = t.owner_user_id
           ${where}
          ORDER BY ${grid.orderBy} ${grid.dir}
          LIMIT ${grid.limit} OFFSET ${grid.offset}`,
        params,
      );
      const total = num(countRows[0]?.total);
      res.json({
        ok: true,
        items: items.map((row): TenantListItem => ({
          id: num(row.id),
          name: String(row.name),
          slug: String(row.slug),
          status: String(row.status),
          planCode: row.plan_code ? String(row.plan_code) : null,
          planNameKey: row.plan_name_key ? String(row.plan_name_key) : null,
          trialEndsAt: iso(row.trial_ends_at),
          ownerEmail: row.owner_email ? String(row.owner_email) : null,
          ownerName: row.owner_email ? `${row.first_name} ${row.last_name}` : null,
          moduleCount: num(row.module_count),
          createdAt: iso(row.created_at) || "",
        })),
        pagination: pagination(grid.page, grid.limit, total),
      });
    } catch (error) {
      console.error("[tenants]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/command/tenants/:id", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.read", res)) return;
      const id = Number(req.params.id);
      const rows = await queryRows(
        `SELECT t.id, t.name, t.slug, t.status, t.phone, t.support_email, t.custom_domain, t.primary_color,
                t.logo_url, t.brand_radius, t.brand_headline,
                t.trial_ends_at, t.notes, t.wizard_json, t.created_at, p.code AS plan_code, p.name_key AS plan_name_key,
                u.email AS owner_email, u.first_name, u.last_name,
                s.start_fee_cents, s.start_fee_status, s.extra_seats, s.campaign_included, p.included_campaign_contacts,
                p.seat_limit
           FROM tenants t
           LEFT JOIN plans p ON p.id = t.plan_id
           LEFT JOIN tenant_users u ON u.id = t.owner_user_id
           LEFT JOIN tenant_subscriptions s ON s.tenant_id = t.id
          WHERE t.id = ? LIMIT 1`,
        [id],
      );
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      const modules = await queryRows(`SELECT module_code FROM tenant_modules WHERE tenant_id = ? AND enabled = 1`, [id]);
      const seatRows = await queryRows(`SELECT COUNT(*) AS total FROM tenant_users WHERE tenant_id = ? AND status = 'active'`, [id]);
      const addons = await queryRows(`SELECT addon_code FROM tenant_addons WHERE tenant_id = ? AND enabled = 1`, [id]);
      const row = rows[0];
      let wizard: unknown = null;
      if (row.wizard_json) {
        try {
          wizard = typeof row.wizard_json === "string" ? JSON.parse(row.wizard_json) : row.wizard_json;
        } catch {
          wizard = null;
        }
      }
      res.json({
        ok: true,
        tenant: {
          id: num(row.id),
          name: String(row.name),
          slug: String(row.slug),
          status: String(row.status),
          phone: row.phone ? String(row.phone) : null,
          supportEmail: row.support_email ? String(row.support_email) : null,
          customDomain: row.custom_domain ? String(row.custom_domain) : null,
          primaryColor: row.primary_color ? String(row.primary_color) : null,
          logoUrl: row.logo_url ? String(row.logo_url) : null,
          brandRadius: row.brand_radius ? String(row.brand_radius) : "soft",
          brandHeadline: row.brand_headline ? String(row.brand_headline) : "serif",
          trialEndsAt: iso(row.trial_ends_at),
          startFeeCents: num(row.start_fee_cents),
          startFeeStatus: row.start_fee_status ? String(row.start_fee_status) : "none",
          notes: row.notes ? String(row.notes) : "",
          planCode: row.plan_code ? String(row.plan_code) : null,
          planNameKey: row.plan_name_key ? String(row.plan_name_key) : null,
          ownerEmail: row.owner_email ? String(row.owner_email) : null,
          ownerName: row.owner_email ? `${row.first_name} ${row.last_name}` : null,
          seatsUsed: num(seatRows[0]?.total),
          seatLimit: num(row.seat_limit) > 0 ? num(row.seat_limit) + num(row.extra_seats) : null,
          campaignIncluded: campaignIncluded(row.plan_code ? String(row.plan_code) : null, optionalNum(row.campaign_included ?? row.included_campaign_contacts)),
          campaignIncludedOverride: optionalNum(row.campaign_included),
          modules: modules.map((item) => String(item.module_code)),
          addons: addons.map((item) => String(item.addon_code)),
          wizard,
          createdAt: iso(row.created_at),
        },
      });
    } catch (error) {
      console.error("[tenant]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/command/tenants/:id", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      const id = Number(req.params.id);
      const current = await queryRows(`SELECT id, name, status FROM tenants WHERE id = ? LIMIT 1`, [id]);
      if (!current[0]) return deny(res, 404, "errors.notFound");
      const body = req.body || {};
      if (body.notes != null && !requirePerm(user, "tenants.write", res)) return;
      if (body.status === "suspended" && !requirePerm(user, "tenants.suspend", res)) return;
      if ((body.status === "active" || body.status === "trial" || body.planCode || body.extendTrialDays || body.markStartFeePaid || body.campaignIncluded !== undefined) && !requirePerm(user, "tenants.billing", res)) return;
      const hasChange = body.notes != null || body.status || body.planCode || body.extendTrialDays || body.markStartFeePaid || body.campaignIncluded !== undefined;
      if (!hasChange) return deny(res, 400, "validation.wizard");
      if (body.status && !["trial", "active", "suspended"].includes(body.status)) return deny(res, 400, "validation.wizard");
      if (body.planCode) {
        const plans = await queryRows(`SELECT id, is_quote FROM plans WHERE code = ? LIMIT 1`, [String(body.planCode)]);
        if (!plans[0]) return deny(res, 400, "validation.wizard");
        const planId = num(plans[0].id);
        const subscription = await queryRows(`SELECT stripe_subscription_id, trial_ends_at FROM tenant_subscriptions WHERE tenant_id = ? LIMIT 1`, [id]);
        const subscriptionId = subscription[0]?.stripe_subscription_id ? String(subscription[0].stripe_subscription_id) : "";
        if (subscriptionId && !Boolean(plans[0].is_quote)) {
          const stripe = stripeOrNull();
          if (!stripe) return deny(res, 503, "errors.stripe");
          const priced = await priceForPlan(stripe, String(body.planCode));
          if (!priced) return deny(res, 409, "errors.billing.notIncluded");
          try {
            await retargetSubscription(stripe, subscriptionId, priced.priceId);
          } catch (error) {
            console.error("[tenant.plan]", error instanceof Error ? error.message : error);
            return deny(res, 402, "errors.billing.card");
          }
        }
        await database().execute(`UPDATE tenants SET plan_id = ? WHERE id = ?`, [planId, id]);
        await database().execute(`UPDATE tenant_subscriptions SET plan_id = ? WHERE tenant_id = ?`, [planId, id]);
        await database().execute(
          `UPDATE tenant_modules SET enabled = 0
            WHERE tenant_id = ? AND module_code NOT IN (SELECT module_code FROM plan_modules WHERE plan_id = ?)`,
          [id, planId],
        );
        await database().execute(
          `INSERT INTO tenant_modules (tenant_id, module_code, enabled)
           SELECT ?, module_code, IF(module_code = 'campaigns', 0, 1) FROM plan_modules WHERE plan_id = ?
           ON DUPLICATE KEY UPDATE enabled = IF(tenant_modules.module_code = 'campaigns', tenant_modules.enabled, 1)`,
          [id, planId],
        );
        await clearDisabledTaskReminders(id);
      }
      if (body.extendTrialDays) {
        const days = Math.min(90, Math.max(1, Math.floor(Number(body.extendTrialDays))));
        await database().execute(
          `UPDATE tenants
              SET status = 'trial',
                  trial_ends_at = DATE_ADD(GREATEST(COALESCE(trial_ends_at, NOW()), NOW()), INTERVAL ${days} DAY)
            WHERE id = ?`,
          [id],
        );
        await database().execute(
          `UPDATE tenant_subscriptions
              SET status = 'trial',
                  trial_ends_at = DATE_ADD(GREATEST(COALESCE(trial_ends_at, NOW()), NOW()), INTERVAL ${days} DAY)
            WHERE tenant_id = ?`,
          [id],
        );
      }
      if (body.status && !body.extendTrialDays) {
        await database().execute(`UPDATE tenants SET status = ? WHERE id = ?`, [body.status, id]);
        if (body.status === "active" || body.status === "trial") {
          await database().execute(`UPDATE tenant_subscriptions SET status = ? WHERE tenant_id = ?`, [body.status === "active" ? "active" : "trial", id]);
        }
      }
      if (body.markStartFeePaid) {
        await database().execute(
          `UPDATE tenant_subscriptions SET start_fee_status = 'paid' WHERE tenant_id = ? AND start_fee_cents > 0`,
          [id],
        );
      }
      if (body.notes != null) {
        await database().execute(`UPDATE tenants SET notes = ? WHERE id = ?`, [String(body.notes).slice(0, 4000), id]);
      }
      if (body.campaignIncluded !== undefined) {
        if (body.campaignIncluded === null || body.campaignIncluded === "") {
          await database().execute(`UPDATE tenant_subscriptions SET campaign_included = NULL WHERE tenant_id = ?`, [id]);
        } else {
          const value = Math.floor(Number(body.campaignIncluded));
          if (!Number.isFinite(value) || value < 100 || value > 100000) return deny(res, 400, "validation.wizard");
          await database().execute(`UPDATE tenant_subscriptions SET campaign_included = ? WHERE tenant_id = ?`, [value, id]);
        }
      }
      await logActivity({
        tenantId: id,
        actorType: "platform",
        actorId: user.id,
        action: "tenant.updated",
        summary: `${user.email} updated ${current[0].name}`,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("[tenant.patch]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/command/campaigns", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "platform.read", res)) return;
      const ceiling = await campaignCeiling();
      const usedRows = await queryRows(`SELECT COUNT(DISTINCT email) AS used FROM campaign_contacts WHERE status = 'subscribed'`);
      res.json({ ok: true, ceiling, used: num(usedRows[0]?.used) });
    } catch (error) {
      console.error("[command.campaigns]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/command/campaigns", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.billing", res)) return;
      const ceiling = Math.floor(Number(req.body?.ceiling));
      const usedRows = await queryRows(`SELECT COUNT(DISTINCT email) AS used FROM campaign_contacts WHERE status = 'subscribed'`);
      const used = num(usedRows[0]?.used);
      if (!Number.isFinite(ceiling) || ceiling < Math.max(CAMPAIGN_CEILING, used) || ceiling > 500000) {
        return deny(res, 400, "errors.campaigns.ceiling");
      }
      await database().execute(
        `INSERT INTO platform_settings (setting_key, setting_value) VALUES ('campaign_contact_ceiling', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [String(ceiling)],
      );
      await logActivity({
        tenantId: null,
        actorType: "platform",
        actorId: user.id,
        action: "campaigns.ceiling",
        summary: `${user.email} set campaign capacity to ${ceiling}`,
      });
      res.json({ ok: true, ceiling, used });
    } catch (error) {
      console.error("[command.campaigns]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/command/activity", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "activity.read", res)) return;
      const grid = parseGridQuery(req.query as Record<string, unknown>, { created: "a.created_at" }, "created");
      const term = likeTerm(grid.search);
      const where = `WHERE (? = '' OR a.summary LIKE ? ESCAPE '\\\\' OR a.action LIKE ? ESCAPE '\\\\' OR t.name LIKE ? ESCAPE '\\\\')`;
      const params = [grid.search, term, term, term];
      const countRows = await queryRows(
        `SELECT COUNT(*) AS total FROM activity_log a LEFT JOIN tenants t ON t.id = a.tenant_id ${where}`,
        params,
      );
      const items = await queryRows(
        `SELECT a.id, a.tenant_id, a.actor_type, a.action, a.summary, a.created_at, t.name AS tenant_name
           FROM activity_log a LEFT JOIN tenants t ON t.id = a.tenant_id
           ${where}
          ORDER BY ${grid.orderBy} ${grid.dir}
          LIMIT ${grid.limit} OFFSET ${grid.offset}`,
        params,
      );
      res.json({
        ok: true,
        items: items.map((row): ActivityItem => ({
          id: num(row.id),
          tenantId: row.tenant_id == null ? null : num(row.tenant_id),
          tenantName: row.tenant_name ? String(row.tenant_name) : null,
          actorType: String(row.actor_type),
          action: String(row.action),
          summary: String(row.summary),
          createdAt: iso(row.created_at) || "",
        })),
        pagination: pagination(grid.page, grid.limit, num(countRows[0]?.total)),
      });
    } catch (error) {
      console.error("[activity]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  function legalCode(value: unknown): "terms" | "privacy" | null {
    const code = String(value || "");
    return code === "terms" || code === "privacy" ? code : null;
  }

  app.get("/api/public/legal/:code", async (req, res) => {
    const code = legalCode(req.params.code);
    if (!code) return deny(res, 404, "errors.notFound");
    try {
      const platformOnly = String(req.query.scope || "") === "platform";
      const officeSlug = String(req.query.office || "").trim().toLowerCase();
      if (!platformOnly && officeSlug) {
        const tenant = await officeBySlug(officeSlug);
        if (!tenant) return deny(res, 404, "errors.notFound");
        const rows = await queryRows(
          `SELECT body_md, updated_at FROM tenant_legal_pages WHERE tenant_id = ? AND code = ? LIMIT 1`,
          [num(tenant.id), code],
        );
        if (!rows[0]) return deny(res, 404, "errors.notFound");
        res.json({
          ok: true,
          page: { code, body: String(rows[0].body_md), updatedAt: iso(rows[0].updated_at), owner: "tenant" },
          tenant: { name: String(tenant.name) },
        });
        return;
      }
      if (!platformOnly) {
        const found = await publicTenant(requestHost(req));
        if (found === "hidden") return deny(res, 404, "errors.notFound");
        if (found !== "none") {
          const rows = await queryRows(
            `SELECT body_md, updated_at FROM tenant_legal_pages WHERE tenant_id = ? AND code = ? LIMIT 1`,
            [found.id, code],
          );
          if (!rows[0]) return deny(res, 404, "errors.notFound");
          res.json({
            ok: true,
            page: { code, body: String(rows[0].body_md), updatedAt: iso(rows[0].updated_at), owner: "tenant" },
            tenant: { name: found.name },
          });
          return;
        }
      }
      const rows = await queryRows(`SELECT code, body_md, updated_at FROM legal_pages WHERE code = ? LIMIT 1`, [code]);
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      res.json({ ok: true, page: { code, body: String(rows[0].body_md), updatedAt: iso(rows[0].updated_at), owner: "platform" } });
    } catch (error) {
      console.error("[legal]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/command/legal", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.write", res)) return;
      const rows = await queryRows(`SELECT code, body_md FROM legal_pages WHERE code IN ('terms', 'privacy')`);
      const byCode = new Map(rows.map((row) => [String(row.code), String(row.body_md)]));
      res.json({
        ok: true,
        pages: ["terms", "privacy"].map((code) => ({ code, body: byCode.get(code) || "" })),
      });
    } catch (error) {
      console.error("[legal]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/command/legal/:code", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.write", res)) return;
      const code = legalCode(req.params.code);
      const body = legalMarkdown(req.body?.body);
      if (!code || !body) return deny(res, 400, "validation.wizard");
      await database().execute(
        `INSERT INTO legal_pages (code, body_md) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE body_md = VALUES(body_md)`,
        [code, body],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[legal.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  function legalPages(rows: SqlRow[]) {
    const byCode = new Map(rows.map((row) => [String(row.code), String(row.body_md)]));
    return ["terms", "privacy"].map((code) => ({ code, body: byCode.get(code) || "" }));
  }

  async function saveTenantLegal(tenantId: number, code: "terms" | "privacy", body: string, actorType: string, actorId: number) {
    await database().execute(
      `INSERT INTO tenant_legal_pages (tenant_id, code, body_md) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE body_md = VALUES(body_md)`,
      [tenantId, code, body],
    );
    await logActivity({
      tenantId,
      actorType,
      actorId,
      action: "legal.updated",
      summary: code === "terms" ? "Updated the public terms" : "Updated the public privacy policy",
    });
  }

  app.get("/api/app/legal", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "settings.write", res)) return;
      const rows = await queryRows(
        `SELECT code, body_md FROM tenant_legal_pages WHERE tenant_id = ? AND code IN ('terms', 'privacy')`,
        [user.tenantId],
      );
      res.json({ ok: true, pages: legalPages(rows) });
    } catch (error) {
      console.error("[legal.app]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/app/legal/:code", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "settings.write", res)) return;
      const code = legalCode(req.params.code);
      const body = legalMarkdown(req.body?.body);
      if (!code || !body) return deny(res, 400, "validation.wizard");
      await saveTenantLegal(user.tenantId, code, body, "brokerage", user.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("[legal.app.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/command/tenants/:id/legal", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.write", res)) return;
      const tenantId = Math.floor(Number(req.params.id) || 0);
      const tenants = tenantId ? await queryRows(`SELECT id FROM tenants WHERE id = ? LIMIT 1`, [tenantId]) : [];
      if (!tenants[0]) return deny(res, 404, "errors.notFound");
      const rows = await queryRows(
        `SELECT code, body_md FROM tenant_legal_pages WHERE tenant_id = ? AND code IN ('terms', 'privacy')`,
        [tenantId],
      );
      res.json({ ok: true, pages: legalPages(rows) });
    } catch (error) {
      console.error("[legal.command]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/command/tenants/:id/legal/:code", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.write", res)) return;
      const tenantId = Math.floor(Number(req.params.id) || 0);
      const code = legalCode(req.params.code);
      const body = legalMarkdown(req.body?.body);
      if (!tenantId || !code || !body) return deny(res, 400, "validation.wizard");
      const tenants = await queryRows(`SELECT id FROM tenants WHERE id = ? LIMIT 1`, [tenantId]);
      if (!tenants[0]) return deny(res, 404, "errors.notFound");
      await saveTenantLegal(tenantId, code, body, "platform", user.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("[legal.command.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/dashboard", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const scope = clientScope(user.role);
      const clients = await queryRows(
        `SELECT COUNT(*) AS total FROM clients WHERE tenant_id = ? AND (? = 'all' OR assigned_user_id = ?)`,
        [user.tenantId, scope, user.id],
      );
      const loans = await queryRows(
        `SELECT COUNT(*) AS total FROM loans WHERE tenant_id = ? AND status = 'open' AND (? = 'all' OR assigned_user_id = ?)`,
        [user.tenantId, scope, user.id],
      );
      const taskModule = await queryRows(
        `SELECT 1 AS ok FROM tenant_modules WHERE tenant_id = ? AND module_code = 'tasks' AND enabled = 1 LIMIT 1`,
        [user.tenantId],
      );
      const tasks = taskModule[0]
        ? await queryRows(
          `SELECT COUNT(*) AS total FROM tasks t LEFT JOIN loans l ON l.id = t.loan_id
            WHERE t.tenant_id = ? AND t.status = 'open' AND ${taskBoardScope()}`,
          [user.tenantId, scope, user.id, user.id],
        )
        : [];
      const daysLeft = user.trialEndsAt ? Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / 86400_000) : null;
      const showOffice = user.role === "brokerage_owner" || user.role === "leadership";
      const [stages, recent, due, unread, seatRow] = await Promise.all([
        queryRows(
          `SELECT s.id, s.name, COUNT(l.id) AS total
             FROM pipeline_stages s
             LEFT JOIN loans l ON l.stage_id = s.id AND l.tenant_id = s.tenant_id AND l.status = 'open' AND (? = 'all' OR l.assigned_user_id = ?)
            WHERE s.tenant_id = ?
            GROUP BY s.id, s.name, s.sort_order
            ORDER BY s.sort_order, s.id`,
          [scope, user.id, user.tenantId],
        ),
        queryRows(
          `SELECT l.id, c.first_name, c.last_name, s.name AS stage_name, l.amount_cents, l.purpose
             FROM loans l
             JOIN clients c ON c.id = l.client_id
             LEFT JOIN pipeline_stages s ON s.id = l.stage_id
            WHERE l.tenant_id = ? AND l.status = 'open' AND (? = 'all' OR l.assigned_user_id = ?)
            ORDER BY l.updated_at DESC
            LIMIT 5`,
          [user.tenantId, scope, user.id],
        ),
        taskModule[0]
          ? queryRows(
            `SELECT t.id, t.title, t.due_at
               FROM tasks t
               LEFT JOIN loans l ON l.id = t.loan_id
              WHERE t.tenant_id = ? AND t.status = 'open' AND t.due_at IS NOT NULL AND t.due_at < DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 DAY)
                AND ${taskBoardScope()}
              ORDER BY t.due_at
              LIMIT 5`,
            [user.tenantId, scope, user.id, user.id],
          )
          : Promise.resolve([]),
        user.modules.includes("conversations")
          ? queryRows(
            `SELECT COALESCE(SUM(unread_count), 0) AS total
               FROM conversation_threads
              WHERE tenant_id = ? AND status = 'open' AND (? = 'all' OR assigned_user_id = ? OR assigned_user_id IS NULL)`,
            [user.tenantId, scope, user.id],
          )
          : Promise.resolve([]),
        showOffice
          ? queryRows(
            `SELECT p.seat_limit, p.is_quote, COALESCE(s.extra_seats, 0) AS extra_seats,
                    (SELECT COUNT(*) FROM tenant_users u WHERE u.tenant_id = s.tenant_id AND u.status = 'active') AS used
               FROM tenant_subscriptions s
               JOIN plans p ON p.id = s.plan_id
              WHERE s.tenant_id = ?
              LIMIT 1`,
            [user.tenantId],
          )
          : Promise.resolve([]),
      ]);
      const quoted = Boolean(seatRow[0]?.is_quote);
      const seatLimit = !seatRow[0] || quoted ? null : num(seatRow[0].seat_limit) + num(seatRow[0].extra_seats);
      res.json({
        ok: true,
        scope,
        clients: num(clients[0]?.total),
        openLoans: num(loans[0]?.total),
        openTasks: taskModule[0] ? num(tasks[0]?.total) : null,
        planCode: user.planCode,
        tenantStatus: user.tenantStatus,
        trialEndsAt: user.trialEndsAt,
        daysLeft,
        startFeeStatus: user.startFeeStatus,
        unread: user.modules.includes("conversations") ? num(unread[0]?.total) : null,
        seatsUsed: seatRow[0] ? num(seatRow[0].used) : null,
        seatLimit,
        stages: stages.map((row) => ({ id: num(row.id), name: String(row.name), count: num(row.total) })),
        dueTasks: taskModule[0]
          ? due.map((row) => ({ id: num(row.id), title: String(row.title), dueAt: iso(row.due_at) }))
          : null,
        recentLoans: recent.map((row) => ({
          id: num(row.id),
          name: `${row.first_name} ${row.last_name}`.trim(),
          stage: row.stage_name ? String(row.stage_name) : "",
          amountCents: num(row.amount_cents),
          purpose: String(row.purpose),
        })),
        ...(await officeSnapshot(user.tenantId, scope, user.id)),
      });
    } catch (error) {
      console.error("[dashboard]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/clients", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "clients.read", res)) return;
      const grid = parseGridQuery(req.query as Record<string, unknown>, {
        name: "c.last_name",
        email: "c.email",
        status: "c.status",
        created: "c.created_at",
      }, "created");
      const scope = clientScope(user.role);
      const term = likeTerm(grid.search);
      const where = `WHERE c.tenant_id = ? AND (? = 'all' OR c.assigned_user_id = ?)
        AND (? = '' OR c.first_name LIKE ? ESCAPE '\\\\' OR c.last_name LIKE ? ESCAPE '\\\\' OR c.email LIKE ? ESCAPE '\\\\' OR c.phone LIKE ? ESCAPE '\\\\')`;
      const params = [user.tenantId, scope, user.id, grid.search, term, term, term, term];
      if (wantsCsv(req.query as Record<string, unknown>)) {
        const rows = await queryRows(
          `SELECT c.first_name, c.last_name, c.email, c.phone, c.status FROM clients c ${where} ORDER BY ${grid.orderBy} ${grid.dir} LIMIT 2000`,
          params,
        );
        sendCsv(res, "clients.csv", ["First name", "Last name", "Email", "Phone", "Status"], rows.map((row) => [row.first_name, row.last_name, row.email, row.phone, row.status]));
        return;
      }
      const countRows = await queryRows(`SELECT COUNT(*) AS total FROM clients c ${where}`, params);
      const items = await queryRows(
        `SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.source, c.status, c.created_at
           FROM clients c ${where}
          ORDER BY ${grid.orderBy} ${grid.dir}
          LIMIT ${grid.limit} OFFSET ${grid.offset}`,
        params,
      );
      res.json({
        ok: true,
        items: items.map((row): ClientListItem => ({
          id: num(row.id),
          firstName: String(row.first_name),
          lastName: String(row.last_name),
          email: row.email ? String(row.email) : null,
          phone: row.phone ? String(row.phone) : null,
          source: row.source ? String(row.source) : null,
          status: String(row.status),
          createdAt: iso(row.created_at) || "",
        })),
        pagination: pagination(grid.page, grid.limit, num(countRows[0]?.total)),
      });
    } catch (error) {
      console.error("[clients]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/clients", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "clients.write", res) || !requireWritable(user, res)) return;
      const firstName = String(req.body?.firstName || "").trim().slice(0, 100);
      const lastName = String(req.body?.lastName || "").trim().slice(0, 100);
      const email = normalizeEmail(req.body?.email);
      const phone = String(req.body?.phone || "").trim().slice(0, 20);
      const source = String(req.body?.source || "").trim().slice(0, 80);
      if (firstName.length < 1 || lastName.length < 1) return deny(res, 400, "validation.wizard");
      const [inserted] = await database().execute(
        `INSERT INTO clients (tenant_id, assigned_user_id, first_name, last_name, email, phone, source, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'lead')`,
        [user.tenantId, user.id, firstName, lastName, email || null, phone || null, source || null],
      );
      await logActivity({
        tenantId: user.tenantId,
        actorType: "brokerage",
        actorId: user.id,
        action: "client.created",
        summary: `${firstName} ${lastName} added as a lead`,
      });
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      console.error("[clients.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  function loanCard(row: Record<string, unknown>): LoanBoardCard {
    return {
      id: num(row.id),
      clientId: num(row.client_id),
      clientName: `${row.first_name} ${row.last_name}`,
      purpose: String(row.purpose),
      amountCents: num(row.amount_cents),
      status: String(row.status),
      assigneeId: row.assigned_user_id == null ? null : num(row.assigned_user_id),
      assigneeName: row.of_first ? `${row.of_first} ${row.of_last}` : null,
      createdAt: iso(row.created_at) || "",
      address: [row.address_line, row.city].filter(Boolean).join(", "),
    };
  }

  function loanBoardFilter(user: NonNullable<Awaited<ReturnType<typeof sessionUser>>>, query: Record<string, unknown>) {
    const scope = clientScope(user.role);
    const search = clip(query.search, 80).trim();
    const term = likeTerm(search);
    const purpose = query.purpose === "purchase" || query.purpose === "refinance" ? String(query.purpose) : "";
    const assignee = scope === "all" ? Math.max(0, Math.floor(Number(query.assigneeId) || 0)) : 0;
    const days = query.range === "week" ? 7 : query.range === "month" ? 31 : 0;
    const where = `WHERE l.tenant_id = ? AND l.status <> 'archived'
      AND (? = 'all' OR l.assigned_user_id = ?)
      AND (? = 0 OR l.assigned_user_id = ?)
      AND (? = '' OR l.purpose = ?)
      AND (? = 0 OR l.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))
      AND (? = '' OR c.first_name LIKE ? ESCAPE '\\\\' OR c.last_name LIKE ? ESCAPE '\\\\')`;
    const params = [user.tenantId, scope, user.id, assignee, assignee, purpose, purpose, days, days, search, term, term];
    return { where, params, scope };
  }

  app.get("/api/app/loans", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "loans.read", res)) return;
      if (String(req.query.board || "") === "1") {
        if (!(await requireModule(user, "pipeline", res))) return;
        const filter = loanBoardFilter(user, req.query as Record<string, unknown>);
        const limit = Math.max(1, Math.min(40, Math.floor(Number(req.query.limit) || 20)));
        const cardSelect = `l.id, l.client_id, l.purpose, l.amount_cents, l.status, l.created_at, l.assigned_user_id, l.address_line, l.city,
          c.first_name, c.last_name, u.first_name AS of_first, u.last_name AS of_last`;
        if (req.query.stageId != null && String(req.query.stageId) !== "") {
          const stageId = Math.max(0, Math.floor(Number(req.query.stageId) || 0));
          const offset = Math.max(0, Math.floor(Number(req.query.offset) || 0));
          const countRows = await queryRows(
            `SELECT COUNT(*) AS total FROM loans l JOIN clients c ON c.id = l.client_id ${filter.where} AND COALESCE(l.stage_id, 0) = ?`,
            [...filter.params, stageId],
          );
          const items = await queryRows(
            `SELECT ${cardSelect}
               FROM loans l
               JOIN clients c ON c.id = l.client_id
               LEFT JOIN tenant_users u ON u.id = l.assigned_user_id
               ${filter.where} AND COALESCE(l.stage_id, 0) = ?
              ORDER BY l.created_at DESC, l.id DESC
              LIMIT ${limit} OFFSET ${offset}`,
            [...filter.params, stageId],
          );
          const total = num(countRows[0]?.total);
          const column: LoanBoardColumn = {
            id: stageId,
            name: "",
            isFunded: false,
            reminderOn: false,
            total,
            hasMore: offset + items.length < total,
            items: items.map((row) => loanCard(row)),
          };
          res.json({ ok: true, column });
          return;
        }
        const stages = await queryRows(
          `SELECT id, name, is_funded, code FROM pipeline_stages WHERE tenant_id = ? ORDER BY sort_order, id`,
          [user.tenantId],
        );
        const counts = await queryRows(
          `SELECT COALESCE(l.stage_id, 0) AS stage_id, COUNT(*) AS total
             FROM loans l JOIN clients c ON c.id = l.client_id ${filter.where}
            GROUP BY COALESCE(l.stage_id, 0)`,
          filter.params,
        );
        const reminders = await queryRows(
          `SELECT stage_id FROM reminder_flows WHERE tenant_id = ? AND enabled = 1 AND stage_id IS NOT NULL`,
          [user.tenantId],
        );
        const ranked = await queryRows(
          `SELECT * FROM (
             SELECT ${cardSelect}, COALESCE(l.stage_id, 0) AS board_stage,
                    ROW_NUMBER() OVER (PARTITION BY COALESCE(l.stage_id, 0) ORDER BY l.created_at DESC, l.id DESC) AS board_rn
               FROM loans l
               JOIN clients c ON c.id = l.client_id
               LEFT JOIN tenant_users u ON u.id = l.assigned_user_id
               ${filter.where}
           ) ranked
           WHERE ranked.board_rn <= ${limit}`,
          filter.params,
        );
        const countBy = new Map(counts.map((row) => [num(row.stage_id), num(row.total)]));
        const reminderOn = new Set(reminders.map((row) => num(row.stage_id)));
        const itemsBy = new Map<number, LoanBoardCard[]>();
        for (const row of ranked) {
          const id = num(row.board_stage);
          const list = itemsBy.get(id) || [];
          list.push(loanCard(row));
          itemsBy.set(id, list);
        }
        const columns: LoanBoardColumn[] = stages.map((stage) => {
          const id = num(stage.id);
          const total = countBy.get(id) || 0;
          const items = itemsBy.get(id) || [];
          return {
            id,
            name: String(stage.name),
            code: stage.code ? String(stage.code) : null,
            isFunded: num(stage.is_funded) === 1,
            reminderOn: reminderOn.has(id),
            total,
            hasMore: items.length < total,
            items,
          };
        });
        const loose = countBy.get(0) || 0;
        if (loose > 0) {
          const items = itemsBy.get(0) || [];
          columns.unshift({
            id: 0,
            name: "",
            isFunded: false,
            reminderOn: false,
            total: loose,
            hasMore: items.length < loose,
            items,
          });
        }
        const officers: LoanOfficerOption[] = filter.scope === "all"
          ? (await queryRows(
            `SELECT id, first_name, last_name FROM tenant_users
              WHERE tenant_id = ? AND status = 'active'
                AND role IN ('brokerage_owner', 'leadership', 'loan_officer', 'processor')
              ORDER BY last_name, first_name LIMIT 80`,
            [user.tenantId],
          )).map((row) => ({ id: num(row.id), name: `${row.first_name} ${row.last_name}` }))
          : [];
        res.json({ ok: true, columns, officers });
        return;
      }
      const grid = parseGridQuery(req.query as Record<string, unknown>, {
        client: "c.last_name",
        amount: "l.amount_cents",
        stage: "s.sort_order",
        created: "l.created_at",
      }, "created");
      const scope = clientScope(user.role);
      const term = likeTerm(grid.search);
      const where = `WHERE l.tenant_id = ? AND (? = 'all' OR l.assigned_user_id = ?)
        AND (? = '' OR c.first_name LIKE ? ESCAPE '\\\\' OR c.last_name LIKE ? ESCAPE '\\\\' OR s.name LIKE ? ESCAPE '\\\\')`;
      const params = [user.tenantId, scope, user.id, grid.search, term, term, term];
      const countRows = await queryRows(
        `SELECT COUNT(*) AS total FROM loans l JOIN clients c ON c.id = l.client_id LEFT JOIN pipeline_stages s ON s.id = l.stage_id ${where}`,
        params,
      );
      const items = await queryRows(
        `SELECT l.id, l.client_id, l.purpose, l.amount_cents, l.status, l.created_at, s.name AS stage_name,
                c.first_name, c.last_name
           FROM loans l
           JOIN clients c ON c.id = l.client_id
           LEFT JOIN pipeline_stages s ON s.id = l.stage_id
           ${where}
          ORDER BY ${grid.orderBy} ${grid.dir}
          LIMIT ${grid.limit} OFFSET ${grid.offset}`,
        params,
      );
      res.json({
        ok: true,
        items: items.map((row): LoanListItem => ({
          id: num(row.id),
          clientId: num(row.client_id),
          clientName: `${row.first_name} ${row.last_name}`,
          purpose: String(row.purpose),
          amountCents: num(row.amount_cents),
          stageName: row.stage_name ? String(row.stage_name) : null,
          status: String(row.status),
          createdAt: iso(row.created_at) || "",
        })),
        pagination: pagination(grid.page, grid.limit, num(countRows[0]?.total)),
      });
    } catch (error) {
      console.error("[loans]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/loans", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "loans.write", res) || !requireWritable(user, res)) return;
      const clientId = Number(req.body?.clientId);
      const purpose = req.body?.purpose === "refinance" ? "refinance" : "purchase";
      const amountCents = Math.max(0, Math.floor(Number(req.body?.amountCents) || 0));
      const owned = await queryRows(
        `SELECT id FROM clients WHERE id = ? AND tenant_id = ? AND (? = 'all' OR assigned_user_id = ?) LIMIT 1`,
        [clientId, user.tenantId, clientScope(user.role), user.id],
      );
      if (!owned[0]) return deny(res, 404, "errors.notFound");
      const loanCap = await assertAllowance(user.tenantId, "loans", 1);
      if (loanCap) return deny(res, loanCap === "errors.billing.notIncluded" ? 403 : 409, loanCap);
      const stages = await queryRows(
        `SELECT id FROM pipeline_stages WHERE tenant_id = ? ORDER BY sort_order LIMIT 1`,
        [user.tenantId],
      );
      const facts = loanFacts(req.body);
      const [inserted] = await database().execute(
        `INSERT INTO loans (tenant_id, client_id, assigned_user_id, stage_id, purpose, amount_cents, property_value_cents, down_payment_cents, property_type, address_line, city, region, postal_code, employer, job_title, annual_income_cents, income_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
        [user.tenantId, clientId, user.id, stages[0] ? num(stages[0].id) : null, purpose, amountCents, facts.value, facts.down, facts.propertyType, facts.address, facts.city, facts.region, facts.postal, facts.employer, facts.job, facts.income, facts.incomeType],
      );
      const loanId = num((inserted as { insertId?: number }).insertId);
      if (stages[0]) {
        try {
          await enterLoanStage(user.tenantId, loanId, num(stages[0].id));
        } catch (error) {
          console.error("[flows.enter]", error instanceof Error ? error.message : error);
        }
      }
      for (const [code, label] of COMPLIANCE_ITEMS) {
        await database().execute(
          `INSERT INTO compliance_items (tenant_id, loan_id, code, label, status) VALUES (?, ?, ?, ?, 'pending')`,
          [user.tenantId, loanId, code, label],
        );
      }
      await seedLoanChecklist(user.tenantId, loanId);
      await logActivity({
        tenantId: user.tenantId,
        actorType: "brokerage",
        actorId: user.id,
        action: "loan.created",
        summary: `Opened a ${purpose} file`,
      });
      res.status(201).json({ ok: true, id: loanId });
    } catch (error) {
      console.error("[loans.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/team", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "team.read", res)) return;
      const grid = parseGridQuery(req.query as Record<string, unknown>, {
        name: "last_name",
        email: "email",
        role: "role",
      }, "name");
      const term = likeTerm(grid.search);
      const where = `WHERE tenant_id = ? AND (? = '' OR first_name LIKE ? ESCAPE '\\\\' OR last_name LIKE ? ESCAPE '\\\\' OR email LIKE ? ESCAPE '\\\\')`;
      const params = [user.tenantId, grid.search, term, term, term];
      if (wantsCsv(req.query as Record<string, unknown>)) {
        const rows = await queryRows(
          `SELECT first_name, last_name, email, role, status FROM tenant_users ${where} ORDER BY ${grid.orderBy} ${grid.dir} LIMIT 2000`,
          params,
        );
        sendCsv(res, "team.csv", ["First name", "Last name", "Email", "Role", "Status"], rows.map((row) => [row.first_name, row.last_name, row.email, row.role, row.status]));
        return;
      }
      const countRows = await queryRows(`SELECT COUNT(*) AS total FROM tenant_users ${where}`, params);
      const items = await queryRows(
        `SELECT id, first_name, last_name, email, role, status, last_login_at, public_slug FROM tenant_users ${where}
          ORDER BY ${grid.orderBy} ${grid.dir} LIMIT ${grid.limit} OFFSET ${grid.offset}`,
        params,
      );
      for (const row of items) {
        if (!row.public_slug) row.public_slug = await ensurePersonSlug(user.tenantId, num(row.id));
      }
      res.json({
        ok: true,
        items: items.map((row): TeamMember => ({
          id: num(row.id),
          firstName: String(row.first_name),
          lastName: String(row.last_name),
          email: String(row.email),
          role: String(row.role),
          status: String(row.status),
          lastLoginAt: iso(row.last_login_at),
          publicSlug: row.public_slug ? String(row.public_slug) : "",
        })),
        pagination: pagination(grid.page, grid.limit, num(countRows[0]?.total)),
      });
    } catch (error) {
      console.error("[team]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/team", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "team.manage", res) || !requireWritable(user, res)) return;
      const firstName = String(req.body?.firstName || "").trim().slice(0, 100);
      const lastName = String(req.body?.lastName || "").trim().slice(0, 100);
      const email = normalizeEmail(req.body?.email);
      const role = String(req.body?.role || "");
      const allowed = ["leadership", "loan_officer", "processor", "partner"];
      if (!firstName || !lastName || !EMAIL_RE.test(email) || !allowed.includes(role)) return deny(res, 400, "validation.wizard");
      if (await findAccount(email)) return deny(res, 409, "errors.accountExists");
      const seats = await queryRows(
        `SELECT s.extra_seats, p.seat_limit, p.is_quote
           FROM tenant_subscriptions s JOIN plans p ON p.id = s.plan_id
          WHERE s.tenant_id = ? LIMIT 1`,
        [user.tenantId],
      );
      const used = await queryRows(`SELECT COUNT(*) AS total FROM tenant_users WHERE tenant_id = ? AND status = 'active'`, [user.tenantId]);
      const quoted = Boolean(seats[0]?.is_quote);
      const limit = quoted ? 0 : num(seats[0]?.seat_limit) + num(seats[0]?.extra_seats);
      if (!quoted && limit > 0 && num(used[0]?.total) >= limit) return deny(res, 409, "errors.seatLimit");
      const [inserted] = await database().execute(
        `INSERT INTO tenant_users (tenant_id, email, first_name, last_name, role, status) VALUES (?, ?, ?, ?, ?, 'active')`,
        [user.tenantId, email, firstName, lastName, role],
      );
      const id = num((inserted as { insertId?: number }).insertId);
      await ensurePersonSlug(user.tenantId, id);
      try {
        await issueOtp("brokerage", id, email, req.ip || "", "invite", {
          firstName,
          inviter: user.firstName,
          brokerage: user.tenantName || APP_NAME,
        }, publicOrigin(req));
      } catch (error) {
        console.error("[team] otp", error instanceof Error ? error.message : error);
      }
      await logActivity({
        tenantId: user.tenantId,
        actorType: "brokerage",
        actorId: user.id,
        action: "team.invited",
        summary: `${email} invited as ${role}`,
      });
      res.status(201).json({ ok: true, id });
    } catch (error) {
      console.error("[team.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/brand", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.read");
      if (!user?.tenantId) return;
      const rows = await queryRows(
        `SELECT name, phone, nmls, address_line, city, region, postal_code, letter_hold, support_email, primary_color, brand_radius, brand_headline, custom_domain, logo_url, favicon_url
           FROM tenants WHERE id = ? LIMIT 1`,
        [user.tenantId],
      );
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      const row = rows[0];
      res.json({
        ok: true,
        brand: {
          name: String(row.name || ""),
          phone: row.phone ? String(row.phone) : "",
          nmls: row.nmls ? String(row.nmls) : "",
          addressLine: row.address_line ? String(row.address_line) : "",
          city: row.city ? String(row.city) : "",
          region: row.region ? String(row.region) : "",
          postalCode: row.postal_code ? String(row.postal_code) : "",
          letterHold: Boolean(row.letter_hold),
          supportEmail: row.support_email ? String(row.support_email) : "",
          primaryColor: normalizeHex(row.primary_color),
          brandRadius: row.brand_radius ? String(row.brand_radius) : "soft",
          brandHeadline: row.brand_headline ? String(row.brand_headline) : "serif",
          customDomain: row.custom_domain ? String(row.custom_domain) : null,
          logoUrl: row.logo_url ? String(row.logo_url) : null,
          faviconUrl: row.favicon_url ? String(row.favicon_url) : null,
        },
      });
    } catch (error) {
      console.error("[brand.read]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/brand/asset", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId) return;
      const kind = req.body?.kind === "favicon" ? "favicon" : req.body?.kind === "logo" ? "logo" : "";
      if (!kind) return deny(res, 400, "errors.brand.file");
      const column = kind === "favicon" ? "favicon_url" : "logo_url";
      if (req.body?.clear === true) {
        await database().execute(`UPDATE tenants SET ${column} = NULL WHERE id = ?`, [user.tenantId]);
        res.json({ ok: true, url: null });
        return;
      }
      const file = readImageUpload(req.body?.dataUrl, kind);
      if ("error" in file) return deny(res, 400, file.error);
      const url = await storeBrandFile(user.tenantId, kind, file);
      if (!url) return deny(res, 503, "errors.blob");
      await database().execute(`UPDATE tenants SET ${column} = ? WHERE id = ?`, [url, user.tenantId]);
      res.json({ ok: true, url });
    } catch (error) {
      console.error("[brand.asset]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/brand", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "settings.write", res) || !requireWritable(user, res)) return;
      const name = String(req.body?.name || "").trim().slice(0, 160);
      const phone = String(req.body?.phone || "").trim().slice(0, 20);
      const nmls = String(req.body?.nmls || "").trim().slice(0, 40);
      const addressLine = String(req.body?.addressLine || "").trim().slice(0, 160);
      const city = String(req.body?.city || "").trim().slice(0, 80);
      const region = String(req.body?.region || "").trim().slice(0, 40);
      const postalCode = String(req.body?.postalCode || "").trim().slice(0, 20);
      const letterHold = req.body?.letterHold === true ? 1 : 0;
      const supportEmail = normalizeEmail(req.body?.supportEmail);
      const brand = parseBrand({ accent: req.body?.primaryColor, radius: req.body?.brandRadius, headline: req.body?.brandHeadline });
      const primaryColor = String(req.body?.primaryColor || "").trim();
      if (name.length < 2) return deny(res, 400, "validation.wizard");
      if (primaryColor && !brand) return deny(res, 400, "validation.color");
      if (supportEmail && !EMAIL_RE.test(supportEmail)) return deny(res, 400, "validation.email");
      const canOwnDomain = user.planCode === "scale" || user.planCode === "custom";
      let customDomain: string | null | undefined;
      if (canOwnDomain && req.body?.customDomain !== undefined) {
        const raw = String(req.body.customDomain || "").trim();
        customDomain = raw ? normalizeHostname(raw) : null;
        if (raw && !customDomain) return deny(res, 400, "validation.domain");
        if (customDomain) {
          const taken = await queryRows(`SELECT id FROM tenants WHERE custom_domain = ? AND id <> ? LIMIT 1`, [customDomain, user.tenantId]);
          if (taken.length) return deny(res, 409, "errors.duplicate");
        }
      }
      const office = [nmls || null, addressLine || null, city || null, region || null, postalCode || null, letterHold];
      await database().execute(
        `UPDATE tenants SET name = ?, phone = ?, nmls = ?, address_line = ?, city = ?, region = ?, postal_code = ?, letter_hold = ?, support_email = ?, primary_color = ?, brand_radius = ?, brand_headline = ?${customDomain !== undefined ? ", custom_domain = ?" : ""} WHERE id = ?`,
        customDomain !== undefined
          ? [name, phone || null, ...office, supportEmail || null, brand?.accent ?? (primaryColor || null), brand?.radius ?? "soft", brand?.headline ?? "serif", customDomain, user.tenantId]
          : [name, phone || null, ...office, supportEmail || null, brand?.accent ?? (primaryColor || null), brand?.radius ?? "soft", brand?.headline ?? "serif", user.tenantId],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[brand]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/profile", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const rows = await queryRows(
        `SELECT first_name, last_name, email, phone, photo_url, nmls, bio, timezone, specializations, public_slug, website_url, linkedin_url, facebook_url, instagram_url, youtube_url, notify_email, notify_sms, notify_also, notify_events
           FROM tenant_users WHERE id = ? AND tenant_id = ? LIMIT 1`,
        [user.id, user.tenantId],
      );
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      const publicSlug = rows[0].public_slug ? String(rows[0].public_slug) : await ensurePersonSlug(user.tenantId, user.id);
      const row = rows[0];
      const unread = user.modules.includes("conversations")
        ? await queryRows(
          `SELECT COALESCE(SUM(unread_count), 0) AS total FROM conversation_threads WHERE tenant_id = ? AND status = 'open' AND (assigned_user_id = ? OR assigned_user_id IS NULL)`,
          [user.tenantId, user.id],
        )
        : [];
      res.json({
        ok: true,
        profile: {
          firstName: String(row.first_name),
          lastName: String(row.last_name),
          email: String(row.email),
          phone: row.phone ? String(row.phone) : "",
          photoUrl: row.photo_url ? String(row.photo_url) : null,
          nmls: row.nmls ? String(row.nmls) : "",
          bio: row.bio ? String(row.bio) : "",
          timezone: row.timezone ? String(row.timezone) : "",
          specializations: String(row.specializations || "").split(",").map((item) => item.trim()).filter((item) => PROFILE_FOCUS.includes(item)),
          publicSlug,
          website: row.website_url ? String(row.website_url) : "",
          linkedin: row.linkedin_url ? String(row.linkedin_url) : "",
          facebook: row.facebook_url ? String(row.facebook_url) : "",
          instagram: row.instagram_url ? String(row.instagram_url) : "",
          youtube: row.youtube_url ? String(row.youtube_url) : "",
          notifyEmail: row.notify_email == null ? true : Boolean(row.notify_email),
          notifySms: Boolean(row.notify_sms),
          notifyAlso: row.notify_also ? String(row.notify_also) : "",
          notifyEvents: String(row.notify_events || "application,voicemail,sms,booking,reminder").split(",").map((item) => item.trim()).filter((item) => NOTIFY_EVENTS.includes(item)),
          unread: num(unread[0]?.total),
          host: user.tenantSlug ? tenantHost(user.tenantSlug) : "",
        },
      });
    } catch (error) {
      console.error("[profile.read]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/profile", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const firstName = String(req.body?.firstName || "").trim().slice(0, 100);
      const lastName = String(req.body?.lastName || "").trim().slice(0, 100);
      const phone = String(req.body?.phone || "").trim().slice(0, 20);
      const nmls = String(req.body?.nmls || "").trim().slice(0, 40);
      const bio = String(req.body?.bio || "").trim().slice(0, 500);
      const timezone = PROFILE_ZONES.includes(String(req.body?.timezone || "")) ? String(req.body.timezone) : "";
      const language = req.body?.language === "es" ? "es" : "en";
      const focus = Array.isArray(req.body?.specializations)
        ? req.body.specializations.map((item: unknown) => String(item)).filter((item: string) => PROFILE_FOCUS.includes(item))
        : [];
      const notifyAlso = String(req.body?.notifyAlso || "").trim().slice(0, 255);
      const events = Array.isArray(req.body?.notifyEvents)
        ? req.body.notifyEvents.map((item: unknown) => String(item)).filter((item: string) => NOTIFY_EVENTS.includes(item))
        : ["application", "voicemail", "sms", "booking", "reminder"];
      const website = publicUrl(req.body?.website);
      const linkedin = publicUrl(req.body?.linkedin);
      const facebook = publicUrl(req.body?.facebook);
      const instagram = publicUrl(req.body?.instagram);
      const youtube = publicUrl(req.body?.youtube);
      const rawSlug = String(req.body?.publicSlug || "").trim().toLowerCase();
      const publicSlug = rawSlug ? rawSlug : null;
      if (!firstName || !lastName) return deny(res, 400, "validation.wizard");
      if (publicSlug && !slugOk(publicSlug)) return deny(res, 400, "validation.slug");
      if (publicSlug) {
        const taken = await queryRows(`SELECT id FROM tenant_users WHERE tenant_id = ? AND public_slug = ? AND id <> ? LIMIT 1`, [user.tenantId, publicSlug, user.id]);
        if (taken.length) return deny(res, 409, "errors.duplicate");
      }
      await database().execute(
        `UPDATE tenant_users
            SET first_name = ?, last_name = ?, phone = ?, nmls = ?, bio = ?, timezone = ?, specializations = ?, public_slug = ?, website_url = ?, linkedin_url = ?, facebook_url = ?, instagram_url = ?, youtube_url = ?, notify_email = ?, notify_sms = ?, notify_also = ?, notify_events = ?, preferred_language = ?
          WHERE id = ? AND tenant_id = ?`,
        [firstName, lastName, phone || null, nmls || null, bio || null, timezone || null, focus.join(",") || null, publicSlug, website, linkedin, facebook, instagram, youtube, req.body?.notifyEmail === false ? 0 : 1, req.body?.notifySms === true ? 1 : 0, notifyAlso || null, events.join(","), language, user.id, user.tenantId],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[profile]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/profile/photo", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (req.body?.clear === true) {
        await database().execute(`UPDATE tenant_users SET photo_url = NULL WHERE id = ? AND tenant_id = ?`, [user.id, user.tenantId]);
        res.json({ ok: true, url: null });
        return;
      }
      const file = readImageUpload(req.body?.dataUrl, "logo");
      if ("error" in file) return deny(res, 400, file.error);
      const url = await storeBrandFile(user.tenantId, `profile-${user.id}`, file);
      if (!url) return deny(res, 503, "errors.blob");
      await database().execute(`UPDATE tenant_users SET photo_url = ? WHERE id = ? AND tenant_id = ?`, [url, user.id, user.tenantId]);
      res.json({ ok: true, url });
    } catch (error) {
      console.error("[profile.photo]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/filters", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const screen = String(req.query.screen || "").slice(0, 40);
      if (!screen) return deny(res, 400, "validation.wizard");
      const rows = await queryRows(
        `SELECT id, name, query_json FROM saved_filters WHERE tenant_id = ? AND user_id = ? AND screen = ? ORDER BY id DESC`,
        [user.tenantId, user.id, screen],
      );
      res.json({
        ok: true,
        items: rows.map((row) => ({
          id: num(row.id),
          name: String(row.name),
          query: typeof row.query_json === "string" ? JSON.parse(row.query_json) : row.query_json,
        })),
      });
    } catch (error) {
      console.error("[filters]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/filters", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const screen = String(req.body?.screen || "").trim().slice(0, 40);
      const name = String(req.body?.name || "").trim().slice(0, 80);
      const query = req.body?.query && typeof req.body.query === "object" ? req.body.query : null;
      if (!screen || name.length < 2 || !query) return deny(res, 400, "validation.wizard");
      const [inserted] = await database().execute(
        `INSERT INTO saved_filters (tenant_id, user_id, screen, name, query_json) VALUES (?, ?, ?, ?, ?)`,
        [user.tenantId, user.id, screen, name, JSON.stringify(query)],
      );
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      console.error("[filters.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.delete("/api/app/filters/:id", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      await database().execute(`DELETE FROM saved_filters WHERE id = ? AND tenant_id = ? AND user_id = ?`, [Number(req.params.id) || 0, user.tenantId, user.id]);
      res.json({ ok: true });
    } catch (error) {
      console.error("[filters.delete]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/letters", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const rows = await queryRows(`SELECT letter_hold FROM tenants WHERE id = ? LIMIT 1`, [user.tenantId]);
      res.json({ ok: true, hold: Boolean(rows[0]?.letter_hold) });
    } catch (error) {
      console.error("[letters]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/site", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.read");
      if (!user?.tenantId) return;
      const tenant = await queryRows(`SELECT name, slug FROM tenants WHERE id = ? LIMIT 1`, [user.tenantId]);
      const name = tenant[0]?.name ? String(tenant[0].name) : APP_NAME;
      const rows = await queryRows(`SELECT code, title, body_md FROM tenant_site_pages WHERE tenant_id = ?`, [user.tenantId]);
      const saved = new Map(rows.map((row) => [String(row.code), row]));
      res.json({
        ok: true,
        slug: tenant[0]?.slug ? String(tenant[0].slug) : "",
        pages: SITE_CODES.map((code) => {
          const row = saved.get(code);
          const fallback = defaultSitePage(code, name);
          return { code, title: row ? String(row.title) : fallback.title, body: row ? String(row.body_md) : fallback.body };
        }),
      });
    } catch (error) {
      console.error("[site.read]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/app/site", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId) return;
      const pages = Array.isArray(req.body?.pages) ? req.body.pages : [];
      for (const page of pages) {
        const code = String(page?.code || "");
        if (!SITE_CODES.includes(code as typeof SITE_CODES[number])) continue;
        const title = String(page?.title || "").trim().slice(0, 160);
        const body = String(page?.body || "").trim().slice(0, 8000);
        if (title.length < 2 || body.length < 2) return deny(res, 400, "validation.wizard");
        await database().execute(
          `INSERT INTO tenant_site_pages (tenant_id, code, title, body_md) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title = VALUES(title), body_md = VALUES(body_md)`,
          [user.tenantId, code, title, body],
        );
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[site.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/public/site/:slug", async (req, res) => {
    try {
      const slug = String(req.params.slug || "").slice(0, 80);
      const rows = await queryRows(
        `SELECT id, name, slug, phone, nmls, address_line, city, region, postal_code, support_email, primary_color, logo_url
           FROM tenants WHERE slug = ? AND status <> 'suspended' LIMIT 1`,
        [slug],
      );
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      const tenant = rows[0];
      const pages = await queryRows(`SELECT code, title, body_md FROM tenant_site_pages WHERE tenant_id = ?`, [num(tenant.id)]);
      const saved = new Map(pages.map((row) => [String(row.code), row]));
      const name = String(tenant.name);
      const people = await queryRows(
        `SELECT first_name, last_name, photo_url, nmls, bio, public_slug, specializations
           FROM tenant_users WHERE tenant_id = ? AND status = 'active' AND public_slug IS NOT NULL ORDER BY first_name LIMIT 12`,
        [num(tenant.id)],
      );
      res.json({
        ok: true,
        name,
        slug: String(tenant.slug),
        phone: tenant.phone ? String(tenant.phone) : "",
        nmls: tenant.nmls ? String(tenant.nmls) : "",
        address: [tenant.address_line, tenant.city, tenant.region, tenant.postal_code].filter(Boolean).map(String).join(", "),
        supportEmail: tenant.support_email ? String(tenant.support_email) : "",
        primaryColor: normalizeHex(tenant.primary_color),
        logoUrl: tenant.logo_url ? String(tenant.logo_url) : null,
        pages: SITE_CODES.map((code) => {
          const row = saved.get(code);
          const fallback = defaultSitePage(code, name);
          return { code, title: row ? String(row.title) : fallback.title, body: row ? String(row.body_md) : fallback.body };
        }),
        people: people.map((row) => ({
          name: `${row.first_name} ${row.last_name}`.trim(),
          photoUrl: row.photo_url ? String(row.photo_url) : null,
          nmls: row.nmls ? String(row.nmls) : "",
          bio: row.bio ? String(row.bio) : "",
          slug: String(row.public_slug),
        })),
      });
    } catch (error) {
      console.error("[site.public]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/public/site/:slug/contact", async (req, res) => {
    try {
      const slug = String(req.params.slug || "").slice(0, 80);
      const rows = await queryRows(`SELECT id FROM tenants WHERE slug = ? AND status <> 'suspended' LIMIT 1`, [slug]);
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      const firstName = String(req.body?.firstName || "").trim().slice(0, 100);
      const lastName = String(req.body?.lastName || "").trim().slice(0, 100);
      const email = normalizeEmail(req.body?.email);
      const phone = String(req.body?.phone || "").trim().slice(0, 20);
      const message = String(req.body?.message || "").trim().slice(0, 2000);
      if (!firstName || !lastName || !EMAIL_RE.test(email) || message.length < 2) return deny(res, 400, "validation.wizard");
      await database().execute(
        `INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, kind, notes, status) VALUES (?, ?, ?, ?, ?, 'person', ?, 'active')`,
        [num(rows[0].id), firstName, lastName, email, phone || null, message],
      );
      res.status(201).json({ ok: true });
    } catch (error) {
      console.error("[site.contact]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  async function officeBySlug(slug: string) {
    const rows = await queryRows(
      `SELECT id, name, slug, phone, support_email, nmls, address_line, city, region, postal_code, primary_color, logo_url, status
         FROM tenants WHERE slug = ? AND status <> 'suspended' LIMIT 1`,
      [slug.slice(0, 80)],
    );
    return rows[0] || null;
  }

  async function publicPerson(tenantId: number, officerSlug: string) {
    if (!officerSlug) return null;
    const rows = await queryRows(
      `SELECT id, first_name, last_name, email, phone, photo_url, nmls, bio, role, specializations, website_url, linkedin_url, facebook_url, instagram_url, youtube_url
         FROM tenant_users WHERE tenant_id = ? AND (public_slug = ? OR apply_token = ?) AND status = 'active' LIMIT 1`,
      [tenantId, officerSlug, officerSlug],
    );
    return rows[0] || null;
  }

  function personCard(row: SqlRow) {
    return {
      name: `${row.first_name} ${row.last_name}`,
      photoUrl: row.photo_url ? String(row.photo_url) : null,
      nmls: row.nmls ? String(row.nmls) : "",
      bio: row.bio ? String(row.bio) : "",
      email: row.email ? String(row.email) : "",
      phone: row.phone ? String(row.phone) : "",
      role: row.role ? String(row.role) : "loan_officer",
      specializations: String(row.specializations || "").split(",").map((item) => item.trim()).filter(Boolean),
      links: {
        website: row.website_url ? String(row.website_url) : "",
        linkedin: row.linkedin_url ? String(row.linkedin_url) : "",
        facebook: row.facebook_url ? String(row.facebook_url) : "",
        instagram: row.instagram_url ? String(row.instagram_url) : "",
        youtube: row.youtube_url ? String(row.youtube_url) : "",
      },
    };
  }

  async function personApplyLink(req: Request, tenantId: number, personSlug: string) {
    const tenant = await queryRows(`SELECT slug FROM tenants WHERE id = ? LIMIT 1`, [tenantId]);
    return `${appOrigin(req)}/apply/${tenant[0]?.slug || ""}/${personSlug}`;
  }

  app.get("/api/public/office/:slug", async (req, res) => {
    try {
      const tenant = await officeBySlug(String(req.params.slug || ""));
      if (!tenant) return deny(res, 404, "errors.notFound");
      const officerSlug = clip(req.query.officer, 48).toLowerCase();
      const officer = officerSlug ? await publicPerson(num(tenant.id), officerSlug) : null;
      if (officerSlug && !officer) return deny(res, 404, "errors.notFound");
      res.json({
        ok: true,
        name: String(tenant.name),
        slug: String(tenant.slug),
        phone: tenant.phone ? String(tenant.phone) : "",
        email: tenant.support_email ? String(tenant.support_email) : "",
        nmls: tenant.nmls ? String(tenant.nmls) : "",
        address: [tenant.address_line, tenant.city, tenant.region, tenant.postal_code].filter(Boolean).map(String).join(", "),
        primaryColor: normalizeHex(tenant.primary_color),
        logoUrl: tenant.logo_url ? String(tenant.logo_url) : null,
        officer: officer ? personCard(officer) : null,
      });
    } catch (error) {
      console.error("[office.public]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/public/apply/:slug", async (req, res) => {
    try {
      const tenant = await officeBySlug(String(req.params.slug || ""));
      if (!tenant) return deny(res, 404, "errors.notFound");
      const firstName = clip(req.body?.firstName, 100);
      const lastName = clip(req.body?.lastName, 100);
      const email = normalizeEmail(req.body?.email);
      const purpose = req.body?.purpose === "refinance" ? "refinance" : "purchase";
      const amountCents = Math.max(0, Math.floor(Number(req.body?.amountCents) || 0));
      if (firstName.length < 1 || lastName.length < 1 || !EMAIL_RE.test(email)) return deny(res, 400, "validation.wizard");
      const loanCap = await assertAllowance(num(tenant.id), "loans", 1);
      if (loanCap) return deny(res, loanCap === "errors.billing.notIncluded" ? 403 : 409, loanCap);
      const officerSlug = clip(req.body?.officer, 48).toLowerCase();
      const officer = officerSlug ? await publicPerson(num(tenant.id), officerSlug) : null;
      if (officerSlug && !officer) return deny(res, 404, "errors.notFound");
      const bankerId = officer ? num(officer.id) : null;
      const birthday = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.birthday || "")) ? String(req.body.birthday).slice(0, 10) : null;
      const facts = loanFacts(req.body);
      const [clientInsert] = await database().execute(
        `INSERT INTO clients (tenant_id, assigned_user_id, first_name, last_name, email, phone, birthday, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'public_wizard', 'lead')`,
        [num(tenant.id), bankerId, firstName, lastName, email, clip(req.body?.phone, 20) || null, birthday],
      );
      const clientId = num((clientInsert as { insertId?: number }).insertId);
      const stages = await queryRows(`SELECT id FROM pipeline_stages WHERE tenant_id = ? AND code = 'draft' ORDER BY sort_order LIMIT 1`, [num(tenant.id)]);
      const fallback = stages[0] ? stages : await queryRows(`SELECT id FROM pipeline_stages WHERE tenant_id = ? ORDER BY sort_order LIMIT 1`, [num(tenant.id)]);
      const [loanInsert] = await database().execute(
        `INSERT INTO loans (tenant_id, client_id, assigned_user_id, stage_id, purpose, amount_cents, property_value_cents, down_payment_cents, property_type, address_line, city, region, postal_code, employer, job_title, annual_income_cents, income_type, application_on, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_DATE(), 'open')`,
        [num(tenant.id), clientId, bankerId, fallback[0] ? num(fallback[0].id) : null, purpose, amountCents, facts.value, facts.down, facts.propertyType, facts.address, facts.city, facts.region, facts.postal, facts.employer, facts.job, facts.income, facts.incomeType],
      );
      const loanId = num((loanInsert as { insertId?: number }).insertId);
      for (const [code, label] of COMPLIANCE_ITEMS) {
        await database().execute(`INSERT INTO compliance_items (tenant_id, loan_id, code, label, status) VALUES (?, ?, ?, ?, 'pending')`, [num(tenant.id), loanId, code, label]);
      }
      await seedLoanChecklist(num(tenant.id), loanId);
      const draftToken = clip(req.body?.draftToken, 40);
      if (draftToken) await database().execute(`DELETE FROM apply_drafts WHERE token = ? AND tenant_id = ?`, [draftToken, num(tenant.id)]);
      const officerName = officer ? `${officer.first_name || ""} ${officer.last_name || ""}`.trim() : "";
      const welcomed = await welcomeApplicant({
        req,
        tenantId: num(tenant.id),
        clientId,
        loanId,
        assigned: bankerId,
        email,
        firstName,
        lastName,
        phone: clip(req.body?.phone, 20) || null,
        address: facts.address,
        city: facts.city,
        region: facts.region,
        postal: facts.postal,
        purpose,
        officerName,
        language: req.body?.language === "es" ? "es" : "en",
      });
      void notifyApplication(num(tenant.id), `${firstName} ${lastName}`);
      res.status(201).json({ ok: true, id: loanId, welcomed });
    } catch (error) {
      console.error("[apply.public]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/public/apply/:slug/draft", async (req, res) => {
    try {
      const tenant = await officeBySlug(String(req.params.slug || ""));
      if (!tenant) return deny(res, 404, "errors.notFound");
      const token = clip(req.query.token, 40);
      if (!token) return res.json({ ok: true, draft: null });
      const rows = await queryRows(`SELECT step, payload_json FROM apply_drafts WHERE token = ? AND tenant_id = ? LIMIT 1`, [token, num(tenant.id)]);
      if (!rows[0]) return res.json({ ok: true, draft: null });
      let payload: unknown = {};
      try { payload = JSON.parse(String(rows[0].payload_json || "{}")); } catch { payload = {}; }
      res.json({ ok: true, draft: { token, step: num(rows[0].step), payload } });
    } catch (error) {
      console.error("[apply.draft]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/public/apply/:slug/draft", async (req, res) => {
    try {
      const tenant = await officeBySlug(String(req.params.slug || ""));
      if (!tenant) return deny(res, 404, "errors.notFound");
      const token = clip(req.body?.token, 40) || crypto.randomBytes(9).toString("hex");
      const step = Math.max(0, Math.min(6, Math.floor(Number(req.body?.step) || 0)));
      const payload = JSON.stringify(req.body?.payload || {}).slice(0, 20000);
      await database().execute(
        `INSERT INTO apply_drafts (token, tenant_id, officer_slug, step, payload_json) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE step = VALUES(step), payload_json = VALUES(payload_json), officer_slug = VALUES(officer_slug)`,
        [token, num(tenant.id), clip(req.body?.officer, 48) || null, step, payload],
      );
      res.json({ ok: true, token });
    } catch (error) {
      console.error("[apply.draft.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/public/analyze/:slug", async (req, res) => {
    try {
      const tenant = await officeBySlug(String(req.params.slug || ""));
      if (!tenant) return deny(res, 404, "errors.notFound");
      const firstName = clip(req.body?.firstName, 100);
      const lastName = clip(req.body?.lastName, 100);
      const email = normalizeEmail(req.body?.email);
      if (firstName.length < 1 || lastName.length < 1 || !EMAIL_RE.test(email)) return deny(res, 400, "validation.wizard");
      const officerSlug = clip(req.body?.officer, 48).toLowerCase();
      const officer = officerSlug ? await publicPerson(num(tenant.id), officerSlug) : null;
      if (officerSlug && !officer) return deny(res, 404, "errors.notFound");
      const bankerId = officer ? num(officer.id) : null;
      const loanCap = await assertAllowance(num(tenant.id), "loans", 1);
      if (loanCap) return deny(res, loanCap === "errors.billing.notIncluded" ? 403 : 409, loanCap);
      const [clientInsert] = await database().execute(
        `INSERT INTO clients (tenant_id, assigned_user_id, first_name, last_name, email, phone, source, status) VALUES (?, ?, ?, ?, ?, ?, 'public_wizard', 'lead')`,
        [num(tenant.id), bankerId, firstName, lastName, email, clip(req.body?.phone, 20) || null],
      );
      const clientId = num((clientInsert as { insertId?: number }).insertId);
      const stages = await queryRows(`SELECT id FROM pipeline_stages WHERE tenant_id = ? AND code = 'draft' ORDER BY sort_order LIMIT 1`, [num(tenant.id)]);
      const [loanInsert] = await database().execute(
        `INSERT INTO loans (tenant_id, client_id, assigned_user_id, stage_id, purpose, amount_cents, application_on, status) VALUES (?, ?, ?, ?, 'purchase', 0, UTC_DATE(), 'open')`,
        [num(tenant.id), clientId, bankerId, stages[0] ? num(stages[0].id) : null],
      );
      const loanId = num((loanInsert as { insertId?: number }).insertId);
      const saved = await insertCredit(num(tenant.id), { ...req.body, clientId, loanId }, null);
      if (saved.error) return deny(res, saved.status, saved.error);
      void notifyApplication(num(tenant.id), `${firstName} ${lastName}`);
      res.status(201).json({ ok: true, id: loanId });
    } catch (error) {
      console.error("[analyze.public]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/public/book/:slug/slots", async (req, res) => {
    try {
      const tenant = await officeBySlug(String(req.params.slug || ""));
      if (!tenant) return deny(res, 404, "errors.notFound");
      const date = String(req.query.date || "").slice(0, 10);
      const officerSlug = clip(req.query.officer, 48).toLowerCase();
      const officer = officerSlug ? await publicPerson(num(tenant.id), officerSlug) : null;
      if (officerSlug && !officer) return deny(res, 404, "errors.notFound");
      const slots = await openSlots(num(tenant.id), officer ? num(officer.id) : null, date);
      res.json({ ok: true, slots });
    } catch (error) {
      console.error("[book.slots]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/public/book/move", async (req, res) => {
    try {
      const token = clip(req.body?.token, 40);
      const starts = String(req.body?.startsAt || "");
      if (!token || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(starts)) return deny(res, 400, "validation.wizard");
      const rows = await queryRows(`SELECT id, tenant_id, user_id FROM appointments WHERE public_token = ? LIMIT 1`, [token]);
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      const slots = await openSlots(num(rows[0].tenant_id), rows[0].user_id == null ? null : num(rows[0].user_id), starts.slice(0, 10));
      if (!slots.includes(starts)) return deny(res, 400, "validation.wizard");
      await database().execute(`UPDATE appointments SET starts_at = ?, status = 'requested' WHERE id = ?`, [starts.replace("T", " "), rows[0].id]);
      res.json({ ok: true });
    } catch (error) {
      console.error("[book.move]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/public/book/:slug", async (req, res) => {
    try {
      const tenant = await officeBySlug(String(req.params.slug || ""));
      if (!tenant) return deny(res, 404, "errors.notFound");
      const name = clip(`${req.body?.firstName || ""} ${req.body?.lastName || ""}`.trim(), 160);
      const email = normalizeEmail(req.body?.email);
      const starts = String(req.body?.startsAt || "");
      if (name.length < 2 || !EMAIL_RE.test(email) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(starts)) return deny(res, 400, "validation.wizard");
      const officerSlug = clip(req.body?.officer, 48).toLowerCase();
      const officer = officerSlug ? await publicPerson(num(tenant.id), officerSlug) : null;
      if (officerSlug && !officer) return deny(res, 404, "errors.notFound");
      const userId = officer ? num(officer.id) : null;
      const slots = await openSlots(num(tenant.id), userId, starts.slice(0, 10));
      if (!slots.includes(starts)) return deny(res, 400, "validation.wizard");
      const token = crypto.randomBytes(9).toString("hex");
      await database().execute(
        `INSERT INTO appointments (tenant_id, user_id, public_token, name, email, phone, starts_at, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested')`,
        [num(tenant.id), userId, token, name, email, clip(req.body?.phone, 20) || null, starts.replace("T", " "), clip(req.body?.note, 500) || null],
      );
      void notifyStaff(num(tenant.id), "booking", `New booking for ${tenant.name}`, `${name} asked for ${starts.replace("T", " ")}.`).catch((error) => {
        console.error("[book.notify]", error instanceof Error ? error.message : error);
      });
      res.status(201).json({ ok: true, token });
    } catch (error) {
      console.error("[book.public]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/office", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "brokerage" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const menu = await loadMenu(user.tenantId, user.modules);
      const items: OfficeNavItem[] = [];
      for (const section of menu.sections) {
        const role = menu.roles.find((row) => row.role === user.role && row.sectionId === section.id);
        const visible = sectionVisible({
          role: user.role,
          sectionId: section.id,
          module: section.module,
          modules: user.modules,
          hidden: section.hidden,
          roleVisible: role ? role.visible : null,
        });
        if (!visible) continue;
        items.push({ id: section.id, label: section.customLabel, group: section.group, sort: section.sort });
      }
      items.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
      res.json({ ok: true, items });
    } catch (error) {
      console.error("[office]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/office/menu", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write");
      if (!user?.tenantId) return;
      const menu = await loadMenu(user.tenantId, user.modules);
      res.json({ ok: true, ...menu });
    } catch (error) {
      console.error("[office.menu]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/office/menu", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId) return;
      if (!(await saveOfficeMenu(user.tenantId, req.body))) return deny(res, 400, "validation.wizard");
      await logActivity({ tenantId: user.tenantId, actorType: "brokerage", actorId: user.id, action: "office.menu", summary: "Updated the office menu" });
      res.json({ ok: true });
    } catch (error) {
      console.error("[office.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/command/tenants/:id/menu", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "platform") return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.read", res)) return;
      const tenantId = Number(req.params.id);
      const modules = await tenantModules(tenantId);
      res.json({ ok: true, ...(await loadMenu(tenantId, modules)) });
    } catch (error) {
      console.error("[command.menu]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/command/tenants/:id/menu", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "platform") return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.write", res)) return;
      const tenantId = Number(req.params.id);
      const exists = await queryRows(`SELECT id FROM tenants WHERE id = ? LIMIT 1`, [tenantId]);
      if (!exists[0]) return deny(res, 404, "errors.notFound");
      if (!(await saveOfficeMenu(tenantId, req.body))) return deny(res, 400, "validation.wizard");
      await logActivity({ tenantId, actorType: "platform", actorId: user.id, action: "office.menu", summary: "Command center updated the office menu" });
      res.json({ ok: true });
    } catch (error) {
      console.error("[command.menu.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/stages", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.read");
      if (!user?.tenantId || !(await requireModule(user, "pipeline", res))) return;
      const rows = await queryRows(
        `SELECT id, name, sort_order, is_funded, code FROM pipeline_stages WHERE tenant_id = ? ORDER BY sort_order, id`,
        [user.tenantId],
      );
      res.json({
        ok: true,
        items: rows.map((row): StageItem => ({
          id: num(row.id),
          name: String(row.name),
          code: row.code ? String(row.code) : null,
          sort: num(row.sort_order),
          isFunded: num(row.is_funded) === 1,
        })),
      });
    } catch (error) {
      console.error("[stages]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/stages", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.write", true);
      if (!user?.tenantId || !(await requireModule(user, "pipeline", res))) return;
      const name = clip(req.body?.name, 80);
      if (name.length < 2) return deny(res, 400, "validation.wizard");
      const maxRow = await queryRows(`SELECT COALESCE(MAX(sort_order), 0) AS top FROM pipeline_stages WHERE tenant_id = ?`, [user.tenantId]);
      const [inserted] = await database().execute(
        `INSERT INTO pipeline_stages (tenant_id, name, sort_order, is_funded) VALUES (?, ?, ?, ?)`,
        [user.tenantId, name, num(maxRow[0]?.top) + 10, req.body?.isFunded ? 1 : 0],
      );
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      console.error("[stages.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/stages/reorder", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.write", true);
      if (!user?.tenantId || !(await requireModule(user, "pipeline", res))) return;
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id: unknown) => Math.floor(Number(id))).filter((id: number) => id > 0) : [];
      const owned = await queryRows(`SELECT id FROM pipeline_stages WHERE tenant_id = ?`, [user.tenantId]);
      const known = new Set(owned.map((row) => num(row.id)));
      if (!ids.length || ids.length !== known.size || ids.some((id: number) => !known.has(id))) return deny(res, 400, "validation.wizard");
      for (let index = 0; index < ids.length; index += 1) {
        await database().execute(`UPDATE pipeline_stages SET sort_order = ? WHERE id = ? AND tenant_id = ?`, [(index + 1) * 10, ids[index], user.tenantId]);
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[stages.reorder]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/stages/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.write", true);
      if (!user?.tenantId || !(await requireModule(user, "pipeline", res))) return;
      const name = clip(req.body?.name, 80);
      if (name.length < 2) return deny(res, 400, "validation.wizard");
      const [updated] = await database().execute(
        `UPDATE pipeline_stages SET name = ?, is_funded = ? WHERE id = ? AND tenant_id = ?`,
        [name, req.body?.isFunded ? 1 : 0, Number(req.params.id), user.tenantId],
      );
      if (num((updated as { affectedRows?: number }).affectedRows) !== 1) return deny(res, 404, "errors.notFound");
      res.json({ ok: true });
    } catch (error) {
      console.error("[stages.patch]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/loans/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.write", true);
      if (!user?.tenantId || !(await requireModule(user, "pipeline", res))) return;
      if (!canMoveStage(user.role)) return deny(res, 403, "errors.loan.banker");
      const stageId = Math.floor(Number(req.body?.stageId));
      const scope = clientScope(user.role);
      const stage = await queryRows(`SELECT id, is_funded FROM pipeline_stages WHERE id = ? AND tenant_id = ? LIMIT 1`, [stageId, user.tenantId]);
      if (!stage[0]) return deny(res, 404, "errors.notFound");
      const current = await queryRows(
        `SELECT id, status, stage_id FROM loans WHERE id = ? AND tenant_id = ? AND (? = 'all' OR assigned_user_id = ?) LIMIT 1`,
        [Number(req.params.id), user.tenantId, scope, user.id],
      );
      if (!current[0]) return deny(res, 404, "errors.notFound");
      const move = loanStageMove(String(current[0].status), num(stage[0].is_funded) === 1);
      if (move.checkOpenCap) {
        const cap = await assertAllowance(user.tenantId, "loans", 1);
        if (cap) return deny(res, cap === "errors.billing.notIncluded" ? 403 : 409, cap);
      }
      if (num(current[0].stage_id) === stageId && String(current[0].status) === move.status) {
        res.json({ ok: true, status: move.status });
        return;
      }
      const [updated] = await database().execute(
        `UPDATE loans SET stage_id = ?, status = ? WHERE id = ? AND tenant_id = ? AND (? = 'all' OR assigned_user_id = ?)`,
        [stageId, move.status, Number(req.params.id), user.tenantId, scope, user.id],
      );
      if (num((updated as { affectedRows?: number }).affectedRows) !== 1) return deny(res, 404, "errors.notFound");
      if (num(current[0].stage_id) !== stageId) {
        try {
          await enterLoanStage(user.tenantId, Number(req.params.id), stageId);
        } catch (error) {
          console.error("[flows.enter]", error instanceof Error ? error.message : error);
        }
      }
      res.json({ ok: true, status: move.status });
    } catch (error) {
      console.error("[loans.stage]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  async function loadLoanFile(tenantId: number, loanId: number, scope: string, userId: number) {
    const rows = await queryRows(
      `SELECT l.*, c.first_name, c.last_name, c.email AS client_email, c.phone AS client_phone, c.birthday, c.source,
              s.name AS stage_name, b.first_name AS banker_first, b.last_name AS banker_last,
              p.first_name AS partner_first, p.last_name AS partner_last,
              r.first_name AS realtor_first, r.last_name AS realtor_last,
              t.letter_hold, t.nmls, t.name AS brokerage_name
         FROM loans l
         JOIN clients c ON c.id = l.client_id
         JOIN tenants t ON t.id = l.tenant_id
         LEFT JOIN pipeline_stages s ON s.id = l.stage_id
         LEFT JOIN tenant_users b ON b.id = l.assigned_user_id
         LEFT JOIN tenant_users p ON p.id = l.partner_user_id
         LEFT JOIN realtors r ON r.id = l.realtor_id
        WHERE l.id = ? AND l.tenant_id = ? AND (? = 'all' OR l.assigned_user_id = ?)
        LIMIT 1`,
      [loanId, tenantId, scope, userId],
    );
    return rows[0] || null;
  }

  function loanFileJson(row: Record<string, unknown>, tasks: Record<string, unknown>[], documents: Record<string, unknown>[], compliance: Record<string, unknown>[]) {
    const amount = num(row.amount_cents);
    const value = num(row.property_value_cents);
    const openTasks = tasks.filter((task) => String(task.status) !== "done").length;
    const held = num(row.letter_hold) === 1 && openTasks > 0;
    return {
      id: num(row.id),
      purpose: String(row.purpose),
      amountCents: amount,
      propertyValueCents: value,
      downPaymentCents: num(row.down_payment_cents),
      ltv: value > 0 ? Math.round((amount / value) * 1000) / 10 : null,
      propertyType: String(row.property_type || "single_family"),
      addressLine: row.address_line ? String(row.address_line) : "",
      city: row.city ? String(row.city) : "",
      region: row.region ? String(row.region) : "",
      postalCode: row.postal_code ? String(row.postal_code) : "",
      employer: row.employer ? String(row.employer) : "",
      jobTitle: row.job_title ? String(row.job_title) : "",
      annualIncomeCents: num(row.annual_income_cents),
      applicationOn: row.application_on ? String(row.application_on).slice(0, 10) : "",
      submittedOn: row.submitted_on ? String(row.submitted_on).slice(0, 10) : "",
      estCloseOn: row.est_close_on ? String(row.est_close_on).slice(0, 10) : "",
      updatedAt: iso(row.updated_at) || "",
      createdAt: iso(row.created_at) || "",
      status: String(row.status),
      stageId: row.stage_id == null ? null : num(row.stage_id),
      stageName: row.stage_name ? String(row.stage_name) : "",
      client: {
        id: num(row.client_id),
        firstName: String(row.first_name),
        lastName: String(row.last_name),
        email: row.client_email ? String(row.client_email) : "",
        phone: row.client_phone ? String(row.client_phone) : "",
        source: row.source ? String(row.source) : "",
      },
      bankerId: row.assigned_user_id == null ? null : num(row.assigned_user_id),
      bankerName: row.banker_first ? `${row.banker_first} ${row.banker_last}` : "",
      partnerId: row.partner_user_id == null ? null : num(row.partner_user_id),
      partnerName: row.partner_first ? `${row.partner_first} ${row.partner_last}` : "",
      realtorId: row.realtor_id == null ? null : num(row.realtor_id),
      realtorName: row.realtor_first ? `${row.realtor_first} ${row.realtor_last}` : "",
      letter: {
        amountCents: num(row.preapproval_cents),
        maxCents: num(row.preapproval_max_cents),
        expiresOn: row.preapproval_expires_on ? String(row.preapproval_expires_on).slice(0, 10) : "",
        active: num(row.letter_active) === 1 && !held,
        held,
      },
      tasks: tasks.map((task) => ({
        id: num(task.id),
        title: String(task.title),
        detail: task.detail ? String(task.detail) : "",
        category: task.category ? String(task.category) : "",
        status: String(task.status),
        priority: String(task.priority || "normal"),
        dueOn: task.due_on ? String(task.due_on).slice(0, 10) : "",
      })),
      documents: documents.map((item) => ({ id: num(item.id), name: String(item.name), status: String(item.status) })),
      compliance: compliance.map((item) => ({ id: num(item.id), code: String(item.code), label: String(item.label), status: String(item.status), dueOn: item.due_on ? String(item.due_on).slice(0, 10) : "" })),
    };
  }

  app.get("/api/app/loans/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.read");
      if (!user?.tenantId || !(await requireModule(user, "pipeline", res))) return;
      const scope = clientScope(user.role);
      const row = await loadLoanFile(user.tenantId, Number(req.params.id), scope, user.id);
      if (!row) return deny(res, 404, "errors.notFound");
      const [tasks, documents, compliance, people, stages, realtors] = await Promise.all([
        queryRows(`SELECT id, title, detail, category, status, priority, due_on FROM tasks WHERE tenant_id = ? AND loan_id = ? ORDER BY id`, [user.tenantId, row.id]),
        queryRows(`SELECT id, name, status FROM loan_documents WHERE tenant_id = ? AND loan_id = ? ORDER BY id`, [user.tenantId, row.id]),
        queryRows(`SELECT id, code, label, status, due_on FROM compliance_items WHERE tenant_id = ? AND loan_id = ? ORDER BY id`, [user.tenantId, row.id]),
        queryRows(`SELECT id, first_name, last_name, role FROM tenant_users WHERE tenant_id = ? AND status = 'active' AND role IN ('brokerage_owner','leadership','loan_officer','partner') ORDER BY first_name`, [user.tenantId]),
        queryRows(`SELECT id, name FROM pipeline_stages WHERE tenant_id = ? ORDER BY sort_order, id`, [user.tenantId]),
        queryRows(`SELECT id, first_name, last_name FROM realtors WHERE tenant_id = ? AND status <> 'archived' ORDER BY first_name LIMIT 80`, [user.tenantId]),
      ]);
      res.json({
        ok: true,
        loan: loanFileJson(row, tasks, documents, compliance),
        canMove: canMoveStage(user.role),
        people: people.map((person) => ({ id: num(person.id), name: `${person.first_name} ${person.last_name}`, role: String(person.role) })),
        stages: stages.map((stage) => ({ id: num(stage.id), name: String(stage.name) })),
        realtors: realtors.map((realtor) => ({ id: num(realtor.id), name: `${realtor.first_name} ${realtor.last_name}` })),
      });
    } catch (error) {
      console.error("[loan.file]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/app/loans/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.write", true);
      if (!user?.tenantId || !(await requireModule(user, "pipeline", res))) return;
      const scope = clientScope(user.role);
      const row = await loadLoanFile(user.tenantId, Number(req.params.id), scope, user.id);
      if (!row) return deny(res, 404, "errors.notFound");
      const body = req.body || {};
      const propertyType = PROPERTY_TYPES.includes(String(body.propertyType)) ? String(body.propertyType) : String(row.property_type || "single_family");
      const day = (value: unknown, fallback: unknown) => {
        const text = String(value ?? fallback ?? "").slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
      };
      const bankerId = Math.floor(Number(body.bankerId ?? row.assigned_user_id) || 0);
      const partnerId = Math.floor(Number(body.partnerId ?? row.partner_user_id) || 0);
      const realtorId = Math.floor(Number(body.realtorId ?? row.realtor_id) || 0);
      if (bankerId) {
        const member = await queryRows(`SELECT id FROM tenant_users WHERE id = ? AND tenant_id = ? AND role IN ('brokerage_owner','leadership','loan_officer') LIMIT 1`, [bankerId, user.tenantId]);
        if (!member[0]) return deny(res, 400, "validation.wizard");
      }
      if (partnerId) {
        const member = await queryRows(`SELECT id FROM tenant_users WHERE id = ? AND tenant_id = ? AND role = 'partner' LIMIT 1`, [partnerId, user.tenantId]);
        if (!member[0]) return deny(res, 400, "validation.wizard");
      }
      const openTasks = await queryRows(`SELECT COUNT(*) AS total FROM tasks WHERE tenant_id = ? AND loan_id = ? AND status <> 'done'`, [user.tenantId, row.id]);
      const held = num(row.letter_hold) === 1 && num(openTasks[0]?.total) > 0;
      let letterActive = body.letterActive === true || (body.letterActive == null && num(row.letter_active) === 1);
      if (held && letterActive) return deny(res, 409, "errors.letters.hold");
      if (held) letterActive = false;
      const stageId = body.stageId == null ? num(row.stage_id) : Math.floor(Number(body.stageId));
      if (stageId && stageId !== num(row.stage_id)) {
        if (!canMoveStage(user.role)) return deny(res, 403, "errors.loan.banker");
        const stage = await queryRows(`SELECT id, is_funded FROM pipeline_stages WHERE id = ? AND tenant_id = ? LIMIT 1`, [stageId, user.tenantId]);
        if (!stage[0]) return deny(res, 404, "errors.notFound");
        const move = loanStageMove(String(row.status), num(stage[0].is_funded) === 1);
        await database().execute(`UPDATE loans SET stage_id = ?, status = ? WHERE id = ? AND tenant_id = ?`, [stageId, move.status, row.id, user.tenantId]);
        try { await enterLoanStage(user.tenantId, num(row.id), stageId); } catch (error) {
          console.error("[flows.enter]", error instanceof Error ? error.message : error);
        }
      }
      await database().execute(
        `UPDATE loans SET amount_cents = ?, property_value_cents = ?, down_payment_cents = ?, property_type = ?,
            address_line = ?, city = ?, region = ?, postal_code = ?, employer = ?, job_title = ?, annual_income_cents = ?, application_on = ?, submitted_on = ?, est_close_on = ?,
            assigned_user_id = ?, partner_user_id = ?, realtor_id = ?, preapproval_cents = ?, preapproval_max_cents = ?,
            preapproval_expires_on = ?, letter_active = ?
          WHERE id = ? AND tenant_id = ?`,
        [
          Math.max(0, Math.floor(Number(body.amountCents ?? row.amount_cents) || 0)),
          Math.max(0, Math.floor(Number(body.propertyValueCents ?? row.property_value_cents) || 0)),
          Math.max(0, Math.floor(Number(body.downPaymentCents ?? row.down_payment_cents) || 0)),
          propertyType,
          clip(body.addressLine ?? row.address_line, 160) || null,
          clip(body.city ?? row.city, 80) || null,
          clip(body.region ?? row.region, 40) || null,
          clip(body.postalCode ?? row.postal_code, 20) || null,
          clip(body.employer ?? row.employer, 160) || null,
          clip(body.jobTitle ?? row.job_title, 120) || null,
          Math.max(0, Math.floor(Number(body.annualIncomeCents ?? row.annual_income_cents) || 0)),
          day(body.applicationOn, row.application_on),
          day(body.submittedOn, row.submitted_on),
          day(body.estCloseOn, row.est_close_on),
          bankerId || null,
          partnerId || null,
          realtorId || null,
          Math.max(0, Math.floor(Number(body.preapprovalCents ?? row.preapproval_cents) || 0)),
          Math.max(0, Math.floor(Number(body.preapprovalMaxCents ?? row.preapproval_max_cents) || 0)),
          day(body.preapprovalExpiresOn, row.preapproval_expires_on),
          letterActive ? 1 : 0,
          row.id,
          user.tenantId,
        ],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[loan.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/loans/:id/mismo", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.read");
      if (!user?.tenantId) return;
      const row = await loadLoanFile(user.tenantId, Number(req.params.id), clientScope(user.role), user.id);
      if (!row) return deny(res, 404, "errors.notFound");
      const openTasks = await queryRows(`SELECT COUNT(*) AS total FROM tasks WHERE tenant_id = ? AND loan_id = ? AND status <> 'done'`, [user.tenantId, row.id]);
      if (num(row.letter_hold) === 1 && num(openTasks[0]?.total) > 0) return deny(res, 409, "errors.letters.hold");
      const xml = mismoDocument(row);
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Content-Disposition", `attachment; filename="loan-${num(row.id)}.xml"`);
      res.send(xml);
    } catch (error) {
      console.error("[loan.mismo]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/loans/:id/packet", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.read");
      if (!user?.tenantId) return;
      const row = await loadLoanFile(user.tenantId, Number(req.params.id), clientScope(user.role), user.id);
      if (!row) return deny(res, 404, "errors.notFound");
      const openTasks = await queryRows(`SELECT COUNT(*) AS total FROM tasks WHERE tenant_id = ? AND loan_id = ? AND status <> 'done'`, [user.tenantId, row.id]);
      if (num(row.letter_hold) === 1 && num(openTasks[0]?.total) > 0) return deny(res, 409, "errors.letters.hold");
      const documents = await queryRows(`SELECT name, status FROM loan_documents WHERE tenant_id = ? AND loan_id = ? ORDER BY id`, [user.tenantId, row.id]);
      const tasks = await queryRows(`SELECT title, status FROM tasks WHERE tenant_id = ? AND loan_id = ? ORDER BY id`, [user.tenantId, row.id]);
      const lines = [
        `${row.first_name} ${row.last_name}`,
        `File ${num(row.id)}`,
        "",
        "Documents",
        ...documents.map((item) => `${item.name} (${item.status})`),
        "",
        "Checklist",
        ...tasks.map((item) => `${item.title} (${item.status})`),
      ];
      const pdf = simplePdf(lines.length ? lines : ["No documents on this file."]);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="loan-${num(row.id)}-packet.pdf"`);
      res.send(pdf);
    } catch (error) {
      console.error("[loan.packet]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/reports", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "reports.read");
      if (!user?.tenantId || !(await requireModule(user, "dashboard", res))) return;
      const scope = clientScope(user.role);
      const totals = await queryRows(
        `SELECT
            SUM(status = 'open') AS open_loans,
            SUM(status = 'funded') AS funded,
            AVG(CASE WHEN status = 'funded' THEN DATEDIFF(updated_at, created_at) END) AS avg_days
           FROM loans WHERE tenant_id = ? AND (? = 'all' OR assigned_user_id = ?)`,
        [user.tenantId, scope, user.id],
      );
      const openLoans = num(totals[0]?.open_loans);
      const funded = num(totals[0]?.funded);
      const officers = await queryRows(
        `SELECT u.first_name, u.last_name,
                SUM(l.status = 'open') AS open_loans,
                SUM(l.status = 'funded') AS funded
           FROM tenant_users u
           LEFT JOIN loans l ON l.assigned_user_id = u.id AND l.tenant_id = u.tenant_id
          WHERE u.tenant_id = ? AND (? = 'all' OR u.id = ?)
          GROUP BY u.id, u.first_name, u.last_name
          ORDER BY u.last_name`,
        [user.tenantId, scope, user.id],
      );
      const snapshot: ReportSnapshot = {
        openLoans,
        funded,
        conversionPct: openLoans + funded > 0 ? Math.round((funded / (openLoans + funded)) * 1000) / 10 : 0,
        avgDaysToClose: totals[0]?.avg_days == null ? null : Math.round(num(totals[0].avg_days)),
        officers: officers.map((row) => ({
          name: `${row.first_name} ${row.last_name}`,
          openLoans: num(row.open_loans),
          funded: num(row.funded),
        })),
        sources: [],
      };
      const sourceRows = await queryRows(
        `SELECT COALESCE(NULLIF(source, ''), 'other') AS code, COUNT(*) AS total
           FROM clients WHERE tenant_id = ? AND (? = 'all' OR assigned_user_id = ?)
          GROUP BY code`,
        [user.tenantId, scope, user.id],
      );
      const sourceCount = new Map(sourceRows.map((row) => [String(row.code), num(row.total)]));
      const sourceTotal = [...sourceCount.values()].reduce((sum, count) => sum + count, 0);
      snapshot.sources = LEAD_SOURCES.map((code) => ({
        code,
        count: sourceCount.get(code) || 0,
        share: sourceTotal > 0 ? Math.round(((sourceCount.get(code) || 0) / sourceTotal) * 1000) / 10 : 0,
      }));
      const depth = await officeSnapshot(user.tenantId, scope, user.id);
      snapshot.purposes = depth.purposes;
      snapshot.revenueCents = depth.revenueCents;
      snapshot.approvalPct = depth.approvalPct;
      if (wantsCsv(req.query as Record<string, unknown>)) {
        sendCsv(res, "report.csv", ["Kind", "Code", "Count", "Share"], [
          ...snapshot.sources.map((row) => ["source", row.code, row.count, row.share]),
          ...(snapshot.purposes || []).map((row) => ["purpose", row.code, row.count, ""]),
          ["revenue", "funded", snapshot.revenueCents, ""],
          ["approval", "letters", snapshot.approvalPct, ""],
        ]);
        return;
      }
      res.json({ ok: true, report: snapshot });
    } catch (error) {
      console.error("[reports]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/contacts", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "contacts.read");
      if (!user?.tenantId || !(await requireModule(user, "clients", res))) return;
      const grid = parseGridQuery(req.query as Record<string, unknown>, {
        name: "last_name",
        email: "email",
        company: "company",
        created: "created_at",
      }, "created");
      const scope = clientScope(user.role);
      const term = likeTerm(grid.search);
      const where = `WHERE tenant_id = ? AND status <> 'archived' AND (? = 'all' OR assigned_user_id = ?)
        AND (? = '' OR first_name LIKE ? ESCAPE '\\\\' OR last_name LIKE ? ESCAPE '\\\\' OR email LIKE ? ESCAPE '\\\\' OR company LIKE ? ESCAPE '\\\\' OR phone LIKE ? ESCAPE '\\\\')`;
      const params = [user.tenantId, scope, user.id, grid.search, term, term, term, term, term];
      if (wantsCsv(req.query as Record<string, unknown>)) {
        const rows = await queryRows(
          `SELECT first_name, last_name, email, phone, company, kind, status FROM contacts ${where} ORDER BY ${grid.orderBy} ${grid.dir} LIMIT 2000`,
          params,
        );
        sendCsv(res, "contacts.csv", ["First name", "Last name", "Email", "Phone", "Company", "Kind", "Status"], rows.map((row) => [row.first_name, row.last_name, row.email, row.phone, row.company, row.kind, row.status]));
        return;
      }
      const countRows = await queryRows(`SELECT COUNT(*) AS total FROM contacts ${where}`, params);
      const items = await queryRows(
        `SELECT id, first_name, last_name, email, phone, company, kind, status, client_id, created_at
           FROM contacts ${where} ORDER BY ${grid.orderBy} ${grid.dir} LIMIT ${grid.limit} OFFSET ${grid.offset}`,
        params,
      );
      res.json({
        ok: true,
        items: items.map((row): ContactItem => ({
          id: num(row.id),
          firstName: String(row.first_name),
          lastName: String(row.last_name),
          email: row.email ? String(row.email) : null,
          phone: row.phone ? String(row.phone) : null,
          company: row.company ? String(row.company) : null,
          kind: String(row.kind),
          status: String(row.status),
          clientId: row.client_id == null ? null : num(row.client_id),
          createdAt: iso(row.created_at) || "",
        })),
        pagination: pagination(grid.page, grid.limit, num(countRows[0]?.total)),
      });
    } catch (error) {
      console.error("[contacts]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/contacts", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "contacts.write", true);
      if (!user?.tenantId || !(await requireModule(user, "clients", res))) return;
      const firstName = clip(req.body?.firstName, 100);
      const lastName = clip(req.body?.lastName, 100);
      const email = normalizeEmail(req.body?.email);
      const phone = clip(req.body?.phone, 20);
      const company = clip(req.body?.company, 160);
      const kind = ["person", "realtor", "vendor"].includes(String(req.body?.kind)) ? String(req.body.kind) : "person";
      if (!firstName || !lastName) return deny(res, 400, "validation.wizard");
      if (email && !EMAIL_RE.test(email)) return deny(res, 400, "validation.email");
      const [inserted] = await database().execute(
        `INSERT INTO contacts (tenant_id, assigned_user_id, first_name, last_name, email, phone, company, kind, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [user.tenantId, user.id, firstName, lastName, email || null, phone || null, company || null, kind, clip(req.body?.notes, 2000) || null],
      );
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      console.error("[contacts.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/contacts/:id/convert", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "contacts.write", true);
      if (!user?.tenantId || !(await requireModule(user, "clients", res)) || !requirePerm(user, "clients.write", res)) return;
      const scope = clientScope(user.role);
      const rows = await queryRows(
        `SELECT id, first_name, last_name, email, phone, status FROM contacts
          WHERE id = ? AND tenant_id = ? AND (? = 'all' OR assigned_user_id = ?) LIMIT 1`,
        [Number(req.params.id), user.tenantId, scope, user.id],
      );
      const contact = rows[0];
      if (!contact || contact.status === "archived") return deny(res, 404, "errors.notFound");
      if (contact.status === "converted") return deny(res, 409, "errors.accountExists");
      const [inserted] = await database().execute(
        `INSERT INTO clients (tenant_id, assigned_user_id, first_name, last_name, email, phone, source, status)
         VALUES (?, ?, ?, ?, ?, ?, 'contact', 'lead')`,
        [user.tenantId, user.id, contact.first_name, contact.last_name, contact.email, contact.phone],
      );
      const clientId = num((inserted as { insertId?: number }).insertId);
      await database().execute(
        `UPDATE contacts SET status = 'converted', client_id = ? WHERE id = ? AND tenant_id = ?`,
        [clientId, contact.id, user.tenantId],
      );
      await database().execute(
        `UPDATE conversation_threads SET client_id = ? WHERE tenant_id = ? AND contact_id = ? AND client_id IS NULL`,
        [clientId, user.tenantId, contact.id],
      );
      res.status(201).json({ ok: true, clientId });
    } catch (error) {
      console.error("[contacts.convert]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/conversations", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.read");
      if (!user?.tenantId || !(await requireModule(user, "conversations", res))) return;
      const grid = parseGridQuery(req.query as Record<string, unknown>, { recent: "t.last_message_at", subject: "t.subject" }, "recent");
      const channel = MESSAGE_CHANNELS.includes(String(req.query.channel) as (typeof MESSAGE_CHANNELS)[number]) ? String(req.query.channel) : "";
      const scope = clientScope(user.role);
      const mine = String(req.query.scope) === "mine" ? 1 : 0;
      const term = likeTerm(grid.search);
      const where = `WHERE t.tenant_id = ? AND (? = 'all' OR t.assigned_user_id = ?) AND (? = 0 OR t.assigned_user_id = ?) AND (? = '' OR t.channel = ?)
        AND (? = '' OR t.subject LIKE ? ESCAPE '\\\\' OR ct.first_name LIKE ? ESCAPE '\\\\' OR ct.last_name LIKE ? ESCAPE '\\\\' OR c.first_name LIKE ? ESCAPE '\\\\' OR c.last_name LIKE ? ESCAPE '\\\\')`;
      const params = [user.tenantId, scope, user.id, mine, user.id, channel, channel, grid.search, term, term, term, term, term];
      const countRows = await queryRows(
        `SELECT COUNT(*) AS total FROM conversation_threads t
           LEFT JOIN contacts ct ON ct.id = t.contact_id
           LEFT JOIN clients c ON c.id = t.client_id ${where}`,
        params,
      );
      const items = await queryRows(
        `SELECT t.id, t.channel, t.subject, t.status, t.unread_count, t.last_message_at, t.loan_id,
                ct.first_name AS ct_first, ct.last_name AS ct_last, c.first_name AS c_first, c.last_name AS c_last
           FROM conversation_threads t
           LEFT JOIN contacts ct ON ct.id = t.contact_id
           LEFT JOIN clients c ON c.id = t.client_id
           ${where}
          ORDER BY ${grid.orderBy} ${grid.dir} LIMIT ${grid.limit} OFFSET ${grid.offset}`,
        params,
      );
      res.json({
        ok: true,
        twilio: await twilioReady(user.tenantId),
        items: items.map((row): ThreadItem => ({
          id: num(row.id),
          channel: String(row.channel),
          subject: String(row.subject),
          status: String(row.status),
          unread: num(row.unread_count),
          contactName: row.ct_first ? `${row.ct_first} ${row.ct_last}` : null,
          clientName: row.c_first ? `${row.c_first} ${row.c_last}` : null,
          lastMessageAt: iso(row.last_message_at),
          loanId: row.loan_id == null ? null : num(row.loan_id),
        })),
        pagination: pagination(grid.page, grid.limit, num(countRows[0]?.total)),
      });
    } catch (error) {
      console.error("[conversations]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/conversations/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.read");
      if (!user?.tenantId || !(await requireModule(user, "conversations", res))) return;
      const scope = clientScope(user.role);
      const threads = await queryRows(
        `SELECT t.id, t.channel, t.subject, t.status, t.contact_id, t.client_id, t.loan_id,
                ct.first_name AS ct_first, ct.last_name AS ct_last, ct.email AS ct_email, ct.phone AS ct_phone,
                c.first_name AS c_first, c.last_name AS c_last, c.email AS c_email, c.phone AS c_phone
           FROM conversation_threads t
           LEFT JOIN contacts ct ON ct.id = t.contact_id
           LEFT JOIN clients c ON c.id = t.client_id
          WHERE t.id = ? AND t.tenant_id = ? AND (? = 'all' OR t.assigned_user_id = ?) LIMIT 1`,
        [Number(req.params.id), user.tenantId, scope, user.id],
      );
      if (!threads[0]) return deny(res, 404, "errors.notFound");
      await database().execute(`UPDATE conversation_threads SET unread_count = 0 WHERE id = ? AND tenant_id = ?`, [threads[0].id, user.tenantId]);
      const messages = await queryRows(
        `SELECT id, direction, channel, body, status, call_outcome, forwarded_to, duration_sec, transcript, created_at FROM conversation_messages
          WHERE thread_id = ? AND tenant_id = ? ORDER BY id ASC LIMIT 200`,
        [threads[0].id, user.tenantId],
      );
      const row = threads[0];
      res.json({
        ok: true,
        twilio: await twilioReady(user.tenantId),
        thread: {
          id: num(row.id),
          channel: String(row.channel),
          subject: String(row.subject),
          status: String(row.status),
          contactId: row.contact_id == null ? null : num(row.contact_id),
          clientId: row.client_id == null ? null : num(row.client_id),
          contactName: row.ct_first ? `${row.ct_first} ${row.ct_last}` : null,
          clientName: row.c_first ? `${row.c_first} ${row.c_last}` : null,
          email: row.c_email ? String(row.c_email) : row.ct_email ? String(row.ct_email) : null,
          phone: row.c_phone ? String(row.c_phone) : row.ct_phone ? String(row.ct_phone) : null,
          loanId: row.loan_id == null ? null : num(row.loan_id),
        },
        messages: messages.map((item) => mapMessage(item)),
      });
    } catch (error) {
      console.error("[conversations.read]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/conversations", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.write", true);
      if (!user?.tenantId || !(await requireModule(user, "conversations", res))) return;
      const channel = String(req.body?.channel || "note");
      if (!MESSAGE_CHANNELS.includes(channel as (typeof MESSAGE_CHANNELS)[number])) return deny(res, 400, "validation.wizard");
      const body = clip(req.body?.body, 4000);
      const subject = clip(req.body?.subject, 160) || "Conversation";
      const contactId = Math.floor(Number(req.body?.contactId) || 0);
      const clientId = Math.floor(Number(req.body?.clientId) || 0);
      if (!body || (!contactId && !clientId)) return deny(res, 400, "validation.wizard");
      const opening = outboundUnits(channel, body, optionalNum(req.body?.durationSec));
      if (opening) {
        const capped = await assertAllowance(user.tenantId, opening.key, opening.add);
        if (capped) return deny(res, capped === "errors.billing.notIncluded" ? 403 : 409, capped);
      }
      if (contactId) {
        const owned = await queryRows(`SELECT id FROM contacts WHERE id = ? AND tenant_id = ? LIMIT 1`, [contactId, user.tenantId]);
        if (!owned[0]) return deny(res, 404, "errors.notFound");
      }
      if (clientId) {
        const owned = await queryRows(`SELECT id FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1`, [clientId, user.tenantId]);
        if (!owned[0]) return deny(res, 404, "errors.notFound");
      }
      const delivery = await deliverMessage(user, channel, body, subject, contactId, clientId, { placeCall: req.body?.place === true });
      if (delivery.error) return deny(res, delivery.status, delivery.error);
      const meta = await callMeta(user.tenantId, user.id, channel, req.body);
      if (meta.error) return deny(res, 400, meta.error);
      const spoken = await transcriptMeta(user.tenantId, user.id, channel, req.body?.transcript);
      if (spoken.error) return deny(res, spoken.error === "errors.forbidden" ? 403 : 400, spoken.error);
      const loanId = Math.floor(Number(req.body?.loanId) || 0);
      if (loanId) {
        const owned = await queryRows(`SELECT id FROM loans WHERE id = ? AND tenant_id = ? LIMIT 1`, [loanId, user.tenantId]);
        if (!owned[0]) return deny(res, 404, "errors.notFound");
      }
      const [inserted] = await database().execute(
        `INSERT INTO conversation_threads (tenant_id, contact_id, client_id, loan_id, channel, subject, status, unread_count, last_message_at, assigned_user_id)
         VALUES (?, ?, ?, ?, ?, ?, 'open', 0, NOW(), ?)`,
        [user.tenantId, contactId || null, clientId || null, loanId || null, channel, subject, user.id],
      );
      const threadId = num((inserted as { insertId?: number }).insertId);
      await writeMessage(user.tenantId, threadId, "out", channel, body, delivery.messageStatus, user.id, { ...meta, ...spoken });
      res.status(201).json({ ok: true, id: threadId, status: delivery.messageStatus, notice: spoken.emailed ? "app.transcriptEmailed" : delivery.notice || null });
    } catch (error) {
      console.error("[conversations.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/conversations/:id/messages", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.write", true);
      if (!user?.tenantId || !(await requireModule(user, "conversations", res))) return;
      const scope = clientScope(user.role);
      const threads = await queryRows(
        `SELECT id, contact_id, client_id, subject FROM conversation_threads
          WHERE id = ? AND tenant_id = ? AND (? = 'all' OR assigned_user_id = ?) LIMIT 1`,
        [Number(req.params.id), user.tenantId, scope, user.id],
      );
      if (!threads[0]) return deny(res, 404, "errors.notFound");
      const channel = String(req.body?.channel || "note");
      if (!MESSAGE_CHANNELS.includes(channel as (typeof MESSAGE_CHANNELS)[number])) return deny(res, 400, "validation.wizard");
      const body = clip(req.body?.body, 4000);
      const inbound = req.body?.direction === "in";
      if (!body) return deny(res, 400, "validation.wizard");
      if (!inbound) {
        const reply = outboundUnits(channel, body, optionalNum(req.body?.durationSec));
        if (reply) {
          const capped = await assertAllowance(user.tenantId, reply.key, reply.add);
          if (capped) return deny(res, capped === "errors.billing.notIncluded" ? 403 : 409, capped);
        }
      }
      let status = "received";
      let notice: string | undefined;
      if (!inbound) {
        const delivery = await deliverMessage(user, channel, body, String(threads[0].subject), num(threads[0].contact_id), num(threads[0].client_id), { placeCall: req.body?.place === true });
        if (delivery.error) return deny(res, delivery.status, delivery.error);
        status = delivery.messageStatus;
        notice = delivery.notice;
      }
      const meta = await callMeta(user.tenantId, user.id, channel, req.body);
      if (meta.error) return deny(res, 400, meta.error);
      const spoken = await transcriptMeta(user.tenantId, user.id, channel, req.body?.transcript);
      if (spoken.error) return deny(res, spoken.error === "errors.forbidden" ? 403 : 400, spoken.error);
      if (spoken.emailed) notice = "app.transcriptEmailed";
      await writeMessage(user.tenantId, num(threads[0].id), inbound ? "in" : "out", channel, body, status, user.id, { ...meta, ...spoken });
      await database().execute(
        `UPDATE conversation_threads SET last_message_at = NOW(), channel = ?, unread_count = unread_count + ? WHERE id = ?`,
        [channel, inbound ? 1 : 0, threads[0].id],
      );
      res.status(201).json({ ok: true, status, notice: notice || null });
    } catch (error) {
      console.error("[conversations.message]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  function taskScopeSql() {
    return taskBoardScope();
  }

  async function clearDisabledTaskReminders(tenantId: number) {
    await database().execute(
      `DELETE r FROM task_reminders r
        INNER JOIN tasks t ON t.id = r.task_id
        LEFT JOIN tenant_modules m ON m.tenant_id = t.tenant_id AND m.module_code = 'tasks' AND m.enabled = 1
        WHERE t.tenant_id = ? AND r.sent_at IS NULL AND m.tenant_id IS NULL`,
      [tenantId],
    );
  }

  async function readTaskInput(tenantId: number, role: string, userId: number, body: Record<string, unknown>) {
    const title = clip(body.title, 200);
    const column = TASK_COLUMNS.includes(String(body.column) as (typeof TASK_COLUMNS)[number])
      ? String(body.column)
      : body.status === "done" ? "done" : "todo";
    const priority = TASK_PRIORITIES.includes(String(body.priority) as (typeof TASK_PRIORITIES)[number]) ? String(body.priority) : "normal";
    const loanId = Math.floor(Number(body.loanId) || 0);
    const assigneeId = Math.floor(Number(body.assigneeId) || 0);
    const dueAt = body.dueAt ? new Date(String(body.dueAt)) : null;
    if (dueAt && !Number.isFinite(dueAt.getTime())) return { error: "validation.wizard" as const };
    const scope = clientScope(role);
    if (loanId) {
      const owned = await queryRows(
        `SELECT id FROM loans WHERE id = ? AND tenant_id = ? AND (? = 'all' OR assigned_user_id = ?) LIMIT 1`,
        [loanId, tenantId, scope, userId],
      );
      if (!owned[0]) return { error: "errors.notFound" as const };
    }
    if (assigneeId) {
      const staff = await queryRows(
        `SELECT id FROM tenant_users WHERE id = ? AND tenant_id = ? AND status = 'active' AND role IN ('brokerage_owner','leadership','loan_officer','processor') LIMIT 1`,
        [assigneeId, tenantId],
      );
      if (!staff[0]) return { error: "errors.notFound" as const };
    }
    return { title, column, priority, loanId, assigneeId, dueAt: dueAt || null };
  }

  async function syncTaskReminders(tenantId: number, taskId: number, input: { priority: string; dueAt: Date | null; assigneeId: number; column: string }) {
    await database().execute(`DELETE FROM task_reminders WHERE task_id = ? AND sent_at IS NULL`, [taskId]);
    if (input.column === "done" || !input.dueAt || !input.assigneeId || input.priority === "low") return;
    for (const slot of taskReminderSlots(input.priority, input.dueAt)) {
      await database().execute(
        `INSERT INTO task_reminders (tenant_id, task_id, kind, fire_at, sent_at) VALUES (?, ?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE sent_at = IF(fire_at = VALUES(fire_at), sent_at, NULL), fire_at = VALUES(fire_at)`,
        [tenantId, taskId, slot.kind, flowSqlDate(slot.fireAt)],
      );
    }
  }

  app.get("/api/app/tasks", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "tasks.read");
      if (!user?.tenantId || !(await requireModule(user, "tasks", res))) return;
      const scope = clientScope(user.role);
      const search = clip(req.query.q, 80);
      const term = likeTerm(search);
      const page = Math.min(10_000, Math.max(1, Math.floor(Number(req.query.page) || 1)));
      const limit = Math.min(40, Math.max(1, Math.floor(Number(req.query.limit) || 20)));
      const offset = (page - 1) * limit;
      const where = `t.tenant_id = ? AND ${taskScopeSql()} AND (? = '' OR t.title LIKE ? ESCAPE '\\\\')`;
      const filter = [user.tenantId, scope, user.id, user.id, search, term];
      const totals = await queryRows(
        `SELECT t.column_key, COUNT(*) AS total FROM tasks t LEFT JOIN loans l ON l.id = t.loan_id WHERE ${where} GROUP BY t.column_key`,
        filter,
      );
      const counts = TASK_COLUMNS.map((column) => num(totals.find((row) => String(row.column_key) === column)?.total));
      const rows = await queryRows(
        `SELECT id, loan_id, title, status, column_key, priority, due_on, due_at, position, assigned_user_id,
                first_name, last_name, client_first, client_last
           FROM (
             SELECT t.id, t.loan_id, t.title, t.status, t.column_key, t.priority, t.due_on, t.due_at, t.position,
                    t.assigned_user_id, u.first_name, u.last_name, c.first_name AS client_first, c.last_name AS client_last,
                    ROW_NUMBER() OVER (PARTITION BY t.column_key ORDER BY t.position, t.id DESC) AS board_rn
               FROM tasks t
               LEFT JOIN loans l ON l.id = t.loan_id
               LEFT JOIN clients c ON c.id = l.client_id
               LEFT JOIN tenant_users u ON u.id = t.assigned_user_id
              WHERE ${where}
           ) ranked
          WHERE board_rn > ${offset} AND board_rn <= ${offset + limit}
          ORDER BY column_key, position, id DESC`,
        filter,
      );
      const staff = await queryRows(
        `SELECT id, first_name, last_name FROM tenant_users
          WHERE tenant_id = ? AND status = 'active' AND role IN ('brokerage_owner','leadership','loan_officer','processor')
          ORDER BY first_name, last_name LIMIT 80`,
        [user.tenantId],
      );
      const loans = await queryRows(
        `SELECT l.id, c.first_name, c.last_name FROM loans l
           JOIN clients c ON c.id = l.client_id
          WHERE l.tenant_id = ? AND l.status = 'open' AND (? = 'all' OR l.assigned_user_id = ?)
          ORDER BY l.id DESC LIMIT 40`,
        [user.tenantId, scope, user.id],
      );
      res.json({
        ok: true,
        items: rows.map((row): TaskItem => ({
          id: num(row.id),
          loanId: row.loan_id == null ? null : num(row.loan_id),
          loanName: row.client_first ? `${row.client_first} ${row.client_last}` : null,
          title: String(row.title),
          status: String(row.status),
          column: String(row.column_key || (row.status === "done" ? "done" : "todo")),
          priority: String(row.priority || "normal"),
          dueOn: row.due_on ? String(row.due_on).slice(0, 10) : null,
          dueAt: iso(row.due_at),
          assigneeId: row.assigned_user_id == null ? null : num(row.assigned_user_id),
          assigneeName: row.first_name ? `${row.first_name} ${row.last_name}` : null,
          position: num(row.position),
        })),
        staff: staff.map((row) => ({ id: num(row.id), name: `${row.first_name} ${row.last_name}` })),
        loans: loans.map((row) => ({ id: num(row.id), name: `${row.first_name} ${row.last_name}` })),
        pagination: boardPagination(counts, page, limit),
      });
    } catch (error) {
      console.error("[tasks]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/tasks", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "files.write", true);
      if (!user?.tenantId || !(await requireModule(user, "tasks", res))) return;
      const input = await readTaskInput(user.tenantId, user.role, user.id, req.body || {});
      if ("error" in input) return deny(res, input.error === "errors.notFound" ? 404 : 400, input.error);
      if (input.title.length < 2) return deny(res, 400, "validation.wizard");
      const dueOn = taskDueOn(input.dueAt);
      const [inserted] = await database().execute(
        `INSERT INTO tasks (tenant_id, loan_id, assigned_user_id, title, detail, category, status, column_key, priority, due_on, due_at, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          user.tenantId,
          input.loanId || null,
          input.assigneeId || null,
          input.title,
          clip(req.body?.detail, 500) || null,
          clip(req.body?.category, 80) || null,
          input.column === "done" ? "done" : "open",
          input.column,
          input.priority,
          dueOn,
          input.dueAt ? flowSqlDate(input.dueAt) : null,
        ],
      );
      const taskId = num((inserted as { insertId?: number }).insertId);
      await syncTaskReminders(user.tenantId, taskId, { priority: input.priority, dueAt: input.dueAt, assigneeId: input.assigneeId, column: input.column });
      res.status(201).json({ ok: true, id: taskId });
    } catch (error) {
      console.error("[tasks.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/tasks/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "files.write", true);
      if (!user?.tenantId || !(await requireModule(user, "tasks", res))) return;
      const scope = clientScope(user.role);
      const current = await queryRows(
        `SELECT t.id, t.title, t.column_key, t.priority, t.due_at, t.assigned_user_id, t.loan_id
           FROM tasks t
           LEFT JOIN loans l ON l.id = t.loan_id
          WHERE t.id = ? AND t.tenant_id = ? AND ${taskScopeSql()} LIMIT 1`,
        [Number(req.params.id), user.tenantId, scope, user.id, user.id],
      );
      if (!current[0]) return deny(res, 404, "errors.notFound");
      const body = {
        title: req.body?.title ?? current[0].title,
        column: req.body?.column ?? (req.body?.status === "done" ? "done" : req.body?.status === "open" ? "todo" : current[0].column_key),
        priority: req.body?.priority ?? current[0].priority,
        loanId: req.body?.loanId === undefined ? current[0].loan_id : req.body.loanId,
        assigneeId: req.body?.assigneeId === undefined ? current[0].assigned_user_id : req.body.assigneeId,
        dueAt: req.body?.dueAt === undefined ? (current[0].due_at ? iso(current[0].due_at) : null) : req.body.dueAt,
      };
      const input = await readTaskInput(user.tenantId, user.role, user.id, body);
      if ("error" in input) return deny(res, input.error === "errors.notFound" ? 404 : 400, input.error);
      if (input.title.length < 2) return deny(res, 400, "validation.wizard");
      const dueOn = taskDueOn(input.dueAt);
      await database().execute(
        `UPDATE tasks SET title = ?, loan_id = ?, assigned_user_id = ?, status = ?, column_key = ?, priority = ?, due_on = ?, due_at = ?
          WHERE id = ? AND tenant_id = ?`,
        [
          input.title,
          input.loanId || null,
          input.assigneeId || null,
          input.column === "done" ? "done" : "open",
          input.column,
          input.priority,
          dueOn,
          input.dueAt ? flowSqlDate(input.dueAt) : null,
          Number(req.params.id),
          user.tenantId,
        ],
      );
      await syncTaskReminders(user.tenantId, Number(req.params.id), { priority: input.priority, dueAt: input.dueAt, assigneeId: input.assigneeId, column: input.column });
      res.json({ ok: true });
    } catch (error) {
      console.error("[tasks.patch]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/tasks/bulk", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "files.write", true);
      if (!user?.tenantId || !(await requireModule(user, "tasks", res))) return;
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((item: unknown) => Math.floor(Number(item) || 0)).filter((id: number) => id > 0).slice(0, 100) : [];
      const done = req.body?.column === "done" || req.body?.status === "done";
      if (!ids.length) return deny(res, 400, "validation.wizard");
      await database().execute(
        `UPDATE tasks SET status = ?, column_key = ? WHERE tenant_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
        [done ? "done" : "open", done ? "done" : "todo", user.tenantId, ...ids],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[tasks.bulk]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.delete("/api/app/tasks/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "files.write", true);
      if (!user?.tenantId || !(await requireModule(user, "tasks", res))) return;
      await database().execute(`DELETE FROM tasks WHERE id = ? AND tenant_id = ?`, [Number(req.params.id), user.tenantId]);
      res.json({ ok: true });
    } catch (error) {
      console.error("[tasks.delete]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/clients/template", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "clients.read");
      if (!user?.tenantId) return;
      sendCsv(res, "clients-template.csv", ["first_name", "last_name", "email", "phone", "lead_source"], [["Ada", "Lovelace", "ada@example.com", "4155550100", "past_client"]]);
    } catch (error) {
      console.error("[clients.template]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/clients/import", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "clients.write", true);
      if (!user?.tenantId || !(await requireModule(user, "clients", res))) return;
      const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 200) : [];
      if (!rows.length) return deny(res, 400, "validation.wizard");
      let created = 0;
      for (const row of rows) {
        const firstName = clip(row?.firstName, 100);
        const lastName = clip(row?.lastName, 100);
        const email = normalizeEmail(row?.email);
        const source = LEAD_SOURCES.includes(String(row?.source)) ? String(row.source) : "";
        if (firstName.length < 1 || lastName.length < 1 || !source) continue;
        await database().execute(
          `INSERT INTO clients (tenant_id, assigned_user_id, first_name, last_name, email, phone, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'lead')`,
          [user.tenantId, user.id, firstName, lastName, email || null, clip(row?.phone, 20) || null, source],
        );
        created += 1;
      }
      if (!created) return deny(res, 400, "validation.wizard");
      res.status(201).json({ ok: true, created });
    } catch (error) {
      console.error("[clients.import]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/realtors", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "realtors.read");
      if (!user?.tenantId || !(await requireModule(user, "realtors", res))) return;
      const search = clip(req.query.search, 80);
      const term = likeTerm(search);
      const rows = await queryRows(
        `SELECT id, first_name, last_name, email, phone, brokerage_name, status FROM realtors
          WHERE tenant_id = ? AND status <> 'archived' AND (? = '' OR first_name LIKE ? ESCAPE '\\\\' OR last_name LIKE ? ESCAPE '\\\\' OR brokerage_name LIKE ? ESCAPE '\\\\')
          ORDER BY last_name LIMIT 200`,
        [user.tenantId, search, term, term, term],
      );
      res.json({ ok: true, items: rows.map((row) => ({ id: num(row.id), firstName: String(row.first_name), lastName: String(row.last_name), email: row.email ? String(row.email) : "", phone: row.phone ? String(row.phone) : "", brokerage: row.brokerage_name ? String(row.brokerage_name) : "", status: String(row.status) })) });
    } catch (error) {
      console.error("[realtors]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/realtors", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "realtors.read", true);
      if (!user?.tenantId || !(await requireModule(user, "realtors", res))) return;
      const firstName = clip(req.body?.firstName, 100);
      const lastName = clip(req.body?.lastName, 100);
      if (firstName.length < 1 || lastName.length < 1) return deny(res, 400, "validation.wizard");
      const [inserted] = await database().execute(
        `INSERT INTO realtors (tenant_id, assigned_user_id, first_name, last_name, email, phone, brokerage_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'partner')`,
        [user.tenantId, user.id, firstName, lastName, normalizeEmail(req.body?.email) || null, clip(req.body?.phone, 20) || null, clip(req.body?.brokerage, 160) || null],
      );
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      console.error("[realtors.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/groups", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "clients.read");
      if (!user?.tenantId || !(await requireModule(user, "groups", res))) return;
      const rows = await queryRows(
        `SELECT g.id, g.name, g.kind,
                (SELECT COUNT(*) FROM client_group_members m WHERE m.group_id = g.id) AS members,
                (SELECT GROUP_CONCAT(CONCAT(c.first_name, ' ', c.last_name) ORDER BY c.last_name SEPARATOR ', ')
                   FROM client_group_members m JOIN clients c ON c.id = m.client_id WHERE m.group_id = g.id) AS people
           FROM client_groups g WHERE g.tenant_id = ? ORDER BY g.name`,
        [user.tenantId],
      );
      res.json({ ok: true, items: rows.map((row) => ({ id: num(row.id), name: String(row.name), kind: String(row.kind), members: num(row.members), people: row.people ? String(row.people) : "" })) });
    } catch (error) {
      console.error("[groups]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/groups", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "clients.write", true);
      if (!user?.tenantId || !(await requireModule(user, "groups", res))) return;
      const name = clip(req.body?.name, 120);
      const kind = req.body?.kind === "vip" || req.body?.kind === "household" ? String(req.body.kind) : "other";
      if (name.length < 2) return deny(res, 400, "validation.wizard");
      const [inserted] = await database().execute(`INSERT INTO client_groups (tenant_id, name, kind) VALUES (?, ?, ?)`, [user.tenantId, name, kind]);
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      console.error("[groups.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/calendar", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId || !(await requireModule(user, "calendar", res))) return;
      const rows = await queryRows(
        `SELECT id, name, email, phone, starts_at, note, status, public_token FROM appointments WHERE tenant_id = ? ORDER BY starts_at DESC LIMIT 100`,
        [user.tenantId],
      );
      const tasks = await queryRows(
        `SELECT title, due_on FROM tasks WHERE tenant_id = ? AND due_on IS NOT NULL AND due_on >= DATE_FORMAT(UTC_DATE(), '%Y-%m-01') AND due_on < DATE_ADD(DATE_FORMAT(UTC_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) ORDER BY due_on LIMIT 80`,
        [user.tenantId],
      );
      const birthdays = await queryRows(
        `SELECT first_name, last_name, birthday FROM clients WHERE tenant_id = ? AND birthday IS NOT NULL AND MONTH(birthday) = MONTH(UTC_DATE()) ORDER BY DAY(birthday) LIMIT 80`,
        [user.tenantId],
      );
      const year = new Date().getUTCFullYear();
      res.json({
        ok: true,
        items: rows.map((row) => ({ id: num(row.id), name: String(row.name), email: row.email ? String(row.email) : "", phone: row.phone ? String(row.phone) : "", startsAt: iso(row.starts_at) || "", note: row.note ? String(row.note) : "", status: String(row.status), token: row.public_token ? String(row.public_token) : "" })),
        tasks: tasks.map((row) => ({ title: String(row.title), dueOn: (iso(row.due_on) || "").slice(0, 10) })),
        birthdays: birthdays.map((row) => {
          const when = row.birthday instanceof Date ? row.birthday : new Date(`${String(row.birthday).slice(0, 10)}T12:00:00Z`);
          const month = String(when.getUTCMonth() + 1).padStart(2, "0");
          const day = String(when.getUTCDate()).padStart(2, "0");
          return { name: `${row.first_name} ${row.last_name}`.trim(), date: `${year}-${month}-${day}` };
        }),
      });
    } catch (error) {
      console.error("[calendar]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/calendar/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read", true);
      if (!user?.tenantId) return;
      const status = req.body?.status === "confirmed" || req.body?.status === "done" ? String(req.body.status) : "requested";
      await database().execute(`UPDATE appointments SET status = ? WHERE id = ? AND tenant_id = ?`, [status, Number(req.params.id), user.tenantId]);
      res.json({ ok: true });
    } catch (error) {
      console.error("[calendar.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/documents", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "tasks.read");
      if (!user?.tenantId || !(await requireModule(user, "documents", res))) return;
      const loanId = Math.floor(Number(req.query.loanId) || 0);
      if (String(req.query.zip) === "1" && loanId) {
        const ids = String(req.query.ids || "").split(",").map((item) => Math.floor(Number(item))).filter((item) => item > 0).slice(0, 40);
        const files = await queryRows(
          `SELECT name, file_name, file_blob FROM loan_documents WHERE tenant_id = ? AND loan_id = ? AND file_blob IS NOT NULL AND (? = 0 OR id IN (${ids.length ? ids.map(() => "?").join(",") : "0"}))`,
          [user.tenantId, loanId, ids.length, ...ids],
        );
        const packed = files.filter((row) => row.file_blob).map((row, index) => ({
          name: String(row.file_name || row.name || `file-${index + 1}`),
          data: Buffer.isBuffer(row.file_blob) ? row.file_blob : Buffer.from(row.file_blob as Buffer),
        }));
        if (!packed.length) return deny(res, 404, "errors.notFound");
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="loan-${loanId}.zip"`);
        res.send(zipStore(packed));
        return;
      }
      const sortKey = req.query.sort === "name" || req.query.sort === "status" ? String(req.query.sort) : "id";
      const dir = req.query.dir === "asc" ? "ASC" : "DESC";
      const rows = await queryRows(
        `SELECT id, loan_id, name, status, file_name FROM loan_documents WHERE tenant_id = ? AND (? = 0 OR loan_id = ?) ORDER BY ${sortKey} ${dir} LIMIT 200`,
        [user.tenantId, loanId, loanId],
      );
      res.json({
        ok: true,
        items: rows.map((row): DocumentItem => ({
          id: num(row.id),
          loanId: num(row.loan_id),
          name: String(row.name),
          status: String(row.status),
          hasFile: Boolean(row.file_name),
        })),
      });
    } catch (error) {
      console.error("[documents]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/documents", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "files.write", true);
      if (!user?.tenantId || !(await requireModule(user, "documents", res))) return;
      const loanId = Math.floor(Number(req.body?.loanId));
      const name = clip(req.body?.name, 160);
      if (!name || !loanId) return deny(res, 400, "validation.wizard");
      const owned = await queryRows(`SELECT id FROM loans WHERE id = ? AND tenant_id = ? LIMIT 1`, [loanId, user.tenantId]);
      if (!owned[0]) return deny(res, 404, "errors.notFound");
      const file = decodeUpload(req.body?.fileBase64);
      const [inserted] = await database().execute(
        `INSERT INTO loan_documents (tenant_id, loan_id, name, status, file_name, file_type, file_blob) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.tenantId, loanId, name, file ? "received" : "needed", file ? clip(req.body?.fileName, 160) || name : null, file?.type || null, file?.data || null],
      );
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      console.error("[documents.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/documents/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "files.write", true);
      if (!user?.tenantId || !(await requireModule(user, "documents", res))) return;
      const status = ["needed", "received", "reviewed", "waived"].includes(String(req.body?.status)) ? String(req.body.status) : "";
      if (!status) return deny(res, 400, "validation.wizard");
      const [updated] = await database().execute(
        `UPDATE loan_documents SET status = ? WHERE id = ? AND tenant_id = ?`,
        [status, Number(req.params.id), user.tenantId],
      );
      if (num((updated as { affectedRows?: number }).affectedRows) !== 1) return deny(res, 404, "errors.notFound");
      res.json({ ok: true });
    } catch (error) {
      console.error("[documents.patch]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/compliance", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "tasks.read");
      if (!user?.tenantId || !(await requireModule(user, "compliance", res))) return;
      const loanId = Math.floor(Number(req.query.loanId) || 0);
      const rows = await queryRows(
        `SELECT id, loan_id, code, label, status, due_on, document_id FROM compliance_items
          WHERE tenant_id = ? AND (? = 0 OR loan_id = ?) ORDER BY loan_id, id LIMIT 300`,
        [user.tenantId, loanId, loanId],
      );
      res.json({
        ok: true,
        items: rows.map((row): ComplianceItem => ({
          id: num(row.id),
          loanId: num(row.loan_id),
          code: String(row.code),
          label: String(row.label),
          status: String(row.status),
          dueOn: row.due_on ? String(row.due_on).slice(0, 10) : "",
          documentId: row.document_id == null ? null : num(row.document_id),
        })),
      });
    } catch (error) {
      console.error("[compliance]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/compliance/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "files.write", true);
      if (!user?.tenantId || !(await requireModule(user, "compliance", res))) return;
      const status = ["pending", "done", "waived"].includes(String(req.body?.status)) ? String(req.body.status) : "";
      if (!status) return deny(res, 400, "validation.wizard");
      const due = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.dueOn || "")) ? String(req.body.dueOn).slice(0, 10) : null;
      const documentId = Math.floor(Number(req.body?.documentId) || 0);
      const [updated] = await database().execute(
        `UPDATE compliance_items SET status = ?, due_on = COALESCE(?, due_on), document_id = COALESCE(?, document_id) WHERE id = ? AND tenant_id = ?`,
        [status, due, documentId || null, Number(req.params.id), user.tenantId],
      );
      if (num((updated as { affectedRows?: number }).affectedRows) !== 1) return deny(res, 404, "errors.notFound");
      res.json({ ok: true });
    } catch (error) {
      console.error("[compliance.patch]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/templates", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId || !(await requireModule(user, "templates", res))) return;
      const search = clip(req.query.search, 80);
      const term = likeTerm(search);
      const where = `tenant_id = ? AND (? = '' OR name LIKE ? ESCAPE '\\\\' OR subject LIKE ? ESCAPE '\\\\')`;
      const params = [user.tenantId, search, term, term];
      if (wantsCsv(req.query as Record<string, unknown>)) {
        const rows = await queryRows(`SELECT name, channel, subject FROM message_templates WHERE ${where} ORDER BY name LIMIT 2000`, params);
        sendCsv(res, "templates.csv", ["Name", "Channel", "Subject"], rows.map((row) => [row.name, row.channel, row.subject]));
        return;
      }
      const rows = await queryRows(
        `SELECT id, name, channel, subject, body, greeting, headline, button_label, button_url, details_json, footer
           FROM message_templates WHERE ${where} ORDER BY name LIMIT 200`,
        params,
      );
      res.json({ ok: true, items: rows.map(templateItem) });
    } catch (error) {
      console.error("[templates]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/templates", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read", true);
      if (!user?.tenantId || !(await requireModule(user, "templates", res))) return;
      const name = clip(req.body?.name, 120);
      const channel = ["sms", "email", "note"].includes(String(req.body?.channel)) ? String(req.body.channel) : "note";
      const draft = channel === "email" ? parseEmailDraft(req.body) : null;
      const body = draft?.body || clip(req.body?.body, 4000);
      const subject = draft?.subject || clip(req.body?.subject, 160);
      if (name.length < 2 || body.length < 2) return deny(res, 400, "validation.wizard");
      const [inserted] = await database().execute(
        `INSERT INTO message_templates (tenant_id, name, channel, subject, body, greeting, headline, button_label, button_url, details_json, footer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.tenantId, name, channel, subject || null, body, draft?.greeting || null, draft?.headline || null, draft?.buttonLabel || null, draft?.buttonUrl || null, draft ? JSON.stringify(draft.details) : null, draft?.footer || null],
      );
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      console.error("[templates.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/app/templates/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read", true);
      if (!user?.tenantId || !(await requireModule(user, "templates", res))) return;
      const id = Math.floor(Number(req.params.id) || 0);
      const saved = await saveMessageTemplate(user.tenantId, id, req.body);
      if (!saved) return deny(res, 400, "validation.wizard");
      res.json({ ok: true });
    } catch (error) {
      console.error("[templates.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/command/emails", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.write", res)) return;
      const rows = await queryRows(`SELECT code, subject, greeting, headline, body_text, button_label, button_url, details_json, footer FROM platform_emails`);
      const byCode = new Map(rows.map((row) => [String(row.code), emailDraftFromRow(row, "body_text")]));
      res.json({
        ok: true,
        emails: PLATFORM_EMAIL_CODES.map((code) => ({ code, ...(byCode.get(code) || platformEmailDefaults(code)) })),
      });
    } catch (error) {
      console.error("[emails]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/command/emails/:code", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.write", res)) return;
      const code = String(req.params.code || "");
      if (!PLATFORM_EMAIL_CODES.includes(code as (typeof PLATFORM_EMAIL_CODES)[number])) return deny(res, 404, "errors.notFound");
      const draft = parseEmailDraft(req.body);
      if (!draft) return deny(res, 400, "validation.wizard");
      await database().execute(
        `INSERT INTO platform_emails (code, subject, greeting, headline, body_text, button_label, button_url, details_json, footer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE subject = VALUES(subject), greeting = VALUES(greeting), headline = VALUES(headline),
           body_text = VALUES(body_text), button_label = VALUES(button_label), button_url = VALUES(button_url),
           details_json = VALUES(details_json), footer = VALUES(footer)`,
        [code, draft.subject, draft.greeting, draft.headline, draft.body, draft.buttonLabel || null, draft.buttonUrl || null, JSON.stringify(draft.details), draft.footer],
      );
      await logActivity({ tenantId: null, actorType: "platform", actorId: user.id, action: "email.updated", summary: `Updated the ${code} email` });
      res.json({ ok: true });
    } catch (error) {
      console.error("[emails.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/command/tenants/:id/templates", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.write", res)) return;
      const tenantId = Math.floor(Number(req.params.id) || 0);
      if (!tenantId) return deny(res, 400, "validation.wizard");
      const rows = await queryRows(
        `SELECT id, name, channel, subject, body, greeting, headline, button_label, button_url, details_json, footer
           FROM message_templates WHERE tenant_id = ? ORDER BY name LIMIT 200`,
        [tenantId],
      );
      res.json({ ok: true, items: rows.map(templateItem) });
    } catch (error) {
      console.error("[tenant.templates]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/command/tenants/:id/templates/:templateId", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return deny(res, 401, "errors.unauthorized");
      if (!requirePerm(user, "tenants.write", res)) return;
      const tenantId = Math.floor(Number(req.params.id) || 0);
      const templateId = Math.floor(Number(req.params.templateId) || 0);
      const saved = await saveMessageTemplate(tenantId, templateId, req.body);
      if (!saved) return deny(res, 400, "validation.wizard");
      res.json({ ok: true });
    } catch (error) {
      console.error("[tenant.templates.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  const FLOW_ZONE = "America/Chicago";
  const FLOW_STEP_TYPES = ["trigger", "wait", "send_email", "send_letter", "send_sms", "notify_staff", "condition", "wait_for_reply", "end"] as const;
  const FLOW_EDGE_TYPES = ["next", "yes", "no", "replied", "no_reply"] as const;

  type FlowPlanStep = { stepKey: string; stepType: string; config: Record<string, unknown> };
  type FlowPlanEdge = { sourceKey: string; targetKey: string; edgeType: string };
  type FlowContext = { purpose: string; hasEmail: boolean; hasPhone: boolean; replied: boolean; stopOnReply: boolean };
  type FlowAdvance =
    | { kind: "move"; stepKey: string; edge: string; then: string | null }
    | { kind: "send"; channel: "email" | "sms" | "staff"; stepKey: string; then: string | null }
    | { kind: "skip"; stepKey: string; reason: string; then: string | null }
    | { kind: "hold"; stepKey: string; until: string; reason: "wait" | "reply" | "quiet" | "allowance" }
    | { kind: "done"; reason: string }
    | { kind: "stop"; reason: string };

  function flowSqlDate(date: Date): string {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  function zonedHour(date: Date, timeZone = FLOW_ZONE): number {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).formatToParts(date);
    return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  }

  function quietUntil(now: Date, start: number, end: number): Date | null {
    const open = (hour: number) => (start <= end ? hour >= start && hour < end : hour >= start || hour < end);
    if (open(zonedHour(now))) return null;
    for (let hour = 1; hour <= 24; hour += 1) {
      const next = new Date(now.getTime() + hour * 3_600_000);
      if (open(zonedHour(next))) return next;
    }
    return new Date(now.getTime() + 3_600_000);
  }

  function flowWaitMs(amount: number, unit: string): number {
    const count = Math.max(0, Math.floor(amount));
    if (unit === "minutes") return count * 60_000;
    if (unit === "days") return count * 86_400_000;
    return count * 3_600_000;
  }

  function flowTarget(edges: FlowPlanEdge[], key: string, edgeType: string): string | null {
    return edges.find((edge) => edge.sourceKey === key && edge.edgeType === edgeType)?.targetKey ?? null;
  }

  function nextMonthHold(now: Date): string {
    return flowSqlDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 15, 0, 0)));
  }

  function planFlowStep(input: {
    step: FlowPlanStep | null;
    edges: FlowPlanEdge[];
    now: Date;
    waitingSince: Date | null;
    quietStart: number;
    quietEnd: number;
    ctx: FlowContext;
    smsReady: boolean;
    emailAllowed: boolean;
    smsAllowed: boolean | "later";
  }): FlowAdvance {
    const step = input.step;
    if (!step) return { kind: "done", reason: "missing" };
    if (step.stepType === "end") return { kind: "done", reason: "end" };
    if (input.ctx.stopOnReply && input.ctx.replied && step.stepType !== "trigger" && step.stepType !== "wait_for_reply" && step.stepType !== "end") {
      return { kind: "stop", reason: "reply" };
    }
    if (step.stepType === "trigger") {
      return { kind: "move", stepKey: step.stepKey, edge: "next", then: flowTarget(input.edges, step.stepKey, "next") };
    }
    if (step.stepType === "condition") {
      const check = String(step.config.check || "purpose_purchase");
      const yes = check === "purpose_refinance" ? input.ctx.purpose === "refinance"
        : check === "has_email" ? input.ctx.hasEmail
          : check === "has_phone" ? input.ctx.hasPhone
            : input.ctx.purpose === "purchase";
      const edge = yes ? "yes" : "no";
      return { kind: "move", stepKey: step.stepKey, edge, then: flowTarget(input.edges, step.stepKey, edge) };
    }
    if (step.stepType === "wait" || step.stepType === "wait_for_reply") {
      if (step.stepType === "wait_for_reply" && input.ctx.replied) {
        return { kind: "move", stepKey: step.stepKey, edge: "replied", then: flowTarget(input.edges, step.stepKey, "replied") };
      }
      const started = input.waitingSince || input.now;
      const due = new Date(started.getTime() + flowWaitMs(Number(step.config.amount) || 0, String(step.config.unit || "hours")));
      if (!input.waitingSince || input.now < due) {
        return { kind: "hold", stepKey: step.stepKey, until: flowSqlDate(due), reason: step.stepType === "wait_for_reply" ? "reply" : "wait" };
      }
      const edge = step.stepType === "wait_for_reply" ? "no_reply" : "next";
      return { kind: "move", stepKey: step.stepKey, edge, then: flowTarget(input.edges, step.stepKey, edge) };
    }
    const then = flowTarget(input.edges, step.stepKey, "next");
    if (step.stepType === "send_sms") {
      if (!input.smsReady) return { kind: "skip", stepKey: step.stepKey, reason: "twilio", then };
      if (!input.ctx.hasPhone) return { kind: "skip", stepKey: step.stepKey, reason: "phone", then };
      if (input.smsAllowed === "later") return { kind: "hold", stepKey: step.stepKey, until: nextMonthHold(input.now), reason: "allowance" };
      if (!input.smsAllowed) return { kind: "skip", stepKey: step.stepKey, reason: "allowance", then };
      const quiet = quietUntil(input.now, input.quietStart, input.quietEnd);
      if (quiet) return { kind: "hold", stepKey: step.stepKey, until: flowSqlDate(quiet), reason: "quiet" };
      return { kind: "send", channel: "sms", stepKey: step.stepKey, then };
    }
    if (step.stepType === "send_email" || step.stepType === "send_letter") {
      if (!input.ctx.hasEmail) return { kind: "skip", stepKey: step.stepKey, reason: "email", then };
      if (!input.emailAllowed) return { kind: "skip", stepKey: step.stepKey, reason: "allowance", then };
      return { kind: "send", channel: "email", stepKey: step.stepKey, then };
    }
    if (step.stepType === "notify_staff") return { kind: "send", channel: "staff", stepKey: step.stepKey, then };
    return { kind: "skip", stepKey: step.stepKey, reason: "step", then };
  }

  function flowMail(subject: string, headline: string, body: string): EmailDraft {
    return {
      subject,
      greeting: "Hello {{firstName}},",
      headline,
      body,
      buttonLabel: "Open your portal",
      buttonUrl: "{{portalUrl}}",
      details: [],
      footer: "{{brokerage}} is a mortgage brokerage. {{brokerage}} is not a bank and does not approve loans.",
    };
  }

  function reminderLibrary(brokerageName: string) {
    const office = brokerageName.trim() || "Your brokerage";
    const footer = `${office} is a mortgage brokerage. ${office} is not a bank and does not approve loans.`;
    const mail = (subject: string, headline: string, body: string): EmailDraft => ({ ...flowMail(subject, headline, body), footer });
    return [
      {
        stageName: "Draft",
        name: "Draft",
        description: "A welcome when someone first reaches the office, then a check-in two days later.",
        templates: {
          welcome: { name: "New lead welcome", channel: "email" as const, draft: mail("We got your note", "We're on it.", `Thanks for reaching out to {{brokerage}}. {{officer}} will follow up shortly. Reply to this email if you already have a question.`) },
          checkin: { name: "New lead check-in", channel: "email" as const, draft: mail("Still here when you are ready", "No rush.", `A short note from {{brokerage}}. If you want to talk through a purchase or a refinance, reply and {{officer}} will pick it up.`) },
        },
        steps: [
          { key: "trigger", type: "trigger", label: "Enters Draft", x: 280, y: 0 },
          { key: "welcome", type: "send_email", label: "Welcome", template: "welcome", x: 280, y: 150 },
          { key: "wait", type: "wait", label: "Wait 2 days", config: { amount: 2, unit: "days" }, x: 280, y: 300 },
          { key: "checkin", type: "send_email", label: "Check in", template: "checkin", x: 280, y: 450 },
          { key: "end", type: "end", label: "Stop", x: 280, y: 600 },
        ],
        edges: [
          ["trigger", "welcome", "next"],
          ["welcome", "wait", "next"],
          ["wait", "checkin", "next"],
          ["checkin", "end", "next"],
        ],
      },
      {
        stageName: "Application Received",
        name: "Application Received",
        description: "A purchase or refinance welcome, then a text two days later if texting is on.",
        templates: {
          purchase: { name: "Application, purchase", channel: "email" as const, draft: mail("We have your purchase application", "Your file is open.", `{{brokerage}} has your purchase application. A photo ID, the last two pay stubs, the last two years of W-2s, and the last two months of bank statements move this faster. You can send them from your portal.`) },
          refinance: { name: "Application, refinance", channel: "email" as const, draft: mail("We have your refinance application", "Your file is open.", `{{brokerage}} has your refinance application. It helps to have a photo ID, the last two pay stubs, the last two years of W-2s, a recent mortgage statement, and the last two months of bank statements.`) },
          text: { name: "Application check-in text", channel: "sms" as const, draft: null, body: `Hi {{firstName}}, this is {{brokerage}}. Your application is in. Reply if you want a hand with the document list. Reply STOP to opt out.` },
        },
        steps: [
          { key: "trigger", type: "trigger", label: "Enters Application", x: 280, y: 0 },
          { key: "purpose", type: "condition", label: "Purchase or refinance", config: { check: "purpose_purchase" }, x: 280, y: 150 },
          { key: "purchase", type: "send_email", label: "Purchase welcome", template: "purchase", x: 40, y: 320 },
          { key: "refinance", type: "send_email", label: "Refinance welcome", template: "refinance", x: 520, y: 320 },
          { key: "wait", type: "wait", label: "Wait 2 days", config: { amount: 2, unit: "days" }, x: 280, y: 490 },
          { key: "text", type: "send_sms", label: "Text check-in", template: "text", x: 280, y: 640 },
          { key: "end", type: "end", label: "Stop", x: 280, y: 790 },
        ],
        edges: [
          ["trigger", "purpose", "next"],
          ["purpose", "purchase", "yes"],
          ["purpose", "refinance", "no"],
          ["purchase", "wait", "next"],
          ["refinance", "wait", "next"],
          ["wait", "text", "next"],
          ["text", "end", "next"],
        ],
      },
      {
        stageName: "Under Contract / Loan Setup",
        name: "Under Contract / Loan Setup",
        description: "Tell the borrower the documents are in review, then nudge the loan officer after three days.",
        templates: {
          review: { name: "Processing update", channel: "email" as const, draft: mail("Your documents are in review", "Processing has started.", `{{officer}} is reviewing the documents for your {{purpose}} file at {{brokerage}}. We'll write again if something is missing.`) },
        },
        steps: [
          { key: "trigger", type: "trigger", label: "Enters Processing", x: 280, y: 0 },
          { key: "review", type: "send_email", label: "Review note", template: "review", x: 280, y: 150 },
          { key: "wait", type: "wait", label: "Wait 3 days", config: { amount: 3, unit: "days" }, x: 280, y: 300 },
          { key: "nudge", type: "notify_staff", label: "Nudge the loan officer", config: { note: "This file is still in processing." }, x: 280, y: 450 },
          { key: "end", type: "end", label: "Stop", x: 280, y: 600 },
        ],
        edges: [
          ["trigger", "review", "next"],
          ["review", "wait", "next"],
          ["wait", "nudge", "next"],
          ["nudge", "end", "next"],
        ],
      },
      {
        stageName: "Submitted to Underwriting",
        name: "Submitted to Underwriting",
        description: "Explain the underwriting review, then a short note two days later.",
        templates: {
          review: { name: "Underwriting update", channel: "email" as const, draft: mail("Your file is with underwriting", "The review is underway.", `Your {{purpose}} file is with underwriting. This is the review of income, credit and the property. {{brokerage}} will write when there is a decision. You do not need to do anything unless we ask.`) },
          later: { name: "Underwriting check-in", channel: "email" as const, draft: mail("Still with underwriting", "We'll write when there is a decision.", `Your file is still with underwriting. {{brokerage}} will reach out when there is news, or if a document is needed.`) },
        },
        steps: [
          { key: "trigger", type: "trigger", label: "Enters Underwriting", x: 280, y: 0 },
          { key: "review", type: "send_email", label: "Underwriting note", template: "review", x: 280, y: 150 },
          { key: "wait", type: "wait", label: "Wait 2 days", config: { amount: 2, unit: "days" }, x: 280, y: 300 },
          { key: "later", type: "send_email", label: "Still in review", template: "later", x: 280, y: 450 },
          { key: "end", type: "end", label: "Stop", x: 280, y: 600 },
        ],
        edges: [
          ["trigger", "review", "next"],
          ["review", "wait", "next"],
          ["wait", "later", "next"],
          ["later", "end", "next"],
        ],
      },
      {
        stageName: "Clear to Close",
        name: "Clear to Close",
        description: "Walk through what happens next, and remind the loan officer to confirm the closing.",
        templates: {
          clear: { name: "Clear to close", channel: "email" as const, draft: mail("You are clear to close", "Clear to close.", `{{brokerage}} has a clear to close on your file. Next is the closing disclosure, a final walkthrough if you are buying, and wire instructions from the title company. Do not wire funds from an email you were not expecting. Call {{officer}} to confirm the instructions.`) },
        },
        steps: [
          { key: "trigger", type: "trigger", label: "Enters Clear to close", x: 280, y: 0 },
          { key: "clear", type: "send_email", label: "Clear to close", template: "clear", x: 280, y: 150 },
          { key: "wait", type: "wait", label: "Wait 1 day", config: { amount: 1, unit: "days" }, x: 280, y: 300 },
          { key: "nudge", type: "notify_staff", label: "Confirm the closing", config: { note: "Confirm the closing time and the wire instructions with the borrower." }, x: 280, y: 450 },
          { key: "end", type: "end", label: "Stop", x: 280, y: 600 },
        ],
        edges: [
          ["trigger", "clear", "next"],
          ["clear", "wait", "next"],
          ["wait", "nudge", "next"],
          ["nudge", "end", "next"],
        ],
      },
      {
        stageName: "Loan Funded",
        name: "Loan Funded",
        description: "Congratulate them when the loan funds, then check in a week later.",
        templates: {
          funded: { name: "Loan funded", channel: "email" as const, draft: mail("Your loan is funded", "Congratulations.", `Your loan with {{brokerage}} has funded. Keep the closing documents somewhere you can find them. We're still here after the keys.`) },
          week: { name: "A week after funding", channel: "email" as const, draft: mail("How is the new chapter going", "A note from {{brokerage}}.", `It's been a week. If a question came up after closing, reply to this email. {{officer}} is glad to help.`) },
        },
        steps: [
          { key: "trigger", type: "trigger", label: "Enters Funded", x: 280, y: 0 },
          { key: "funded", type: "send_email", label: "Congratulations", template: "funded", x: 280, y: 150 },
          { key: "wait", type: "wait", label: "Wait 7 days", config: { amount: 7, unit: "days" }, x: 280, y: 300 },
          { key: "week", type: "send_email", label: "One week later", template: "week", x: 280, y: 450 },
          { key: "end", type: "end", label: "Stop", x: 280, y: 600 },
        ],
        edges: [
          ["trigger", "funded", "next"],
          ["funded", "wait", "next"],
          ["wait", "week", "next"],
          ["week", "end", "next"],
        ],
      },
    ];
  }

  function flowObject(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as unknown;
        return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
      } catch {
        return {};
      }
    }
    return typeof value === "object" ? value as Record<string, unknown> : {};
  }

  function readFlowGraph(body: unknown): { steps: FlowStep[]; edges: FlowEdge[] } | null {
    if (!body || typeof body !== "object") return null;
    const source = body as Record<string, unknown>;
    const rawSteps = Array.isArray(source.steps) ? source.steps : [];
    const rawEdges = Array.isArray(source.edges) ? source.edges : [];
    if (rawSteps.length < 1 || rawSteps.length > 40 || rawEdges.length > 80) return null;
    const steps: FlowStep[] = [];
    for (const item of rawSteps) {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const stepKey = clip(row.stepKey, 40);
      const stepType = String(row.stepType || "");
      if (!/^[a-z0-9_-]{1,40}$/i.test(stepKey)) return null;
      if (!FLOW_STEP_TYPES.includes(stepType as (typeof FLOW_STEP_TYPES)[number])) return null;
      steps.push({
        stepKey,
        stepType: stepType as FlowStep["stepType"],
        label: clip(row.label, 120) || stepType,
        templateId: Math.floor(Number(row.templateId) || 0) || null,
        config: flowObject(row.config),
        x: Number.isFinite(Number(row.x)) ? Number(row.x) : 0,
        y: Number.isFinite(Number(row.y)) ? Number(row.y) : 0,
      });
    }
    if (steps.filter((step) => step.stepType === "trigger").length !== 1) return null;
    if (new Set(steps.map((step) => step.stepKey)).size !== steps.length) return null;
    const keys = new Set(steps.map((step) => step.stepKey));
    const edges: FlowEdge[] = [];
    for (const item of rawEdges) {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const sourceKey = clip(row.sourceKey, 40);
      const targetKey = clip(row.targetKey, 40);
      const edgeType = String(row.edgeType || "next");
      if (!keys.has(sourceKey) || !keys.has(targetKey)) return null;
      if (!FLOW_EDGE_TYPES.includes(edgeType as (typeof FLOW_EDGE_TYPES)[number])) return null;
      edges.push({ sourceKey, targetKey, edgeType: edgeType as FlowEdge["edgeType"] });
    }
    return { steps, edges };
  }

  async function seedReminderLibrary(tenantId: number, brokerageName: string, conn: Tx | Db = database()) {
    const stages = await queryRows(`SELECT id, name FROM pipeline_stages WHERE tenant_id = ?`, [tenantId], conn);
    const stageId = (name: string) => {
      const row = stages.find((stage) => String(stage.name) === name);
      return row ? num(row.id) : null;
    };
    const ready = reminderLibrary(brokerageName).flatMap((flow) => {
      const stage = stageId(flow.stageName);
      return stage ? [{ flow, stage }] : [];
    });
    const planned: Array<{ flowName: string; key: string; name: string }> = [];
    const templateRows: unknown[][] = [];
    for (const { flow } of ready) {
      for (const [key, template] of Object.entries(flow.templates)) {
        planned.push({ flowName: flow.name, key, name: template.name });
        templateRows.push(emailTemplateValues(
          tenantId,
          template.name,
          template.channel,
          template.draft,
          "body" in template ? String(template.body || "") : "",
        ));
      }
    }
    await insertRows(
      conn,
      `INSERT INTO message_templates (tenant_id, name, channel, subject, body, greeting, headline, button_label, button_url, details_json, footer)`,
      templateRows,
    );
    const savedTemplates = templateRows.length
      ? await queryRows(`SELECT id, name FROM message_templates WHERE tenant_id = ?`, [tenantId], conn)
      : [];
    const templateByName = new Map(savedTemplates.map((row) => [String(row.name), num(row.id)]));
    const templateIds = new Map<string, number>();
    for (const item of planned) {
      const id = templateByName.get(item.name);
      if (id) templateIds.set(`${item.flowName}:${item.key}`, id);
    }
    await insertRows(
      conn,
      `INSERT INTO reminder_flows (tenant_id, name, description, trigger_kind, stage_id, channel, delay_hours, enabled, stop_on_reply, quiet_start_hour, quiet_end_hour)`,
      ready.map(({ flow, stage }) => [tenantId, flow.name, flow.description, "stage_enter", stage, "email", 0, 0, 1, 9, 19]),
    );
    const savedFlows = ready.length
      ? await queryRows(`SELECT id, name FROM reminder_flows WHERE tenant_id = ?`, [tenantId], conn)
      : [];
    const flowIds = new Map(savedFlows.map((row) => [String(row.name), num(row.id)]));
    const steps: unknown[][] = [];
    const edges: unknown[][] = [];
    for (const { flow } of ready) {
      const flowId = flowIds.get(flow.name);
      if (!flowId) continue;
      for (const step of flow.steps) {
        steps.push([
          flowId,
          step.key,
          step.type,
          step.label,
          step.template ? templateIds.get(`${flow.name}:${step.template}`) ?? null : null,
          JSON.stringify(step.config || {}),
          step.x,
          step.y,
        ]);
      }
      for (const [source, target, edgeType] of flow.edges) edges.push([flowId, source, target, edgeType]);
    }
    await insertRows(
      conn,
      `INSERT INTO reminder_flow_steps (flow_id, step_key, step_type, label, template_id, config_json, position_x, position_y)`,
      steps,
    );
    await insertRows(conn, `INSERT INTO reminder_flow_edges (flow_id, source_key, target_key, edge_type)`, edges);
  }

  async function ensureReminderLibrary(tenantId: number) {
    const existing = await queryRows(`SELECT id FROM reminder_flows WHERE tenant_id = ? LIMIT 1`, [tenantId]);
    if (existing[0]) return;
    const tenant = await queryRows(`SELECT name FROM tenants WHERE id = ? LIMIT 1`, [tenantId]);
    await seedReminderLibrary(tenantId, tenant[0]?.name ? String(tenant[0].name) : "Your brokerage");
  }

  function mapFlowStep(row: Record<string, unknown>): FlowStep {
    return {
      stepKey: String(row.step_key),
      stepType: String(row.step_type) as FlowStep["stepType"],
      label: String(row.label),
      templateId: row.template_id == null ? null : num(row.template_id),
      config: flowObject(row.config_json),
      x: Number(row.position_x) || 0,
      y: Number(row.position_y) || 0,
    };
  }

  async function loadFlowDetail(tenantId: number, flowId: number): Promise<FlowDetail | null> {
    const rows = await queryRows(
      `SELECT id, name, description, stage_id, enabled, stop_on_reply, quiet_start_hour, quiet_end_hour
         FROM reminder_flows WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [flowId, tenantId],
    );
    if (!rows[0]) return null;
    const steps = await queryRows(`SELECT step_key, step_type, label, template_id, config_json, position_x, position_y FROM reminder_flow_steps WHERE flow_id = ?`, [flowId]);
    const edges = await queryRows(`SELECT source_key, target_key, edge_type FROM reminder_flow_edges WHERE flow_id = ?`, [flowId]);
    const row = rows[0];
    return {
      id: num(row.id),
      name: String(row.name),
      description: row.description ? String(row.description) : "",
      stageId: row.stage_id == null ? null : num(row.stage_id),
      enabled: num(row.enabled) === 1,
      stopOnReply: num(row.stop_on_reply) !== 0,
      quietStartHour: num(row.quiet_start_hour),
      quietEndHour: num(row.quiet_end_hour),
      steps: steps.map(mapFlowStep),
      edges: edges.map((edge): FlowEdge => ({
        sourceKey: String(edge.source_key),
        targetKey: String(edge.target_key),
        edgeType: String(edge.edge_type) as FlowEdge["edgeType"],
      })),
    };
  }

  async function borrowerReplied(tenantId: number, clientId: number, since: string): Promise<boolean> {
    const rows = await queryRows(
      `SELECT 1 AS ok FROM conversation_messages m
         JOIN conversation_threads t ON t.id = m.thread_id
        WHERE t.tenant_id = ? AND t.client_id = ? AND m.direction = 'in' AND m.created_at >= ? LIMIT 1`,
      [tenantId, clientId, since],
    );
    return Boolean(rows[0]);
  }

  async function flowVars(tenantId: number, loanId: number): Promise<Record<string, string>> {
    const rows = await queryRows(
      `SELECT c.first_name, c.email, l.purpose, l.amount_cents, s.name AS stage_name, t.name AS brokerage,
              u.first_name AS officer_first, u.last_name AS officer_last
         FROM loans l
         JOIN clients c ON c.id = l.client_id
         JOIN tenants t ON t.id = l.tenant_id
         LEFT JOIN pipeline_stages s ON s.id = l.stage_id
         LEFT JOIN tenant_users u ON u.id = l.assigned_user_id
        WHERE l.id = ? AND l.tenant_id = ? LIMIT 1`,
      [loanId, tenantId],
    );
    const row = rows[0] || {};
    const dollars = Math.round(num(row.amount_cents) / 100).toLocaleString("en-US");
    const officer = `${row.officer_first || ""} ${row.officer_last || ""}`.trim() || "your loan officer";
    return {
      firstName: row.first_name ? String(row.first_name) : "",
      brokerage: row.brokerage ? String(row.brokerage) : "",
      officer,
      stage: row.stage_name ? String(row.stage_name) : "",
      purpose: row.purpose ? String(row.purpose) : "purchase",
      amount: `$${dollars}`,
      portalUrl: `${appOrigin()}/portal`,
    };
  }

  async function stepMessage(tenantId: number, step: FlowStep): Promise<{ channel: "email" | "sms"; draft: EmailDraft | null; text: string }> {
    if (step.templateId) {
      const rows = await queryRows(
        `SELECT channel, subject, body, greeting, headline, button_label, button_url, details_json, footer
           FROM message_templates WHERE id = ? AND tenant_id = ? LIMIT 1`,
        [step.templateId, tenantId],
      );
      if (rows[0]) {
        if (String(rows[0].channel) === "sms") return { channel: "sms", draft: null, text: String(rows[0].body || "") };
        return { channel: "email", draft: emailDraftFromRow(rows[0], "body"), text: String(rows[0].body || "") };
      }
    }
    const config = step.config;
    if (step.stepType === "send_sms") return { channel: "sms", draft: null, text: clip(config.body, 4000) };
    const draft = parseEmailDraft(config);
    return { channel: "email", draft, text: clip(config.body, 4000) };
  }

  async function clientThread(tenantId: number, clientId: number, channel: string, subject: string, assigned: number | null): Promise<number> {
    const rows = await queryRows(
      `SELECT id FROM conversation_threads WHERE tenant_id = ? AND client_id = ? AND channel = ? ORDER BY id DESC LIMIT 1`,
      [tenantId, clientId, channel],
    );
    if (rows[0]) return num(rows[0].id);
    const [inserted] = await database().execute(
      `INSERT INTO conversation_threads (tenant_id, client_id, channel, subject, status, unread_count, last_message_at, assigned_user_id)
       VALUES (?, ?, ?, ?, 'open', 0, NOW(), ?)`,
      [tenantId, clientId, channel, subject.slice(0, 160), assigned],
    );
    return num((inserted as { insertId?: number }).insertId);
  }

  async function logFlowEvent(runId: number, flowId: number, stepKey: string | null, event: string, channel: string, detail: string) {
    await database().execute(
      `INSERT INTO reminder_flow_events (run_id, flow_id, step_key, event, channel, detail) VALUES (?, ?, ?, ?, ?, ?)`,
      [runId, flowId, stepKey, event, channel, detail.slice(0, 240)],
    );
  }

  async function finishFlowRun(runId: number, flowId: number, status: "completed" | "stopped", reason: string) {
    await database().execute(
      `UPDATE reminder_flow_runs SET status = ?, end_reason = ?, ended_at = NOW(), live_key = NULL, next_run_at = NULL WHERE id = ?`,
      [status, reason.slice(0, 160), runId],
    );
    await logFlowEvent(runId, flowId, null, status === "completed" ? "completed" : "stopped", "none", reason);
  }

  async function advanceFlowRun(runId: number): Promise<void> {
    for (let hop = 0; hop < 8; hop += 1) {
      const runs = await queryRows(
        `SELECT r.id, r.tenant_id, r.flow_id, r.loan_id, r.client_id, r.current_step_key, r.waiting_since, r.entered_at, r.status,
                f.enabled, f.stage_id, f.stop_on_reply, f.quiet_start_hour, f.quiet_end_hour
           FROM reminder_flow_runs r
           JOIN reminder_flows f ON f.id = r.flow_id
          WHERE r.id = ? LIMIT 1`,
        [runId],
      );
      const run = runs[0];
      if (!run || String(run.status) !== "active") return;
      if (num(run.enabled) !== 1) {
        await finishFlowRun(runId, num(run.flow_id), "stopped", "off");
        return;
      }
      const loan = await queryRows(`SELECT stage_id, purpose, client_id, assigned_user_id FROM loans WHERE id = ? AND tenant_id = ? LIMIT 1`, [run.loan_id, run.tenant_id]);
      if (!loan[0] || (run.stage_id != null && num(loan[0].stage_id) !== num(run.stage_id))) {
        await finishFlowRun(runId, num(run.flow_id), "stopped", "stage");
        return;
      }
      const client = await queryRows(`SELECT email, phone FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1`, [run.client_id, run.tenant_id]);
      const steps = (await queryRows(`SELECT step_key, step_type, label, template_id, config_json, position_x, position_y FROM reminder_flow_steps WHERE flow_id = ?`, [run.flow_id])).map(mapFlowStep);
      const edges = (await queryRows(`SELECT source_key, target_key, edge_type FROM reminder_flow_edges WHERE flow_id = ?`, [run.flow_id])).map((edge): FlowEdge => ({
        sourceKey: String(edge.source_key),
        targetKey: String(edge.target_key),
        edgeType: String(edge.edge_type) as FlowEdge["edgeType"],
      }));
      const currentKey = run.current_step_key ? String(run.current_step_key) : steps.find((step) => step.stepType === "trigger")?.stepKey || "";
      const step = steps.find((item) => item.stepKey === currentKey) || null;
      const replied = await borrowerReplied(num(run.tenant_id), num(run.client_id), iso(run.entered_at) || "1970-01-01 00:00:00");
      const emailCap = await assertAllowance(num(run.tenant_id), "emails", 1);
      const smsBody = step?.stepType === "send_sms" ? (await stepMessage(num(run.tenant_id), step)).text : "";
      const smsUnits = Math.max(1, Math.ceil(smsBody.length / 160));
      const smsCap = step?.stepType === "send_sms" ? await assertAllowance(num(run.tenant_id), "sms", smsUnits) : null;
      const advance = planFlowStep({
        step: step ? { stepKey: step.stepKey, stepType: step.stepType, config: step.config } : null,
        edges,
        now: new Date(),
        waitingSince: run.waiting_since ? new Date(iso(run.waiting_since) || "") : null,
        quietStart: num(run.quiet_start_hour),
        quietEnd: num(run.quiet_end_hour),
        ctx: {
          purpose: String(loan[0].purpose || "purchase"),
          hasEmail: EMAIL_RE.test(String(client[0]?.email || "")),
          hasPhone: Boolean(toE164(client[0]?.phone)),
          replied,
          stopOnReply: num(run.stop_on_reply) !== 0,
        },
        smsReady: await twilioReady(num(run.tenant_id)),
        emailAllowed: !emailCap,
        smsAllowed: smsCap === "errors.billing.allowance" ? "later" : !smsCap,
      });
      if (advance.kind === "stop") {
        await finishFlowRun(runId, num(run.flow_id), "stopped", advance.reason);
        return;
      }
      if (advance.kind === "done") {
        await finishFlowRun(runId, num(run.flow_id), "completed", advance.reason);
        return;
      }
      if (advance.kind === "hold") {
        const keepWait = advance.reason === "wait" || advance.reason === "reply";
        await database().execute(
          `UPDATE reminder_flow_runs SET next_run_at = ?, waiting_since = IF(? = 1, COALESCE(waiting_since, NOW()), waiting_since), current_step_key = ? WHERE id = ?`,
          [advance.until.replace("T", " ").slice(0, 19), keepWait ? 1 : 0, advance.stepKey, runId],
        );
        return;
      }
      if (advance.kind === "skip") {
        await logFlowEvent(runId, num(run.flow_id), advance.stepKey, "skipped", "none", advance.reason);
        if (!advance.then) {
          await finishFlowRun(runId, num(run.flow_id), "completed", "end");
          return;
        }
        await database().execute(`UPDATE reminder_flow_runs SET current_step_key = ?, waiting_since = NULL, next_run_at = NOW() WHERE id = ?`, [advance.then, runId]);
        continue;
      }
      if (advance.kind === "move") {
        if (!advance.then) {
          await finishFlowRun(runId, num(run.flow_id), "completed", "end");
          return;
        }
        await database().execute(`UPDATE reminder_flow_runs SET current_step_key = ?, waiting_since = NULL, next_run_at = NOW() WHERE id = ?`, [advance.then, runId]);
        continue;
      }
      const sent = await deliverFlowStep(num(run.tenant_id), num(run.loan_id), num(run.client_id), loan[0].assigned_user_id == null ? null : num(loan[0].assigned_user_id), step);
      if (!sent.ok) {
        await logFlowEvent(runId, num(run.flow_id), advance.stepKey, "skipped", advance.channel, sent.reason);
      } else {
        await logFlowEvent(runId, num(run.flow_id), advance.stepKey, "sent", advance.channel, sent.reason);
      }
      if (!advance.then) {
        await finishFlowRun(runId, num(run.flow_id), "completed", "end");
        return;
      }
      await database().execute(`UPDATE reminder_flow_runs SET current_step_key = ?, waiting_since = NULL, next_run_at = NOW() WHERE id = ?`, [advance.then, runId]);
    }
  }

  async function deliverFlowStep(tenantId: number, loanId: number, clientId: number, assigned: number | null, step: FlowStep | null): Promise<{ ok: boolean; reason: string }> {
    if (!step) return { ok: false, reason: "missing" };
    const vars = await flowVars(tenantId, loanId);
    if (step.stepType === "notify_staff") {
      const people = await queryRows(
        `SELECT email, first_name FROM tenant_users WHERE id = ? AND tenant_id = ? AND status = 'active' LIMIT 1`,
        [assigned || 0, tenantId],
      );
      const email = normalizeEmail(people[0]?.email);
      if (!EMAIL_RE.test(email)) return { ok: false, reason: "staff" };
      const brand = await tenantBrand(tenantId);
      const note = clip(step.config.note, 4000) || "A file needs a look.";
      const draft = fillEmail(flowMail("A file needs you", note, `${vars.firstName || "A borrower"} is in ${vars.stage || "the pipeline"}. ${note}`), vars);
      const rendered = renderEmail(brand, draft);
      await sendEmail(email, draft.subject, rendered.text, { html: rendered.html, replyTo: brand.replyTo, fromName: brand.name });
      return { ok: true, reason: "staff" };
    }
    if (step.stepType === "send_letter") {
      const letterCap = await assertAllowance(tenantId, "letters", 1);
      if (letterCap) return { ok: false, reason: "allowance" };
      const files = await queryRows(
        `SELECT l.preapproval_cents, l.preapproval_max_cents, l.letter_active, l.address_line, l.city, c.first_name, c.last_name, c.email, t.letter_hold, t.nmls
           FROM loans l JOIN clients c ON c.id = l.client_id JOIN tenants t ON t.id = l.tenant_id
          WHERE l.id = ? AND l.tenant_id = ? LIMIT 1`,
        [loanId, tenantId],
      );
      const file = files[0];
      if (!file || num(file.letter_active) !== 1) return { ok: false, reason: "letter" };
      const openTasks = await queryRows(`SELECT COUNT(*) AS total FROM tasks WHERE tenant_id = ? AND loan_id = ? AND status <> 'done'`, [tenantId, loanId]);
      if (num(file.letter_hold) === 1 && num(openTasks[0]?.total) > 0) return { ok: false, reason: "hold" };
      const email = normalizeEmail(file.email);
      if (!EMAIL_RE.test(email)) return { ok: false, reason: "email" };
      const brand = await tenantBrand(tenantId);
      const amount = `$${(num(file.preapproval_cents) / 100).toFixed(0)}`;
      const max = `$${(num(file.preapproval_max_cents) / 100).toFixed(0)}`;
      const body = `${file.first_name} ${file.last_name} is pre-approved for ${amount}, up to ${max}. ${[file.address_line, file.city].filter(Boolean).join(", ")}`;
      const draft = fillEmail(flowMail(`${brand.name} pre-approval`, `${brand.name}`, `${body}${file.nmls ? ` NMLS ${file.nmls}.` : ""}`), vars);
      const rendered = renderEmail(brand, draft);
      await sendEmail(email, draft.subject, rendered.text, { html: rendered.html, replyTo: brand.replyTo, fromName: brand.name });
      return { ok: true, reason: "letter" };
    }
    const message = await stepMessage(tenantId, step);
    if (step.stepType === "send_sms") {
      const text = fillEmail(flowMail("Text", "Text", message.text || " "), vars).body.trim();
      if (text.length < 2) return { ok: false, reason: "empty" };
      const people = await queryRows(`SELECT phone FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1`, [clientId, tenantId]);
      const to = toE164(people[0]?.phone);
      if (!to) return { ok: false, reason: "phone" };
      const sent = await sendTwilioMessage(tenantId, to, text);
      const threadId = await clientThread(tenantId, clientId, "sms", "Text", assigned);
      const reason = "error" in sent && sent.error === "errors.call.blocked" ? "blocked" : sent.ok ? "sent" : "twilio";
      await writeMessage(tenantId, threadId, "out", "sms", text, sent.ok ? "sent" : "failed", assigned || 0, { outcome: null, forwardedTo: null, duration: null, transcript: null, emailed: false });
      await database().execute(`UPDATE conversation_threads SET last_message_at = NOW() WHERE id = ?`, [threadId]);
      return { ok: sent.ok, reason };
    }
    const draft = message.draft ? fillEmail(message.draft, vars) : null;
    if (!draft) return { ok: false, reason: "empty" };
    const client = await queryRows(`SELECT email FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1`, [clientId, tenantId]);
    const email = normalizeEmail(client[0]?.email);
    if (!EMAIL_RE.test(email)) return { ok: false, reason: "email" };
    const brand = await tenantBrand(tenantId);
    const rendered = renderEmail(brand, draft);
    await sendEmail(email, draft.subject, rendered.text, { html: rendered.html, replyTo: brand.replyTo, fromName: brand.name });
    const threadId = await clientThread(tenantId, clientId, "email", draft.subject, assigned);
    await writeMessage(tenantId, threadId, "out", "email", draft.body, "sent", assigned || 0, { outcome: null, forwardedTo: null, duration: null, transcript: null, emailed: false });
    await database().execute(`UPDATE conversation_threads SET last_message_at = NOW() WHERE id = ?`, [threadId]);
    return { ok: true, reason: "sent" };
  }

  async function enterLoanStage(tenantId: number, loanId: number, stageId: number) {
    const loan = await queryRows(`SELECT client_id FROM loans WHERE id = ? AND tenant_id = ? LIMIT 1`, [loanId, tenantId]);
    if (!loan[0]) return;
    const leaving = await queryRows(
      `SELECT r.id, r.flow_id FROM reminder_flow_runs r
         JOIN reminder_flows f ON f.id = r.flow_id
        WHERE r.loan_id = ? AND r.status = 'active' AND (f.stage_id IS NULL OR f.stage_id <> ?)`,
      [loanId, stageId],
    );
    for (const run of leaving) await finishFlowRun(num(run.id), num(run.flow_id), "stopped", "stage");
    const flows = await queryRows(
      `SELECT id FROM reminder_flows WHERE tenant_id = ? AND stage_id = ? AND enabled = 1`,
      [tenantId, stageId],
    );
    for (const flow of flows) {
      const liveKey = `${num(flow.id)}:${loanId}`.slice(0, 40);
      const existing = await queryRows(`SELECT id FROM reminder_flow_runs WHERE live_key = ? LIMIT 1`, [liveKey]);
      if (existing[0]) {
        await advanceFlowRun(num(existing[0].id));
        continue;
      }
      const first = await queryRows(
        `SELECT step_key FROM reminder_flow_steps WHERE flow_id = ? AND step_type = 'trigger' LIMIT 1`,
        [flow.id],
      );
      const [inserted] = await database().execute(
        `INSERT INTO reminder_flow_runs (tenant_id, flow_id, loan_id, client_id, status, live_key, current_step_key, next_run_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, NOW())`,
        [tenantId, flow.id, loanId, loan[0].client_id, liveKey, first[0] ? String(first[0].step_key) : null],
      );
      const runId = num((inserted as { insertId?: number }).insertId);
      await logFlowEvent(runId, num(flow.id), first[0] ? String(first[0].step_key) : null, "entered", "none", "stage");
      await advanceFlowRun(runId);
    }
  }

  async function sendDueTaskReminders(limit: number): Promise<number> {
    const due = await queryRows(
      `SELECT t.id AS task_id, t.tenant_id, t.title, t.due_at, t.priority, u.email, u.first_name, MIN(r.fire_at) AS fire_at
         FROM task_reminders r
         JOIN tasks t ON t.id = r.task_id
         JOIN tenant_modules m ON m.tenant_id = t.tenant_id AND m.module_code = 'tasks' AND m.enabled = 1
         LEFT JOIN tenant_users u ON u.id = t.assigned_user_id
        WHERE r.sent_at IS NULL AND r.fire_at <= NOW() AND t.column_key <> 'done'
        GROUP BY t.id, t.tenant_id, t.title, t.due_at, t.priority, u.email, u.first_name
        ORDER BY MIN(r.fire_at)
        LIMIT ${Math.max(1, Math.min(40, limit))}`,
    );
    const seen = new Set<number>();
    let sent = 0;
    for (const row of due) {
      const taskId = num(row.task_id);
      if (seen.has(taskId)) continue;
      seen.add(taskId);
      const email = normalizeEmail(row.email);
      let delivered = false;
      if (EMAIL_RE.test(email)) {
        try {
          const office = await tenantBrand(num(row.tenant_id));
          const when = row.due_at
            ? new Intl.DateTimeFormat("en-US", { timeZone: TASK_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso(row.due_at) || ""))
            : "soon";
          const draft = fillEmail({
            subject: `Task due: ${row.title}`,
            greeting: `Hello ${row.first_name || ""},`,
            headline: String(row.priority) === "urgent" ? "This is due soon." : "A task is coming up.",
            body: `${row.title} is assigned to you. It is due ${when}. Priority: ${row.priority}.`,
            buttonLabel: "Open tasks",
            buttonUrl: `${appOrigin()}/app/tasks`,
            details: [],
            footer: `${office.name} is a mortgage brokerage. ${office.name} is not a bank and does not approve loans.`,
          }, { firstName: String(row.first_name || "") });
          const rendered = renderEmail(office, draft);
          await sendEmail(email, draft.subject, rendered.text, { html: rendered.html, replyTo: office.replyTo, fromName: office.name });
          delivered = true;
          sent += 1;
        } catch (error) {
          console.error("[tasks.remind]", error instanceof Error ? error.message : error);
        }
      }
      if (delivered || !EMAIL_RE.test(email)) {
        await database().execute(
          `UPDATE task_reminders SET sent_at = NOW() WHERE task_id = ? AND sent_at IS NULL AND fire_at <= NOW()`,
          [taskId],
        );
      }
    }
    return sent;
  }

  async function advanceDueFlows(limit: number): Promise<number> {
    const due = await queryRows(
      `SELECT id FROM reminder_flow_runs WHERE status = 'active' AND (next_run_at IS NULL OR next_run_at <= NOW()) ORDER BY next_run_at LIMIT ${Math.max(1, Math.min(40, limit))}`,
    );
    for (const run of due) await advanceFlowRun(num(run.id));
    return due.length;
  }

  async function saveFlowTemplates(tenantId: number, steps: FlowStep[]) {
    for (const step of steps) {
      if (!step.templateId || (step.stepType !== "send_email" && step.stepType !== "send_sms")) continue;
      if (step.stepType === "send_email") {
        const draft = parseEmailDraft(step.config);
        if (!draft) continue;
        await database().execute(
          `UPDATE message_templates SET subject = ?, body = ?, greeting = ?, headline = ?, button_label = ?, button_url = ?, details_json = ?, footer = ?
            WHERE id = ? AND tenant_id = ? AND channel = 'email'`,
          [draft.subject, draft.body, draft.greeting, draft.headline, draft.buttonLabel, draft.buttonUrl, JSON.stringify(draft.details), draft.footer, step.templateId, tenantId],
        );
      } else {
        const text = clip(step.config.body, 4000);
        if (text.length < 2) continue;
        await database().execute(
          `UPDATE message_templates SET body = ? WHERE id = ? AND tenant_id = ? AND channel = 'sms'`,
          [text, step.templateId, tenantId],
        );
      }
    }
  }

  app.get("/api/app/reminders", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId || !(await requireModule(user, "automations", res))) return;
      await ensureReminderLibrary(user.tenantId);
      const rows = await queryRows(
        `SELECT f.id, f.name, f.description, f.stage_id, f.enabled, f.stop_on_reply, f.quiet_start_hour, f.quiet_end_hour,
                s.name AS stage_name,
                (SELECT COUNT(*) FROM reminder_flow_steps st WHERE st.flow_id = f.id) AS step_count,
                (SELECT COUNT(*) FROM reminder_flow_runs r WHERE r.flow_id = f.id AND r.status = 'active') AS active_runs
           FROM reminder_flows f
           LEFT JOIN pipeline_stages s ON s.id = f.stage_id
          WHERE f.tenant_id = ?
          ORDER BY s.sort_order, f.name`,
        [user.tenantId],
      );
      const stages = await queryRows(`SELECT id, name FROM pipeline_stages WHERE tenant_id = ? ORDER BY sort_order, id`, [user.tenantId]);
      res.json({
        ok: true,
        canEdit: roleCan(user.role, "settings.write"),
        stages: stages.map((stage) => ({ id: num(stage.id), name: String(stage.name) })),
        items: rows.map((row): FlowSummary => ({
          id: num(row.id),
          name: String(row.name),
          description: row.description ? String(row.description) : "",
          stageId: row.stage_id == null ? null : num(row.stage_id),
          stageName: row.stage_name ? String(row.stage_name) : null,
          enabled: num(row.enabled) === 1,
          stopOnReply: num(row.stop_on_reply) !== 0,
          quietStartHour: num(row.quiet_start_hour),
          quietEndHour: num(row.quiet_end_hour),
          stepCount: num(row.step_count),
          activeRuns: num(row.active_runs),
        })),
      });
    } catch (error) {
      console.error("[reminders]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/reminders", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId || !(await requireModule(user, "automations", res))) return;
      const name = clip(req.body?.name, 120);
      const stageId = Math.floor(Number(req.body?.stageId) || 0);
      if (name.length < 2) return deny(res, 400, "validation.wizard");
      if (stageId) {
        const owned = await queryRows(`SELECT id FROM pipeline_stages WHERE id = ? AND tenant_id = ? LIMIT 1`, [stageId, user.tenantId]);
        if (!owned[0]) return deny(res, 404, "errors.notFound");
      }
      const [inserted] = await database().execute(
        `INSERT INTO reminder_flows (tenant_id, name, description, trigger_kind, stage_id, channel, delay_hours, enabled, stop_on_reply, quiet_start_hour, quiet_end_hour)
         VALUES (?, ?, '', 'stage_enter', ?, 'email', 0, 0, 1, 9, 19)`,
        [user.tenantId, name, stageId || null],
      );
      const flowId = num((inserted as { insertId?: number }).insertId);
      await database().execute(
        `INSERT INTO reminder_flow_steps (flow_id, step_key, step_type, label, position_x, position_y) VALUES (?, 'trigger', 'trigger', 'Starts', 280, 0), (?, 'end', 'end', 'Stop', 280, 160)`,
        [flowId, flowId],
      );
      await database().execute(
        `INSERT INTO reminder_flow_edges (flow_id, source_key, target_key, edge_type) VALUES (?, 'trigger', 'end', 'next')`,
        [flowId],
      );
      res.status(201).json({ ok: true, id: flowId });
    } catch (error) {
      console.error("[reminders.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/reminders/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId || !(await requireModule(user, "automations", res))) return;
      const detail = await loadFlowDetail(user.tenantId, Number(req.params.id));
      if (!detail) return deny(res, 404, "errors.notFound");
      const templates = await queryRows(
        `SELECT id, name, channel, subject, body, greeting, headline, button_label, button_url, details_json, footer
           FROM message_templates WHERE tenant_id = ? AND channel IN ('email', 'sms') ORDER BY name LIMIT 200`,
        [user.tenantId],
      );
      res.json({ ok: true, canEdit: roleCan(user.role, "settings.write"), flow: detail, templates: templates.map(templateItem) });
    } catch (error) {
      console.error("[reminders.read]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/app/reminders/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId || !(await requireModule(user, "automations", res))) return;
      const flowId = Number(req.params.id);
      const owned = await queryRows(`SELECT id FROM reminder_flows WHERE id = ? AND tenant_id = ? LIMIT 1`, [flowId, user.tenantId]);
      if (!owned[0]) return deny(res, 404, "errors.notFound");
      const graph = readFlowGraph(req.body);
      const name = clip(req.body?.name, 120);
      if (!graph || name.length < 2) return deny(res, 400, "validation.wizard");
      const stageId = Math.floor(Number(req.body?.stageId) || 0);
      if (stageId) {
        const stage = await queryRows(`SELECT id FROM pipeline_stages WHERE id = ? AND tenant_id = ? LIMIT 1`, [stageId, user.tenantId]);
        if (!stage[0]) return deny(res, 404, "errors.notFound");
      }
      const quietStart = Math.min(23, Math.max(0, Math.floor(Number(req.body?.quietStartHour) || 9)));
      const quietEnd = Math.min(23, Math.max(0, Math.floor(Number(req.body?.quietEndHour) || 19)));
      await saveFlowTemplates(user.tenantId, graph.steps);
      await database().execute(
        `UPDATE reminder_flows SET name = ?, description = ?, stage_id = ?, stop_on_reply = ?, quiet_start_hour = ?, quiet_end_hour = ? WHERE id = ? AND tenant_id = ?`,
        [name, clip(req.body?.description, 400), stageId || null, req.body?.stopOnReply === false ? 0 : 1, quietStart, quietEnd, flowId, user.tenantId],
      );
      await database().execute(`DELETE FROM reminder_flow_steps WHERE flow_id = ?`, [flowId]);
      await database().execute(`DELETE FROM reminder_flow_edges WHERE flow_id = ?`, [flowId]);
      for (const step of graph.steps) {
        await database().execute(
          `INSERT INTO reminder_flow_steps (flow_id, step_key, step_type, label, template_id, config_json, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [flowId, step.stepKey, step.stepType, step.label, step.templateId, JSON.stringify(step.config || {}), step.x, step.y],
        );
      }
      for (const edge of graph.edges) {
        await database().execute(
          `INSERT INTO reminder_flow_edges (flow_id, source_key, target_key, edge_type) VALUES (?, ?, ?, ?)`,
          [flowId, edge.sourceKey, edge.targetKey, edge.edgeType],
        );
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[reminders.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/reminders/:id/active", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId || !(await requireModule(user, "automations", res))) return;
      const [updated] = await database().execute(
        `UPDATE reminder_flows SET enabled = ? WHERE id = ? AND tenant_id = ?`,
        [req.body?.enabled ? 1 : 0, Number(req.params.id), user.tenantId],
      );
      if (num((updated as { affectedRows?: number }).affectedRows) !== 1) return deny(res, 404, "errors.notFound");
      res.json({ ok: true });
    } catch (error) {
      console.error("[reminders.active]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/reminders/:id/runs", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId || !(await requireModule(user, "automations", res))) return;
      const scope = clientScope(user.role);
      const rows = await queryRows(
        `SELECT r.id, r.loan_id, r.status, r.current_step_key, r.next_run_at, r.end_reason, r.entered_at,
                c.first_name, c.last_name
           FROM reminder_flow_runs r
           JOIN reminder_flows f ON f.id = r.flow_id
           JOIN clients c ON c.id = r.client_id
           JOIN loans l ON l.id = r.loan_id
          WHERE f.id = ? AND f.tenant_id = ? AND (? = 'all' OR l.assigned_user_id = ?)
          ORDER BY r.id DESC LIMIT 100`,
        [Number(req.params.id), user.tenantId, scope, user.id],
      );
      res.json({
        ok: true,
        items: rows.map((row): FlowRunItem => ({
          id: num(row.id),
          loanId: num(row.loan_id),
          clientName: `${row.first_name} ${row.last_name}`,
          status: String(row.status),
          stepKey: row.current_step_key ? String(row.current_step_key) : null,
          nextRunAt: iso(row.next_run_at),
          endReason: row.end_reason ? String(row.end_reason) : null,
          enteredAt: iso(row.entered_at) || "",
        })),
      });
    } catch (error) {
      console.error("[reminders.runs]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/broadcasts", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.read");
      if (!user?.tenantId || !(await requireModule(user, "broadcasts", res))) return;
      const search = clip(req.query.search, 80);
      const term = likeTerm(search);
      const where = `tenant_id = ? AND (? = '' OR name LIKE ? ESCAPE '\\\\' OR body LIKE ? ESCAPE '\\\\')`;
      const params = [user.tenantId, search, term, term];
      if (wantsCsv(req.query as Record<string, unknown>)) {
        const rows = await queryRows(`SELECT name, channel, audience, status, created_at FROM broadcasts WHERE ${where} ORDER BY id DESC LIMIT 2000`, params);
        sendCsv(res, "broadcasts.csv", ["Name", "Channel", "Audience", "Status", "Created"], rows.map((row) => [row.name, row.channel, row.audience, row.status, iso(row.created_at)]));
        return;
      }
      const rows = await queryRows(
        `SELECT id, name, channel, audience, body, status, recipient_count, sent_count, template_id, created_at FROM broadcasts WHERE ${where} ORDER BY id DESC LIMIT 100`,
        params,
      );
      res.json({
        ok: true,
        sending: await twilioReady(user.tenantId),
        items: rows.map((row): BroadcastItem => ({
          id: num(row.id),
          name: String(row.name),
          channel: String(row.channel),
          audience: String(row.audience),
          body: String(row.body),
          status: String(row.status),
          createdAt: iso(row.created_at) || "",
          recipientCount: num(row.recipient_count),
          sentCount: num(row.sent_count),
          templateId: row.template_id == null ? null : num(row.template_id),
        })),
      });
    } catch (error) {
      console.error("[broadcasts]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/broadcasts", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.write", true);
      if (!user?.tenantId || !(await requireModule(user, "broadcasts", res))) return;
      const name = clip(req.body?.name, 120);
      const body = clip(req.body?.body, 4000);
      const channel = ["sms", "email"].includes(String(req.body?.channel)) ? String(req.body.channel) : "sms";
      const audience = ["clients", "contacts", "realtors"].includes(String(req.body?.audience)) ? String(req.body.audience) : "clients";
      if (name.length < 2 || body.length < 2) return deny(res, 400, "validation.wizard");
      const templateId = Math.floor(Number(req.body?.templateId) || 0);
      if (templateId) {
        const owned = await queryRows(`SELECT id FROM message_templates WHERE id = ? AND tenant_id = ? LIMIT 1`, [templateId, user.tenantId]);
        if (!owned[0]) return deny(res, 404, "errors.notFound");
      }
      if (channel === "sms") {
        if (!(await twilioReady(user.tenantId))) return deny(res, 409, "errors.twilio");
        if (!(await officeLine(user.tenantId))) return deny(res, 409, "errors.call.line");
      }
      const table = audience === "realtors" ? "realtors" : audience === "contacts" ? "contacts" : "clients";
      const reach = channel === "email" ? "email IS NOT NULL AND email <> ''" : "phone IS NOT NULL AND phone <> ''";
      const counted = await queryRows(`SELECT COUNT(*) AS total FROM ${table} WHERE tenant_id = ? AND status <> 'archived' AND ${reach}`, [user.tenantId]);
      const recipients = num(counted[0]?.total);
      if (!recipients) return deny(res, 400, "errors.broadcast.empty");
      const batch = Math.min(recipients, 500);
      const units = channel === "email" ? batch : batch * smsSegments(body);
      const capped = await assertAllowance(user.tenantId, channel === "email" ? "emails" : "sms", units);
      if (capped) return deny(res, capped === "errors.billing.notIncluded" ? 403 : 409, capped);
      const people = await queryRows(
        `SELECT first_name, email, phone FROM ${table} WHERE tenant_id = ? AND status <> 'archived' AND ${reach} ORDER BY id ASC LIMIT 500`,
        [user.tenantId],
      );
      const [inserted] = await database().execute(
        `INSERT INTO broadcasts (tenant_id, name, channel, audience, body, status, recipient_count, sent_count, failed_count, template_id) VALUES (?, ?, ?, ?, ?, 'queued', ?, 0, 0, ?)`,
        [user.tenantId, name, channel, audience, body, recipients, templateId || null],
      );
      const id = num((inserted as { insertId?: number }).insertId);
      const brand = await tenantBrand(user.tenantId);
      let sent = 0;
      let failed = 0;
      for (const person of people) {
        try {
          if (channel === "email") {
            const email = normalizeEmail(person.email);
            if (!EMAIL_RE.test(email)) { failed += 1; continue; }
            const draft = fillEmail({
              subject: name,
              greeting: "Hello,",
              headline: name,
              body,
              buttonLabel: "",
              buttonUrl: "",
              details: [],
              footer: `${brand.name} is a mortgage brokerage. ${brand.name} is not a bank and does not approve loans.`,
            }, { brokerage: brand.name, firstName: String(person.first_name || "") });
            const rendered = renderEmail(brand, draft);
            await sendEmail(email, draft.subject, rendered.text, { html: rendered.html, replyTo: brand.replyTo, fromName: brand.name });
            sent += 1;
          } else {
            const to = toE164(person.phone);
            if (!to) { failed += 1; continue; }
            const result = await sendTwilioMessage(user.tenantId, to, body);
            if (result.ok) sent += 1;
            else failed += 1;
          }
        } catch (error) {
          failed += 1;
          console.error("[broadcasts.send]", error instanceof Error ? error.message : error);
        }
      }
      const status = sent === 0 ? "failed" : failed > 0 || recipients > people.length ? "partial" : "sent";
      await database().execute(
        `UPDATE broadcasts SET status = ?, sent_count = ?, failed_count = ? WHERE id = ? AND tenant_id = ?`,
        [status, sent, failed, id, user.tenantId],
      );
      res.status(201).json({ ok: true, id, status, recipientCount: recipients, sentCount: sent });
    } catch (error) {
      console.error("[broadcasts.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/credit", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId || !(await requireModule(user, "credit", res))) return;
      const search = clip(req.query.search, 80);
      const term = likeTerm(search);
      const where = `tenant_id = ? AND (? = '' OR summary LIKE ? ESCAPE '\\\\' OR file_name LIKE ? ESCAPE '\\\\' OR score_band LIKE ? ESCAPE '\\\\')`;
      const params = [user.tenantId, search, term, term, term];
      if (wantsCsv(req.query as Record<string, unknown>)) {
        const rows = await queryRows(`SELECT client_id, file_name, score_band, status, created_at FROM credit_analyses WHERE ${where} ORDER BY id DESC LIMIT 2000`, params);
        sendCsv(res, "credit.csv", ["Client", "File", "Band", "Status", "Created"], rows.map((row) => [row.client_id, row.file_name, row.score_band, row.status, iso(row.created_at)]));
        return;
      }
      const rows = await queryRows(
        `SELECT id, client_id, file_name, summary, score_band, status, created_at FROM credit_analyses
          WHERE ${where} ORDER BY id DESC LIMIT 100`,
        params,
      );
      res.json({
        ok: true,
        items: rows.map((row): CreditItem => ({
          id: num(row.id),
          clientId: row.client_id == null ? null : num(row.client_id),
          fileName: row.file_name ? String(row.file_name) : null,
          summary: String(row.summary),
          scoreBand: String(row.score_band),
          status: String(row.status),
          createdAt: iso(row.created_at) || "",
        })),
      });
    } catch (error) {
      console.error("[credit]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/credit", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read", true);
      if (!user?.tenantId || !(await requireModule(user, "credit", res))) return;
      const saved = await insertCredit(user.tenantId, req.body, null);
      if (saved.error) return deny(res, saved.status, saved.error);
      res.status(201).json({ ok: true, id: saved.id });
    } catch (error) {
      console.error("[credit.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/documents/:id/file", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "tasks.read");
      if (!user?.tenantId) return;
      const rows = await queryRows(`SELECT file_name, file_type, file_blob FROM loan_documents WHERE id = ? AND tenant_id = ? LIMIT 1`, [Number(req.params.id), user.tenantId]);
      const file = rows[0]?.file_blob;
      if (!file) return deny(res, 404, "errors.notFound");
      res.setHeader("Content-Type", String(rows[0].file_type || "application/octet-stream"));
      res.setHeader("Content-Disposition", `attachment; filename="${String(rows[0].file_name || "file").replace(/"/g, "")}"`);
      res.send(Buffer.isBuffer(file) ? file : Buffer.from(file as Buffer));
    } catch (error) {
      console.error("[documents.file]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/clients/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "clients.write", true);
      if (!user?.tenantId) return;
      const scope = clientScope(user.role);
      const birthday = req.body?.birthday === "" ? null : /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.birthday || "")) ? String(req.body.birthday).slice(0, 10) : undefined;
      if (birthday === undefined && req.body?.birthday != null) return deny(res, 400, "validation.wizard");
      const phone = req.body?.phone == null ? undefined : clip(req.body.phone, 20) || null;
      const email = req.body?.email == null ? undefined : normalizeEmail(req.body.email);
      if (email && !EMAIL_RE.test(email)) return deny(res, 400, "validation.email");
      const owned = await queryRows(
        `SELECT id, birthday, phone, email FROM clients WHERE id = ? AND tenant_id = ? AND (? = 'all' OR assigned_user_id = ?) LIMIT 1`,
        [Number(req.params.id), user.tenantId, scope, user.id],
      );
      if (!owned[0]) return deny(res, 404, "errors.notFound");
      const currentBirthday = owned[0].birthday ? (iso(owned[0].birthday) || "").slice(0, 10) : null;
      await database().execute(
        `UPDATE clients SET birthday = ?, phone = ?, email = ? WHERE id = ? AND tenant_id = ?`,
        [
          birthday === undefined ? currentBirthday : birthday,
          phone === undefined ? owned[0].phone : phone,
          email === undefined ? owned[0].email : email || null,
          owned[0].id,
          user.tenantId,
        ],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[clients.patch]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/clients/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "clients.read");
      if (!user?.tenantId) return;
      const scope = clientScope(user.role);
      const rows = await queryRows(
        `SELECT id, first_name, last_name, email, phone, birthday, source, status FROM clients
          WHERE id = ? AND tenant_id = ? AND (? = 'all' OR assigned_user_id = ?) LIMIT 1`,
        [Number(req.params.id), user.tenantId, scope, user.id],
      );
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      const loans = await queryRows(`SELECT id, purpose, amount_cents, status, address_line, city, created_at FROM loans WHERE tenant_id = ? AND client_id = ? ORDER BY id DESC LIMIT 20`, [user.tenantId, rows[0].id]);
      const talks = await queryRows(
        `SELECT id, channel, subject, last_message_at FROM conversation_threads WHERE tenant_id = ? AND client_id = ? ORDER BY last_message_at DESC LIMIT 8`,
        [user.tenantId, rows[0].id],
      );
      const row = rows[0];
      res.json({
        ok: true,
        client: {
          id: num(row.id),
          firstName: String(row.first_name),
          lastName: String(row.last_name),
          email: row.email ? String(row.email) : "",
          phone: row.phone ? String(row.phone) : "",
          birthday: row.birthday ? String(row.birthday).slice(0, 10) : "",
          source: row.source ? String(row.source) : "",
          status: String(row.status),
        },
        loans: loans.map((item) => ({
          id: num(item.id),
          purpose: String(item.purpose),
          amountCents: num(item.amount_cents),
          status: String(item.status),
          address: [item.address_line, item.city].filter(Boolean).join(", "),
          createdAt: iso(item.created_at) || "",
        })),
        conversations: talks.map((item) => ({
          id: num(item.id),
          channel: String(item.channel),
          subject: String(item.subject),
          lastMessageAt: iso(item.last_message_at),
        })),
      });
    } catch (error) {
      console.error("[clients.read]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/task-templates", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "tasks.read");
      if (!user?.tenantId || !(await requireModule(user, "tasks", res))) return;
      const rows = await queryRows(`SELECT id, title, detail, category, priority FROM task_templates WHERE tenant_id = ? ORDER BY id`, [user.tenantId]);
      res.json({ ok: true, items: rows.map((row) => ({ id: num(row.id), title: String(row.title), detail: String(row.detail || ""), category: String(row.category || ""), priority: String(row.priority || "normal") })) });
    } catch (error) {
      console.error("[task.templates]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/task-templates", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "tasks.read", true);
      if (!user?.tenantId || !(await requireModule(user, "tasks", res))) return;
      const title = clip(req.body?.title, 160);
      if (title.length < 2) return deny(res, 400, "validation.wizard");
      const priority = TASK_PRIORITIES.includes(String(req.body?.priority) as (typeof TASK_PRIORITIES)[number]) ? String(req.body.priority) : "normal";
      const [inserted] = await database().execute(
        `INSERT INTO task_templates (tenant_id, title, detail, category, priority) VALUES (?, ?, ?, ?, ?)`,
        [user.tenantId, title, clip(req.body?.detail, 500), clip(req.body?.category, 40) || "document", priority],
      );
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      console.error("[task.templates.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.delete("/api/app/task-templates/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "tasks.read", true);
      if (!user?.tenantId) return;
      await database().execute(`DELETE FROM task_templates WHERE id = ? AND tenant_id = ?`, [Number(req.params.id), user.tenantId]);
      res.json({ ok: true });
    } catch (error) {
      console.error("[task.templates.delete]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/scheduler", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId) return;
      const rows = await queryRows(`SELECT timezone, slot_minutes, buffer_minutes, advance_days, min_hours, hours_json FROM scheduler_settings WHERE tenant_id = ? AND user_id = ? LIMIT 1`, [user.tenantId, user.id]);
      const row = rows[0];
      res.json({
        ok: true,
        settings: {
          timezone: row?.timezone ? String(row.timezone) : "America/Chicago",
          slotMinutes: row ? num(row.slot_minutes) : 30,
          bufferMinutes: row ? num(row.buffer_minutes) : 15,
          advanceDays: row ? num(row.advance_days) : 21,
          minHours: row ? num(row.min_hours) : 2,
          hours: row?.hours_json ? String(row.hours_json) : WEEKDAY_HOURS,
        },
      });
    } catch (error) {
      console.error("[scheduler]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/app/scheduler", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read", true);
      if (!user?.tenantId) return;
      const hours = parseHours(req.body?.hours).map((item) => `${item.day}:${item.start}-${item.end}`).join(",") || WEEKDAY_HOURS;
      await database().execute(
        `INSERT INTO scheduler_settings (tenant_id, user_id, timezone, slot_minutes, buffer_minutes, advance_days, min_hours, hours_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE timezone = VALUES(timezone), slot_minutes = VALUES(slot_minutes), buffer_minutes = VALUES(buffer_minutes), advance_days = VALUES(advance_days), min_hours = VALUES(min_hours), hours_json = VALUES(hours_json)`,
        [
          user.tenantId,
          user.id,
          clip(req.body?.timezone, 64) || "America/Chicago",
          Math.min(120, Math.max(15, Math.floor(Number(req.body?.slotMinutes) || 30))),
          Math.min(60, Math.max(0, Math.floor(Number(req.body?.bufferMinutes) || 0))),
          Math.min(90, Math.max(1, Math.floor(Number(req.body?.advanceDays) || 21))),
          Math.min(72, Math.max(0, Math.floor(Number(req.body?.minHours) || 0))),
          hours,
        ],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[scheduler.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/loan-draft", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.write");
      if (!user?.tenantId) return;
      const rows = await queryRows(`SELECT step, payload_json FROM loan_drafts WHERE user_id = ? AND tenant_id = ? LIMIT 1`, [user.id, user.tenantId]);
      if (!rows[0]) return res.json({ ok: true, draft: null });
      let payload: unknown = {};
      try { payload = JSON.parse(String(rows[0].payload_json || "{}")); } catch { payload = {}; }
      res.json({ ok: true, draft: { step: num(rows[0].step), payload } });
    } catch (error) {
      console.error("[loan.draft]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/app/loan-draft", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.write", true);
      if (!user?.tenantId) return;
      const step = Math.max(0, Math.min(6, Math.floor(Number(req.body?.step) || 0)));
      const payload = JSON.stringify(req.body?.payload || {}).slice(0, 20000);
      await database().execute(
        `INSERT INTO loan_drafts (user_id, tenant_id, step, payload_json) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE step = VALUES(step), payload_json = VALUES(payload_json)`,
        [user.id, user.tenantId, step, payload],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[loan.draft.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/share-link", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.read");
      if (!user?.tenantId) return;
      const slug = await ensurePersonSlug(user.tenantId, user.id);
      if (!slug) return deny(res, 404, "errors.notFound");
      res.json({ ok: true, slug, link: await personApplyLink(req, user.tenantId, slug) });
    } catch (error) {
      console.error("[share.read]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/share-link", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.read", true);
      if (!user?.tenantId) return;
      const email = normalizeEmail(req.body?.email);
      if (!EMAIL_RE.test(email)) return deny(res, 400, "validation.email");
      const slug = await ensurePersonSlug(user.tenantId, user.id);
      if (!slug) return deny(res, 404, "errors.notFound");
      const link = await personApplyLink(req, user.tenantId, slug);
      const brand = await tenantBrand(user.tenantId);
      const note = clip(req.body?.note, 500) || "Here is your application link.";
      const rendered = renderEmail(brand, {
        subject: `Application for ${brand.name}`,
        greeting: "",
        headline: brand.name,
        body: note,
        buttonLabel: "Apply",
        buttonUrl: link,
        details: [],
        footer: `${brand.name} is a mortgage brokerage. ${brand.name} is not a bank and does not approve loans.`,
      });
      await sendEmail(email, `Application for ${brand.name}`, rendered.text, { html: rendered.html, fromName: brand.name, replyTo: brand.replyTo });
      res.json({ ok: true, slug, link });
    } catch (error) {
      console.error("[share]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/share-link/rotate", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "loans.read", true);
      if (!user?.tenantId) return;
      const rows = await queryRows(`SELECT first_name, last_name, public_slug FROM tenant_users WHERE id = ? AND tenant_id = ? LIMIT 1`, [user.id, user.tenantId]);
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      const current = rows[0].public_slug ? String(rows[0].public_slug) : "";
      const next = await takePersonSlug(user.tenantId, user.id, personSlugBase(String(rows[0].first_name || ""), String(rows[0].last_name || "")), current || null);
      await database().execute(`UPDATE tenant_users SET public_slug = ?, apply_token = NULL WHERE id = ? AND tenant_id = ?`, [next, user.id, user.tenantId]);
      res.json({ ok: true, slug: next, link: await personApplyLink(req, user.tenantId, next) });
    } catch (error) {
      console.error("[share.rotate]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/app/realtors/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "realtors.read", true);
      if (!user?.tenantId) return;
      const status = ["partner", "prospect", "archived"].includes(String(req.body?.status)) ? String(req.body.status) : "";
      if (!status) return deny(res, 400, "validation.wizard");
      await database().execute(`UPDATE realtors SET status = ? WHERE id = ? AND tenant_id = ?`, [status, Number(req.params.id), user.tenantId]);
      res.json({ ok: true });
    } catch (error) {
      console.error("[realtors.patch]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/groups/:id/members", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "clients.write", true);
      if (!user?.tenantId) return;
      const clientId = Math.floor(Number(req.body?.clientId) || 0);
      const group = await queryRows(`SELECT id FROM client_groups WHERE id = ? AND tenant_id = ? LIMIT 1`, [Number(req.params.id), user.tenantId]);
      const client = await queryRows(`SELECT id FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1`, [clientId, user.tenantId]);
      if (!group[0] || !client[0]) return deny(res, 404, "errors.notFound");
      await database().execute(`INSERT IGNORE INTO client_group_members (group_id, client_id) VALUES (?, ?)`, [group[0].id, clientId]);
      res.status(201).json({ ok: true });
    } catch (error) {
      console.error("[groups.member]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/portal/profile", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "borrower" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const firstName = clip(req.body?.firstName, 100);
      const lastName = clip(req.body?.lastName, 100);
      const phone = clip(req.body?.phone, 20) || null;
      const address = clip(req.body?.addressLine, 160) || null;
      const city = clip(req.body?.city, 80) || null;
      const region = clip(req.body?.region, 40) || null;
      const postal = clip(req.body?.postalCode, 20) || null;
      if (firstName.length < 1 || lastName.length < 1) return deny(res, 400, "validation.wizard");
      await database().execute(
        `UPDATE borrowers SET first_name = ?, last_name = ?, phone = ?, address_line = ?, city = ?, region = ?, postal_code = ? WHERE tenant_id = ? AND email = ?`,
        [firstName, lastName, phone, address, city, region, postal, user.tenantId, user.email],
      );
      await database().execute(
        `UPDATE clients SET first_name = ?, last_name = ?, phone = ? WHERE tenant_id = ? AND email = ?`,
        [firstName, lastName, phone, user.tenantId, user.email],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[portal.profile]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/portal/home", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "borrower" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const loans = await queryRows(
        `SELECT l.id, l.purpose, l.amount_cents, l.status, s.name AS stage_name
           FROM loans l
           JOIN clients c ON c.id = l.client_id
           LEFT JOIN pipeline_stages s ON s.id = l.stage_id
          WHERE l.tenant_id = ? AND c.email = ?
          ORDER BY l.updated_at DESC LIMIT 20`,
        [user.tenantId, user.email],
      );
      const ids = loans.map((row) => num(row.id));
      const tasks = ids.length
        ? await queryRows(`SELECT id, loan_id, title, status, column_key, completion_note FROM tasks WHERE tenant_id = ? AND loan_id IN (${ids.map(() => "?").join(",")}) ORDER BY id LIMIT 80`, [user.tenantId, ...ids])
        : [];
      const profile = await queryRows(
        `SELECT first_name, last_name, phone, address_line, city, region, postal_code FROM borrowers WHERE tenant_id = ? AND email = ? LIMIT 1`,
        [user.tenantId, user.email],
      );
      const documents = ids.length
        ? await queryRows(`SELECT id, loan_id, name, status FROM loan_documents WHERE tenant_id = ? AND loan_id IN (${ids.map(() => "?").join(",")}) ORDER BY id LIMIT 40`, [user.tenantId, ...ids])
        : [];
      res.json({
        ok: true,
        loans: loans.map((row) => ({ id: num(row.id), purpose: String(row.purpose), amountCents: num(row.amount_cents), status: String(row.status), stage: row.stage_name ? String(row.stage_name) : "" })),
        tasks: tasks.map((row) => ({ id: num(row.id), loanId: num(row.loan_id), title: String(row.title), status: String(row.status), column: String(row.column_key || "todo"), note: row.completion_note ? String(row.completion_note) : "" })),
        documents: documents.map((row) => ({ id: num(row.id), loanId: num(row.loan_id), name: String(row.name), status: String(row.status) })),
        profile: profile[0] ? {
          firstName: String(profile[0].first_name),
          lastName: String(profile[0].last_name),
          phone: profile[0].phone ? String(profile[0].phone) : "",
          addressLine: profile[0].address_line ? String(profile[0].address_line) : "",
          city: profile[0].city ? String(profile[0].city) : "",
          region: profile[0].region ? String(profile[0].region) : "",
          postalCode: profile[0].postal_code ? String(profile[0].postal_code) : "",
        } : null,
      });
    } catch (error) {
      console.error("[portal.home]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.patch("/api/portal/tasks/:id", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "borrower" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const rows = await queryRows(
        `SELECT t.id FROM tasks t JOIN loans l ON l.id = t.loan_id JOIN clients c ON c.id = l.client_id
          WHERE t.id = ? AND t.tenant_id = ? AND c.email = ? LIMIT 1`,
        [Number(req.params.id), user.tenantId, user.email],
      );
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      const note = clip(req.body?.note, 500) || null;
      if (req.body?.status === "doing") {
        await database().execute(`UPDATE tasks SET status = 'open', column_key = 'doing' WHERE id = ? AND tenant_id = ?`, [rows[0].id, user.tenantId]);
      } else {
        await database().execute(`UPDATE tasks SET status = 'done', column_key = 'done', completion_note = COALESCE(?, completion_note) WHERE id = ? AND tenant_id = ?`, [note, rows[0].id, user.tenantId]);
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[portal.task]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/portal/documents", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "borrower" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      const loanId = Math.floor(Number(req.body?.loanId) || 0);
      const name = clip(req.body?.name, 160);
      const file = decodeUpload(req.body?.fileBase64);
      if (!loanId || !name || !file) return deny(res, 400, "validation.wizard");
      const owned = await queryRows(
        `SELECT l.id FROM loans l JOIN clients c ON c.id = l.client_id WHERE l.id = ? AND l.tenant_id = ? AND c.email = ? LIMIT 1`,
        [loanId, user.tenantId, user.email],
      );
      if (!owned[0]) return deny(res, 404, "errors.notFound");
      await database().execute(
        `INSERT INTO loan_documents (tenant_id, loan_id, name, status, file_name, file_type, file_blob) VALUES (?, ?, ?, 'received', ?, ?, ?)`,
        [user.tenantId, loanId, name, clip(req.body?.fileName, 160) || name, file.type, file.data],
      );
      res.status(201).json({ ok: true });
    } catch (error) {
      console.error("[portal.document]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/portal/credit", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user || user.actor !== "borrower" || !user.tenantId) return deny(res, 401, "errors.unauthorized");
      if (!(await requireModule(user, "credit", res))) return;
      const saved = await insertCredit(user.tenantId, req.body, user.id);
      if (saved.error) return deny(res, saved.status, saved.error);
      res.status(201).json({ ok: true, id: saved.id });
    } catch (error) {
      console.error("[credit.portal]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/credit/:id/file", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId || !(await requireModule(user, "credit", res))) return;
      const rows = await queryRows(
        `SELECT file_name, file_type, file_data FROM credit_analyses WHERE id = ? AND tenant_id = ? LIMIT 1`,
        [Number(req.params.id), user.tenantId],
      );
      const file = rows[0]?.file_data;
      if (!file) return deny(res, 404, "errors.notFound");
      res.setHeader("Content-Type", String(rows[0].file_type || "application/octet-stream"));
      res.setHeader("Content-Disposition", `attachment; filename="${String(rows[0].file_name || "summary").replace(/"/g, "")}"`);
      res.send(file);
    } catch (error) {
      console.error("[credit.file]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/calculators", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read", true);
      if (!user?.tenantId || !(await requireModule(user, "calculators", res))) return;
      const kind = String(req.body?.kind || "");
      const allowed = ["fha", "va", "conventional", "investment", "mobile_home", "quick_payment", "income"];
      if (!allowed.includes(kind)) return deny(res, 400, "validation.wizard");
      const clientId = Math.floor(Number(req.body?.clientId) || 0);
      const loanId = Math.floor(Number(req.body?.loanId) || 0);
      if (clientId) {
        const owned = await queryRows(`SELECT id FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1`, [clientId, user.tenantId]);
        if (!owned[0]) return deny(res, 404, "errors.notFound");
      }
      if (loanId) {
        const owned = await queryRows(`SELECT id FROM loans WHERE id = ? AND tenant_id = ? LIMIT 1`, [loanId, user.tenantId]);
        if (!owned[0]) return deny(res, 404, "errors.notFound");
      }
      const inputs = req.body?.inputs;
      const result = req.body?.result;
      if (!inputs || typeof inputs !== "object" || !result || typeof result !== "object") return deny(res, 400, "validation.wizard");
      const title = clip(req.body?.title, 120) || kind;
      const [inserted] = await database().execute(
        `INSERT INTO calculator_saves (tenant_id, client_id, loan_id, kind, title, inputs_json, result_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.tenantId, clientId || null, loanId || null, kind, title, JSON.stringify(inputs).slice(0, 65000), JSON.stringify(result).slice(0, 65000), user.id],
      );
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      console.error("[calculators.save]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/calculators", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId || !(await requireModule(user, "calculators", res))) return;
      const clientId = Math.floor(Number(req.query.clientId) || 0);
      const loanId = Math.floor(Number(req.query.loanId) || 0);
      const rows = await queryRows(
        `SELECT id, client_id, loan_id, kind, title, created_at FROM calculator_saves
          WHERE tenant_id = ? AND (? = 0 OR client_id = ?) AND (? = 0 OR loan_id = ?) ORDER BY id DESC LIMIT 50`,
        [user.tenantId, clientId, clientId, loanId, loanId],
      );
      res.json({
        ok: true,
        items: rows.map((row) => ({
          id: num(row.id),
          clientId: row.client_id == null ? null : num(row.client_id),
          kind: String(row.kind),
          title: String(row.title),
          createdAt: iso(row.created_at) || "",
        })),
      });
    } catch (error) {
      console.error("[calculators]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/phone", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.read");
      if (!user?.tenantId || !(await requireModule(user, "phone", res))) return;
      const canManage = roleCan(user.role, "settings.write");
      await database().execute(
        `INSERT INTO user_phone_settings (tenant_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_id = user_id`,
        [user.tenantId, user.id],
      );
      const settingsRows = await queryRows(
        `SELECT forwarding_enabled, forwarding_phone, voicemail_enabled, voicemail_greeting, browser_calls
           FROM user_phone_settings WHERE tenant_id = ? AND user_id = ? LIMIT 1`,
        [user.tenantId, user.id],
      );
      const settings: PhoneSettings = {
        forwardingEnabled: num(settingsRows[0]?.forwarding_enabled) === 1,
        forwardingPhone: settingsRows[0]?.forwarding_phone ? String(settingsRows[0].forwarding_phone) : null,
        voicemailEnabled: num(settingsRows[0]?.voicemail_enabled) === 1,
        greeting: settingsRows[0]?.voicemail_greeting ? String(settingsRows[0].voicemail_greeting) : null,
        browserCalls: num(settingsRows[0]?.browser_calls) === 1,
      };
      const lineRows = await queryRows(
        `SELECT id, e164, label, assigned_user_id, is_primary, is_active, ring_timeout_sec, voicemail_greeting
           FROM phone_lines
          WHERE tenant_id = ? AND (? = 1 OR assigned_user_id = ?)
          ORDER BY is_primary DESC, label`,
        [user.tenantId, canManage ? 1 : 0, user.id],
      );
      const blockedRows = canManage
        ? await queryRows(
          `SELECT b.id, b.e164, b.note, b.block_calls, b.block_texts, b.created_at, u.first_name, u.last_name
             FROM blocked_numbers b
             LEFT JOIN tenant_users u ON u.id = b.created_by
            WHERE b.tenant_id = ? ORDER BY b.created_at DESC`,
          [user.tenantId],
        )
        : [];
      const desk: PhoneDesk = {
        twilio: await twilioReady(user.tenantId),
        canManage,
        settings,
        ring: ringPlan({
          blocked: false,
          browser: settings.browserCalls,
          forwardingPhone: settings.forwardingEnabled ? settings.forwardingPhone : null,
          voicemail: settings.voicemailEnabled,
        }),
        lines: lineRows.map((row): PhoneLine => ({
          id: num(row.id),
          e164: String(row.e164),
          label: String(row.label),
          assignedUserId: row.assigned_user_id == null ? null : num(row.assigned_user_id),
          isPrimary: num(row.is_primary) === 1,
          isActive: num(row.is_active) === 1,
          ringTimeoutSec: num(row.ring_timeout_sec) || 20,
          greeting: row.voicemail_greeting ? String(row.voicemail_greeting) : null,
        })),
        blocked: blockedRows.map((row): BlockedNumber => ({
          id: num(row.id),
          e164: String(row.e164),
          note: row.note ? String(row.note) : null,
          blockCalls: row.block_calls == null ? true : num(row.block_calls) === 1,
          blockTexts: row.block_texts == null ? true : num(row.block_texts) === 1,
          createdAt: iso(row.created_at),
          createdBy: row.first_name ? `${row.first_name} ${row.last_name}` : null,
        })),
      };
      res.json({ ok: true, ...desk });
    } catch (error) {
      console.error("[phone]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.put("/api/app/phone/settings", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.write", true);
      if (!user?.tenantId || !(await requireModule(user, "phone", res))) return;
      const forwardingEnabled = Boolean(req.body?.forwardingEnabled);
      const forwardingPhone = toE164(req.body?.forwardingPhone);
      if (forwardingEnabled && !forwardingPhone) return deny(res, 400, "validation.phone");
      if (req.body?.forwardingPhone && !forwardingPhone) return deny(res, 400, "validation.phone");
      const greeting = clip(req.body?.greeting, 500);
      await database().execute(
        `INSERT INTO user_phone_settings
          (tenant_id, user_id, forwarding_enabled, forwarding_phone, voicemail_enabled, voicemail_greeting, browser_calls)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          forwarding_enabled = VALUES(forwarding_enabled),
          forwarding_phone = VALUES(forwarding_phone),
          voicemail_enabled = VALUES(voicemail_enabled),
          voicemail_greeting = VALUES(voicemail_greeting),
          browser_calls = VALUES(browser_calls)`,
        [
          user.tenantId,
          user.id,
          forwardingEnabled ? 1 : 0,
          forwardingPhone,
          req.body?.voicemailEnabled === false ? 0 : 1,
          greeting || null,
          req.body?.browserCalls === false ? 0 : 1,
        ],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[phone.settings]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/phone/lines", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId || !(await requireModule(user, "phone", res))) return;
      const e164 = toE164(req.body?.e164);
      const label = clip(req.body?.label, 80);
      if (!e164 || label.length < 2) return deny(res, 400, "validation.phone");
      const assigned = Math.floor(Number(req.body?.assignedUserId) || 0);
      if (assigned) {
        const member = await queryRows(`SELECT id FROM tenant_users WHERE id = ? AND tenant_id = ? LIMIT 1`, [assigned, user.tenantId]);
        if (!member[0]) return deny(res, 404, "errors.notFound");
      }
      const timeout = Math.min(60, Math.max(5, Math.floor(Number(req.body?.ringTimeoutSec) || 20)));
      const primary = Boolean(req.body?.isPrimary);
      if (primary) await database().execute(`UPDATE phone_lines SET is_primary = 0 WHERE tenant_id = ?`, [user.tenantId]);
      const [inserted] = await database().execute(
        `INSERT INTO phone_lines (tenant_id, e164, label, assigned_user_id, is_primary, ring_timeout_sec, voicemail_greeting)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.tenantId, e164, label, assigned || null, primary ? 1 : 0, timeout, clip(req.body?.greeting, 500) || null],
      );
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("uq_phone_line")) return deny(res, 409, "errors.duplicate");
      console.error("[phone.lines]", message || error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/phone/blocked", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId || !(await requireModule(user, "phone", res))) return;
      const e164 = toE164(req.body?.e164);
      if (!e164) return deny(res, 400, "validation.phone");
      const [inserted] = await database().execute(
        `INSERT INTO blocked_numbers (tenant_id, e164, note, block_calls, block_texts, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [user.tenantId, e164, clip(req.body?.note, 160) || null, req.body?.blockCalls === false ? 0 : 1, req.body?.blockTexts === false ? 0 : 1, user.id],
      );
      res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("uq_blocked_number")) return deny(res, 409, "errors.duplicate");
      console.error("[phone.blocked]", message || error);
      deny(res, 500, "errors.server");
    }
  });

  app.delete("/api/app/phone/blocked/:id", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId || !(await requireModule(user, "phone", res))) return;
      await database().execute(`DELETE FROM blocked_numbers WHERE id = ? AND tenant_id = ?`, [Number(req.params.id), user.tenantId]);
      res.json({ ok: true });
    } catch (error) {
      console.error("[phone.unblock]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/transcripts", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.read");
      if (!user?.tenantId || !(await requireModule(user, "transcripts", res))) return;
      const scope = clientScope(user.role);
      const search = clip(req.query.search, 80);
      const term = likeTerm(search);
      const where = `m.tenant_id = ? AND m.transcript IS NOT NULL AND (? = 'all' OR t.assigned_user_id = ?) AND (? = '' OR t.subject LIKE ? ESCAPE '\\\\' OR m.transcript LIKE ? ESCAPE '\\\\')`;
      const params = [user.tenantId, scope, user.id, search, term, term];
      if (wantsCsv(req.query as Record<string, unknown>)) {
        const rows = await queryRows(
          `SELECT t.subject, m.transcript, m.created_at FROM conversation_messages m JOIN conversation_threads t ON t.id = m.thread_id WHERE ${where} ORDER BY m.id DESC LIMIT 2000`,
          params,
        );
        sendCsv(res, "transcripts.csv", ["Subject", "Transcript", "Created"], rows.map((row) => [row.subject, row.transcript, iso(row.created_at)]));
        return;
      }
      const rows = await queryRows(
        `SELECT m.id, m.transcript, m.transcript_emailed_at, m.created_at, t.id AS thread_id, t.subject
           FROM conversation_messages m
           JOIN conversation_threads t ON t.id = m.thread_id
          WHERE ${where}
          ORDER BY m.id DESC LIMIT 50`,
        params,
      );
      res.json({
        ok: true,
        items: rows.map((row): TranscriptItem => ({
          id: num(row.id),
          threadId: num(row.thread_id),
          subject: String(row.subject),
          transcript: String(row.transcript),
          emailed: row.transcript_emailed_at != null,
          createdAt: iso(row.created_at) || "",
        })),
      });
    } catch (error) {
      console.error("[transcripts]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/mailboxes", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.read");
      if (!user?.tenantId || !(await requireModule(user, "email", res))) return;
      const rows = await queryRows(
        `SELECT id, email, display_name, assigned_user_id, status, last_error
           FROM mailboxes WHERE tenant_id = ? ORDER BY email`,
        [user.tenantId],
      );
      res.json({
        ok: true,
        microsoft: Boolean(microsoftReady()),
        items: rows.map((row): MailboxItem => ({
          id: num(row.id),
          email: String(row.email),
          displayName: row.display_name ? String(row.display_name) : null,
          assignedUserId: row.assigned_user_id == null ? null : num(row.assigned_user_id),
          status: String(row.status),
          lastError: row.last_error ? String(row.last_error) : null,
        })),
      });
    } catch (error) {
      console.error("[mailboxes]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/mailboxes", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.write", true);
      if (!user?.tenantId || !(await requireModule(user, "email", res))) return;
      const email = normalizeEmail(req.body?.email);
      const displayName = clip(req.body?.displayName, 160);
      if (!EMAIL_RE.test(email)) return deny(res, 400, "validation.email");
      const assigned = Math.floor(Number(req.body?.assignedUserId) || user.id);
      const member = await queryRows(`SELECT id FROM tenant_users WHERE id = ? AND tenant_id = ? LIMIT 1`, [assigned, user.tenantId]);
      if (!member[0]) return deny(res, 404, "errors.notFound");
      await database().execute(
        `INSERT INTO mailboxes (tenant_id, email, display_name, assigned_user_id, status, created_by)
         VALUES (?, ?, ?, ?, 'pending', ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), assigned_user_id = VALUES(assigned_user_id), status = 'pending', last_error = NULL`,
        [user.tenantId, email, displayName || null, assigned, user.id],
      );
      const rows = await queryRows(`SELECT id FROM mailboxes WHERE tenant_id = ? AND email = ? LIMIT 1`, [user.tenantId, email]);
      const id = num(rows[0]?.id);
      const config = microsoftReady();
      if (!config) return res.status(201).json({ ok: true, id, status: "pending", authUrl: null });
      const state = signState({ tenantId: user.tenantId, userId: user.id, mailboxId: id, exp: Date.now() + 15 * 60_000 });
      res.status(201).json({
        ok: true,
        id,
        status: "pending",
        authUrl: microsoftAuthUrl(config.clientId, microsoftRedirect(req), state, email),
      });
    } catch (error) {
      console.error("[mailboxes.create]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/public/microsoft/callback", async (req, res) => {
    const appUrl = (process.env.PUBLIC_APP_URL || "http://localhost:8080").replace(/\/$/, "");
    const fail = (reason: string) => res.redirect(`${appUrl}/app/email?microsoft=error&reason=${encodeURIComponent(reason)}`);
    try {
      if (req.query.error) return fail("denied");
      const code = String(req.query.code || "");
      const parsed = readState(String(req.query.state || ""));
      const tenantId = num(parsed?.tenantId);
      const mailboxId = num(parsed?.mailboxId);
      const exp = num(parsed?.exp);
      if (!code || !tenantId || !mailboxId || !exp || exp < Date.now()) return fail("state");
      const config = microsoftReady();
      if (!config) return fail("config");
      const redirectUri = microsoftRedirect(req);
      const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          scope: MICROSOFT_SCOPES,
        }),
      });
      const token = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
      if (!tokenRes.ok || !token.access_token) return fail("token");
      const meRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const me = await meRes.json() as { id?: string; mail?: string; userPrincipalName?: string };
      const signedIn = normalizeEmail(me.mail || me.userPrincipalName);
      const rows = await queryRows(`SELECT email FROM mailboxes WHERE id = ? AND tenant_id = ? LIMIT 1`, [mailboxId, tenantId]);
      if (!rows[0] || normalizeEmail(rows[0].email) !== signedIn) {
        await database().execute(
          `UPDATE mailboxes SET status = 'error', last_error = ? WHERE id = ? AND tenant_id = ?`,
          ["errors.microsoftAccount", mailboxId, tenantId],
        );
        return fail("account");
      }
      const expires = new Date(Date.now() + Math.max(60, num(token.expires_in) || 3600) * 1000);
      const expiresSql = expires.toISOString().slice(0, 19).replace("T", " ");
      await database().execute(
        `UPDATE mailboxes
            SET status = 'connected', oauth_user_id = ?, access_token = ?, refresh_token = ?, token_expires_at = ?, last_error = NULL
          WHERE id = ? AND tenant_id = ?`,
        [me.id || null, token.access_token, token.refresh_token || null, expiresSql, mailboxId, tenantId],
      );
      res.redirect(`${appUrl}/app/email?microsoft=connected`);
    } catch (error) {
      console.error("[microsoft.callback]", error instanceof Error ? error.message : "failed");
      fail("server");
    }
  });

  app.get("/api/mcp", (_req, res) => {
    res.json({
      ok: true,
      transport: "jsonrpc",
      priceCents: MCP_CALL_CENTS,
      reads: [...MCP_TOOL_NAMES],
    });
  });

  app.post("/api/mcp", mcpLimiter, async (req, res) => {
    try {
      const header = String(req.headers.authorization || "");
      const match = /^Bearer\s+(\S+)$/i.exec(header);
      const tenant = await mcpTenant(match?.[1] || "");
      if ("error" in tenant) return deny(res, tenant.status, tenant.error);
      const message = readMcpMessage(req.body);
      if (!message) {
        res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
        return;
      }
      const decision = mcpDecision(message.method, message.params);
      if (decision.kind === "notify") {
        res.status(202).end();
        return;
      }
      if (decision.kind === "error") {
        res.json({ jsonrpc: "2.0", id: message.id, error: { code: decision.code, message: decision.message } });
        return;
      }
      if (decision.kind === "result") {
        res.json({ jsonrpc: "2.0", id: message.id, result: decision.result });
        return;
      }
      const outcome = await runMcpTool(tenant.id, decision.name, decision.args);
      if (outcome.bill) {
        await database().execute(`INSERT INTO mcp_calls (tenant_id, tool_name) VALUES (?, ?)`, [tenant.id, decision.name]);
        await syncMcpInvoice(tenant.id);
      }
      res.json({ jsonrpc: "2.0", id: message.id, result: outcome.result });
    } catch (error) {
      console.error("[mcp]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/billing/mcp-key", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId) return;
      if (!(await requireModule(user, "mcp", res))) return;
      const minted = mintMcpToken();
      await database().execute(
        `UPDATE tenants SET mcp_token_hash = ?, mcp_token_prefix = ? WHERE id = ?`,
        [minted.hash, minted.prefix, user.tenantId],
      );
      await logActivity({
        tenantId: user.tenantId,
        actorType: "brokerage",
        actorId: user.id,
        action: "mcp.key",
        summary: "MCP connector key replaced",
      });
      res.json({ ok: true, token: minted.token, prefix: minted.prefix });
    } catch (error) {
      console.error("[mcp.key]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/billing", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.read");
      if (!user?.tenantId) return;
      const row = await loadBillingRow(user.tenantId);
      if (row) await syncStartFee(row);
      const billing = await billingSnapshot(user.tenantId);
      if (!billing) return deny(res, 404, "errors.notFound");
      res.json({ ok: true, billing });
    } catch (error) {
      console.error("[billing]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/modules", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId) return;
      const row = await loadBillingRow(user.tenantId);
      if (!row?.planCode) return deny(res, 404, "errors.notFound");
      const modules = await queryRows(
        `SELECT m.code, m.category, m.sort_order, tm.enabled
           FROM modules m
           LEFT JOIN tenant_modules tm ON tm.module_code = m.code AND tm.tenant_id = ?
          WHERE m.kind = 'product'
          ORDER BY m.sort_order, m.code`,
        [user.tenantId],
      );
      const plans = await queryRows(`SELECT code, price_cents FROM plans WHERE is_public = 1 ORDER BY sort_order`);
      res.json({
        ok: true,
        planCode: row.planCode,
        owner: user.role === "brokerage_owner",
        items: modules.map((item) => {
          const category = String(item.category);
          const minimumPlan = moduleMinimumPlan(category);
          return {
            code: String(item.code),
            category,
            enabled: Boolean(item.enabled),
            included: planIncludesModule(row.planCode || "", category),
            minimumPlan,
          };
        }),
        plans: plans.map((plan) => ({ code: String(plan.code), priceCents: num(plan.price_cents) })),
      });
    } catch (error) {
      console.error("[modules]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/modules", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId) return;
      if (user.tenantStatus === "suspended") return deny(res, 403, "errors.suspended");
      const code = String(req.body?.code || "");
      const turningOn = Boolean(req.body?.enabled);
      const row = await loadBillingRow(user.tenantId);
      const modules = await queryRows(`SELECT code, category FROM modules WHERE code = ? AND kind = 'product' LIMIT 1`, [code]);
      if (!row?.planCode || !modules[0]) return deny(res, 404, "errors.notFound");
      const decision = moduleChange({ role: user.role, planCode: row.planCode, category: String(modules[0].category), turningOn });
      if ("error" in decision) return deny(res, decision.error === "errors.forbidden" ? 403 : 409, decision.error);
      if (turningOn && code === "transcripts") {
        const parents = await queryRows(
          `SELECT 1 AS ok FROM tenant_modules WHERE tenant_id = ? AND module_code IN ('conversations', 'phone') AND enabled = 1 LIMIT 1`,
          [user.tenantId],
        );
        if (!parents[0]) return deny(res, 409, "errors.billing.needsNumbers");
      }
      await database().execute(
        `INSERT INTO tenant_modules (tenant_id, module_code, enabled) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
        [user.tenantId, code, turningOn ? 1 : 0],
      );
      if (!turningOn && code === "tasks") await clearDisabledTaskReminders(user.tenantId);
      if (!turningOn && (code === "conversations" || code === "phone")) {
        const parents = await queryRows(
          `SELECT 1 AS ok FROM tenant_modules WHERE tenant_id = ? AND module_code IN ('conversations', 'phone') AND enabled = 1 LIMIT 1`,
          [user.tenantId],
        );
        if (!parents[0]) {
          await database().execute(
            `UPDATE tenant_modules SET enabled = 0 WHERE tenant_id = ? AND module_code = 'transcripts'`,
            [user.tenantId],
          );
        }
      }
      await logActivity({
        tenantId: user.tenantId,
        actorType: "brokerage",
        actorId: user.id,
        action: turningOn ? "module.enabled" : "module.disabled",
        summary: turningOn ? `Turned on ${code}` : `Turned off ${code}`,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("[modules.toggle]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/billing/upgrade", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "office.read");
      if (!user?.tenantId) return;
      if (user.tenantStatus === "suspended") return deny(res, 403, "errors.suspended");
      const to = String(req.body?.planCode || "");
      const moduleCode = String(req.body?.moduleCode || "");
      const row = await loadBillingRow(user.tenantId);
      if (!row?.planCode) return deny(res, 404, "errors.notFound");
      const decision = upgradeChange({ role: user.role, from: row.planCode, to });
      if ("error" in decision) return deny(res, decision.error === "errors.forbidden" ? 403 : 409, decision.error);
      const stripe = stripeOrNull();
      if (row.subscriptionId) {
        if (!stripe) return deny(res, 503, "errors.stripe");
        const priced = await priceForPlan(stripe, to);
        if (!priced) return deny(res, 409, "errors.billing.quote");
        try {
          await retargetSubscription(stripe, row.subscriptionId, priced.priceId);
        } catch (error) {
          console.error("[billing.upgrade]", error instanceof Error ? error.message : error);
          return deny(res, 402, "errors.billing.card");
        }
        await database().execute(`UPDATE tenants SET plan_id = ? WHERE id = ?`, [priced.planId, user.tenantId]);
        await database().execute(`UPDATE tenant_subscriptions SET plan_id = ? WHERE tenant_id = ?`, [priced.planId, user.tenantId]);
      } else {
        const plans = await queryRows(`SELECT id FROM plans WHERE code = ? AND is_quote = 0 LIMIT 1`, [to]);
        if (!plans[0]) return deny(res, 409, "errors.billing.quote");
        await database().execute(`UPDATE tenants SET plan_id = ? WHERE id = ?`, [plans[0].id, user.tenantId]);
        await database().execute(`UPDATE tenant_subscriptions SET plan_id = ? WHERE tenant_id = ?`, [plans[0].id, user.tenantId]);
      }
      if (moduleCode) {
        const modules = await queryRows(`SELECT category FROM modules WHERE code = ? AND kind = 'product' LIMIT 1`, [moduleCode]);
        if (modules[0] && planIncludesModule(to, String(modules[0].category))) {
          await database().execute(
            `INSERT INTO tenant_modules (tenant_id, module_code, enabled) VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE enabled = 1`,
            [user.tenantId, moduleCode],
          );
        }
      }
      await logActivity({
        tenantId: user.tenantId,
        actorType: "brokerage",
        actorId: user.id,
        action: "billing.upgraded",
        summary: `Upgraded from ${row.planCode} to ${to}`,
      });
      res.json({ ok: true, planCode: to });
    } catch (error) {
      console.error("[billing.upgrade]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/billing/checkout", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write");
      if (!user?.tenantId) return;
      const stripe = stripeOrNull();
      if (!stripe || !stripePublishableKey()) return deny(res, 503, "errors.stripe");
      const row = await loadBillingRow(user.tenantId);
      if (!row || row.quoted || row.startFeeCents <= 0) return deny(res, 409, "errors.billing.notIncluded");
      if (row.startFeeStatus === "paid") return deny(res, 409, "errors.duplicate");
      let customerId = row.customerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.tenantName || undefined,
          metadata: { tenantId: String(user.tenantId) },
        });
        customerId = customer.id;
        await database().execute(`UPDATE tenant_subscriptions SET stripe_customer_id = ? WHERE tenant_id = ?`, [customerId, user.tenantId]);
      }
      if (row.checkoutSessionId) {
        const existing = await stripe.checkout.sessions.retrieve(row.checkoutSessionId);
        if (existing.status === "open" && existing.client_secret) {
          res.json({ ok: true, clientSecret: existing.client_secret });
          return;
        }
      }
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "elements",
        customer: customerId,
        client_reference_id: String(user.tenantId),
        return_url: `${publicOrigin(req)}/app/billing?session_id={CHECKOUT_SESSION_ID}`,
        metadata: { tenantId: String(user.tenantId), purpose: "start_fee" },
        payment_intent_data: {
          setup_future_usage: "off_session",
          metadata: { tenantId: String(user.tenantId), purpose: "start_fee" },
        },
        wallet_options: { link: { display: "never" } },
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: row.startFeeCents,
            product_data: { name: "MortgageProx trial start" },
          },
        }],
      });
      if (!session.client_secret) return deny(res, 502, "errors.stripe");
      await database().execute(
        `UPDATE tenant_subscriptions SET stripe_checkout_session_id = ?, stripe_customer_id = ? WHERE tenant_id = ?`,
        [session.id, customerId, user.tenantId],
      );
      res.json({ ok: true, clientSecret: session.client_secret });
    } catch (error) {
      console.error("[billing.checkout]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/billing/seats", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId) return;
      const action = req.body?.action === "remove" ? "remove" : req.body?.action === "add" ? "add" : "";
      if (!action) return deny(res, 400, "validation.wizard");
      const stripe = stripeOrNull();
      if (!stripe) return deny(res, 503, "errors.stripe");
      const row = await loadBillingRow(user.tenantId);
      if (!row) return deny(res, 404, "errors.notFound");
      const used = await usageCounts(user.tenantId);
      const next = seatChange({ used: used.seats, included: row.includedSeats, extra: row.extraSeats, action, quoted: row.quoted });
      if ("error" in next) return deny(res, 409, next.error);
      if (!row.subscriptionId) return deny(res, 409, "errors.billing.subscription");
      const priceId = await ensureExtraSeatPrice(stripe);
      if (!priceId) return deny(res, 500, "errors.server");
      const [claimed] = await database().execute(
        `UPDATE tenant_subscriptions SET extra_seats = ?, seats = ? WHERE tenant_id = ? AND extra_seats = ?`,
        [next.extra, row.includedSeats + next.extra, user.tenantId, row.extraSeats],
      );
      if (!num((claimed as { affectedRows?: number }).affectedRows)) return deny(res, 409, "errors.duplicate");
      try {
        await applyExtraSeats(stripe, row.subscriptionId, priceId, next.extra);
      } catch (error) {
        await database().execute(
          `UPDATE tenant_subscriptions SET extra_seats = ?, seats = ? WHERE tenant_id = ?`,
          [row.extraSeats, row.includedSeats + row.extraSeats, user.tenantId],
        );
        console.error("[billing.seats]", error instanceof Error ? error.message : error);
        return deny(res, 402, "errors.billing.card");
      }
      await logActivity({
        tenantId: user.tenantId,
        actorType: "brokerage",
        actorId: user.id,
        action: action === "add" ? "billing.seat_added" : "billing.seat_removed",
        summary: action === "add" ? "Added an extra seat" : "Removed an extra seat",
      });
      res.json({ ok: true, extra: next.extra });
    } catch (error) {
      console.error("[billing.seats]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/billing/packs", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId) return;
      const code = String(req.body?.code || "");
      const stripe = stripeOrNull();
      if (!stripe) return deny(res, 503, "errors.stripe");
      const row = await loadBillingRow(user.tenantId);
      if (!row || !row.customerId) return deny(res, 409, "errors.billing.subscription");
      const packs = await queryRows(`SELECT code, meter, units, price_cents FROM usage_packs WHERE code = ? LIMIT 1`, [code]);
      const pack = packs[0];
      if (!pack) return deny(res, 404, "errors.notFound");
      const meter = String(pack.meter);
      if (!packApplies(meter, row.caps[meter as AllowanceKey] ?? null, row.quoted)) return deny(res, 409, "errors.billing.pack");
      const methods = await stripe.paymentMethods.list({ customer: row.customerId, type: "card", limit: 1 });
      const paymentMethod = methods.data[0]?.id;
      if (!paymentMethod) return deny(res, 409, "errors.billing.card");
      try {
        const intent = await stripe.paymentIntents.create({
          amount: num(pack.price_cents),
          currency: "usd",
          customer: row.customerId,
          payment_method: paymentMethod,
          off_session: true,
          confirm: true,
          description: `MortgageProx ${meter} pack (${num(pack.units)})`,
          metadata: {
            purpose: "usage_pack",
            tenantId: String(user.tenantId),
            meter,
            units: String(num(pack.units)),
            packCode: String(pack.code),
          },
        });
        if (intent.status === "succeeded") {
          await grantUsagePack(intent);
          res.json({ ok: true });
          return;
        }
        if (intent.status === "requires_action" && intent.client_secret) {
          res.json({ ok: true, requiresAction: true, clientSecret: intent.client_secret, paymentIntentId: intent.id });
          return;
        }
        return deny(res, 402, "errors.billing.card");
      } catch (error) {
        const pending = (error as { payment_intent?: Stripe.PaymentIntent; raw?: { payment_intent?: Stripe.PaymentIntent } }).payment_intent
          || (error as { raw?: { payment_intent?: Stripe.PaymentIntent } }).raw?.payment_intent;
        if (pending?.status === "requires_action" && pending.client_secret) {
          res.json({ ok: true, requiresAction: true, clientSecret: pending.client_secret, paymentIntentId: pending.id });
          return;
        }
        console.error("[billing.packs]", error instanceof Error ? error.message : error);
        return deny(res, 402, "errors.billing.card");
      }
    } catch (error) {
      console.error("[billing.packs]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/billing/packs/complete", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId) return;
      const stripe = stripeOrNull();
      if (!stripe) return deny(res, 503, "errors.stripe");
      const paymentIntentId = String(req.body?.paymentIntentId || "");
      if (!paymentIntentId.startsWith("pi_")) return deny(res, 400, "validation.wizard");
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.metadata?.purpose !== "usage_pack" || String(intent.metadata.tenantId) !== String(user.tenantId)) return deny(res, 404, "errors.notFound");
      if (intent.status !== "succeeded") return deny(res, 402, "errors.paymentRequired");
      await grantUsagePack(intent);
      res.json({ ok: true });
    } catch (error) {
      console.error("[billing.packs.complete]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/campaigns", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.read");
      if (!user?.tenantId || !(await requireModule(user, "campaigns", res))) return;
      const topicId = Math.floor(Number(req.query.topicId) || 0);
      const search = clip(req.query.search, 80);
      const term = likeTerm(search);
      const account = await campaignAccount(user.tenantId);
      if (account.included <= 0) return deny(res, 403, "errors.billing.notIncluded");
      const topics = await queryRows(
        `SELECT t.id, t.name, COUNT(s.contact_id) AS subscribers
           FROM campaign_topics t
           LEFT JOIN campaign_subscriptions s ON s.topic_id = t.id AND s.status = 'subscribed'
          WHERE t.tenant_id = ?
          GROUP BY t.id, t.name
          ORDER BY t.name`,
        [user.tenantId],
      );
      const contacts = topicId
        ? await queryRows(
          `SELECT c.id, c.email, c.full_name
             FROM campaign_contacts c
             JOIN campaign_subscriptions s ON s.contact_id = c.id AND s.topic_id = ? AND s.status = 'subscribed'
             JOIN campaign_topics t ON t.id = s.topic_id AND t.tenant_id = ?
            WHERE c.tenant_id = ? AND c.status = 'subscribed'
            ORDER BY c.full_name, c.email
            LIMIT 200`,
          [topicId, user.tenantId, user.tenantId],
        )
        : [];
      const sent = await queryRows(
        `SELECT c.id, c.name, c.subject, c.status, c.audience_count, c.opened_count, c.clicked_count, c.sent_at, t.name AS topic_name
           FROM campaigns c
           JOIN campaign_topics t ON t.id = c.topic_id
          WHERE c.tenant_id = ?
            AND (? = '' OR c.name LIKE ? ESCAPE '\\\\' OR c.subject LIKE ? ESCAPE '\\\\')
          ORDER BY c.id DESC
          LIMIT 50`,
        [user.tenantId, search, term, term],
      );
      const desk: CampaignDesk = {
        allowance: {
          included: account.included,
          packs: account.packs,
          packSize: CAMPAIGN_PACK_SIZE,
          priceCents: account.priceCents,
          used: account.used,
          ceiling: account.ceiling,
          ceilingUsed: account.platformUsed,
        },
        topics: topics.map((row): CampaignTopic => ({ id: num(row.id), name: String(row.name), subscribers: num(row.subscribers) })),
        contacts: contacts.map((row): CampaignContact => ({ id: num(row.id), email: String(row.email), name: String(row.full_name || "") })),
        campaigns: sent.map((row): CampaignItem => ({
          id: num(row.id),
          name: String(row.name),
          subject: String(row.subject),
          topicName: String(row.topic_name || ""),
          status: String(row.status),
          audienceCount: num(row.audience_count),
          openedCount: num(row.opened_count),
          clickedCount: num(row.clicked_count),
          sentAt: iso(row.sent_at),
        })),
      };
      res.json({ ok: true, ...desk });
    } catch (error) {
      console.error("[campaigns]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.get("/api/app/campaigns/people", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.read");
      if (!user?.tenantId || !(await requireModule(user, "campaigns", res))) return;
      const source = ["clients", "contacts", "realtors"].includes(String(req.query.source)) ? String(req.query.source) : "clients";
      const topicId = Math.floor(Number(req.query.topicId) || 0);
      const search = clip(req.query.search, 80);
      const term = likeTerm(search);
      const scope = clientScope(user.role);
      const rows = await queryRows(
        `SELECT id, first_name, last_name, email FROM ${source}
          WHERE tenant_id = ? AND email IS NOT NULL AND email <> ''
            AND (? = 'all' OR assigned_user_id = ?)
            AND (? = '' OR first_name LIKE ? ESCAPE '\\\\' OR last_name LIKE ? ESCAPE '\\\\' OR email LIKE ? ESCAPE '\\\\')
          ORDER BY last_name, first_name
          LIMIT 40`,
        [user.tenantId, scope, user.id, search, term, term, term],
      );
      const emails = rows.map((row) => normalizeEmail(row.email)).filter((email) => EMAIL_RE.test(email));
      const onList = new Set<string>();
      if (topicId && emails.length) {
        const marks = emails.map(() => "?").join(",");
        const listed = await queryRows(
          `SELECT c.email FROM campaign_contacts c
             JOIN campaign_subscriptions s ON s.contact_id = c.id AND s.topic_id = ? AND s.status = 'subscribed'
            WHERE c.tenant_id = ? AND c.email IN (${marks})`,
          [topicId, user.tenantId, ...emails],
        );
        listed.forEach((row) => onList.add(String(row.email)));
      }
      const people: CampaignPerson[] = rows.map((row) => {
        const email = normalizeEmail(row.email);
        return {
          id: num(row.id),
          name: `${row.first_name} ${row.last_name}`.trim(),
          email,
          onList: onList.has(email),
        };
      });
      res.json({ ok: true, people });
    } catch (error) {
      console.error("[campaigns.people]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/campaigns/topics", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.write", true);
      if (!user?.tenantId || !(await requireModule(user, "campaigns", res))) return;
      const name = clip(req.body?.name, 80);
      if (name.length < 2) return deny(res, 400, "validation.wizard");
      try {
        const [inserted] = await database().execute(
          `INSERT INTO campaign_topics (tenant_id, name) VALUES (?, ?)`,
          [user.tenantId, name],
        );
        res.status(201).json({ ok: true, id: num((inserted as { insertId?: number }).insertId) });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "ER_DUP_ENTRY") return deny(res, 409, "errors.duplicate");
        throw error;
      }
    } catch (error) {
      console.error("[campaigns.topic]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/campaigns/audience", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.write", true);
      if (!user?.tenantId || !(await requireModule(user, "campaigns", res))) return;
      const topicId = Math.floor(Number(req.body?.topicId) || 0);
      const source = ["clients", "contacts", "realtors"].includes(String(req.body?.source)) ? String(req.body.source) : "";
      const ids = campaignIds(req.body?.ids);
      const confirmRaw = req.body?.confirmPacks;
      const confirmPacks = confirmRaw == null || confirmRaw === "" ? null : Math.floor(Number(confirmRaw));
      if (!topicId || !source || !ids.length || (confirmPacks != null && !Number.isFinite(confirmPacks))) return deny(res, 400, "validation.wizard");
      const topics = await queryRows(`SELECT id, name FROM campaign_topics WHERE id = ? AND tenant_id = ? LIMIT 1`, [topicId, user.tenantId]);
      if (!topics[0]) return deny(res, 404, "errors.notFound");
      const scope = clientScope(user.role);
      const marks = ids.map(() => "?").join(",");
      const rows = await queryRows(
        `SELECT id, email, first_name, last_name FROM ${source}
          WHERE tenant_id = ? AND id IN (${marks}) AND email IS NOT NULL AND email <> ''
            AND (? = 'all' OR assigned_user_id = ?)`,
        [user.tenantId, ...ids, scope, user.id],
      );
      const picked = new Map<string, { email: string; name: string }>();
      for (const row of rows) {
        const email = normalizeEmail(row.email);
        if (!EMAIL_RE.test(email) || picked.has(email)) continue;
        picked.set(email, { email, name: `${row.first_name} ${row.last_name}`.trim().slice(0, 160) });
      }
      if (!picked.size) return deny(res, 409, "errors.campaigns.empty");
      const emails = [...picked.keys()];
      const emailMarks = emails.map(() => "?").join(",");
      const owned = await queryRows(
        `SELECT c.id, c.email, c.status, s.status AS topic_status
           FROM campaign_contacts c
           LEFT JOIN campaign_subscriptions s ON s.contact_id = c.id AND s.topic_id = ?
          WHERE c.tenant_id = ? AND c.email IN (${emailMarks})`,
        [topicId, user.tenantId, ...emails],
      );
      const byEmail = new Map(owned.map((row) => [String(row.email), row]));
      const joining = emails.filter((email) => String(byEmail.get(email)?.topic_status || "") !== "subscribed");
      if (!joining.length) return deny(res, 409, "errors.duplicate");
      const adding = joining.filter((email) => String(byEmail.get(email)?.status || "") !== "subscribed");
      const globalRows = adding.length
        ? await queryRows(
          `SELECT DISTINCT email FROM campaign_contacts WHERE status = 'subscribed' AND email IN (${adding.map(() => "?").join(",")})`,
          adding,
        )
        : [];
      const alreadyPlatform = new Set(globalRows.map((row) => String(row.email)));
      const platformAdding = adding.filter((email) => !alreadyPlatform.has(email)).length;
      const account = await campaignAccount(user.tenantId);
      const decision = campaignRoom({
        used: account.used,
        included: account.included,
        packs: account.packs,
        adding: adding.length,
        platformUsed: account.platformUsed,
        platformAdding,
        ceiling: account.ceiling,
        confirmPacks,
        priceCents: account.priceCents,
      });
      if ("error" in decision) {
        if (decision.error === "errors.campaigns.pack") {
          res.status(409).json({ error: decision.error, packs: decision.packs, priceCents: decision.priceCents });
          return;
        }
        return deny(res, 409, decision.error);
      }
      if (decision.packsToBuy > 0 && !roleCan(user.role, "settings.write")) return deny(res, 403, "errors.forbidden");
      const resend = campaignResend();
      let segmentId = "";
      let remoteTopic = "";
      if (resend) {
        segmentId = (await ensureCampaignSegment(resend)) || "";
        remoteTopic = (await ensureCampaignTopic(resend, topicId, user.tenantId, String(topics[0].name))) || "";
        if (!segmentId || !remoteTopic) return deny(res, 502, "errors.campaigns.sync");
        for (const email of joining) {
          const synced = await syncCampaignContact(resend, {
            email,
            name: picked.get(email)?.name || "",
            segmentId,
            topicId: remoteTopic,
            subscription: "opt_in",
          });
          if (!synced) return deny(res, 502, "errors.campaigns.sync");
        }
      }
      if (decision.packsToBuy > 0) {
        const charged = await chargeCampaignPacks(user.tenantId, account.packs, account.packs + decision.packsToBuy);
        if (charged) return deny(res, charged === "errors.stripe" || charged === "errors.server" ? 503 : 409, charged);
      }
      for (const email of joining) {
        const person = picked.get(email);
        if (!person) continue;
        const current = byEmail.get(email);
        let contactId = current ? num(current.id) : 0;
        if (!contactId) {
          const [inserted] = await database().execute(
            `INSERT INTO campaign_contacts (tenant_id, email, full_name, status) VALUES (?, ?, ?, 'subscribed')`,
            [user.tenantId, email, person.name],
          );
          contactId = num((inserted as { insertId?: number }).insertId);
        } else if (String(current?.status || "") !== "subscribed") {
          await database().execute(
            `UPDATE campaign_contacts SET status = 'subscribed', full_name = ?, unsubscribed_at = NULL WHERE id = ? AND tenant_id = ?`,
            [person.name, contactId, user.tenantId],
          );
        }
        await database().execute(
          `INSERT INTO campaign_subscriptions (contact_id, topic_id, status) VALUES (?, ?, 'subscribed')
           ON DUPLICATE KEY UPDATE status = 'subscribed'`,
          [contactId, topicId],
        );
      }
      res.json({ ok: true, added: joining.length, packs: decision.packsToBuy });
    } catch (error) {
      console.error("[campaigns.audience]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/campaigns/audience/remove", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.write", true);
      if (!user?.tenantId || !(await requireModule(user, "campaigns", res))) return;
      const topicId = Math.floor(Number(req.body?.topicId) || 0);
      const contactId = Math.floor(Number(req.body?.contactId) || 0);
      if (!topicId || !contactId) return deny(res, 400, "validation.wizard");
      const rows = await queryRows(
        `SELECT c.email, t.resend_topic_id
           FROM campaign_contacts c
           JOIN campaign_topics t ON t.id = ? AND t.tenant_id = c.tenant_id
          WHERE c.id = ? AND c.tenant_id = ? LIMIT 1`,
        [topicId, contactId, user.tenantId],
      );
      if (!rows[0]) return deny(res, 404, "errors.notFound");
      const resend = campaignResend();
      if (resend && rows[0].resend_topic_id) {
        const segmentId = await ensureCampaignSegment(resend);
        if (segmentId) {
          const synced = await syncCampaignContact(resend, {
            email: String(rows[0].email),
            name: "",
            segmentId,
            topicId: String(rows[0].resend_topic_id),
            subscription: "opt_out",
          });
          if (!synced) return deny(res, 502, "errors.campaigns.sync");
        }
      }
      await database().execute(
        `UPDATE campaign_subscriptions SET status = 'unsubscribed' WHERE contact_id = ? AND topic_id = ?`,
        [contactId, topicId],
      );
      const still = await queryRows(
        `SELECT 1 AS ok FROM campaign_subscriptions WHERE contact_id = ? AND status = 'subscribed' LIMIT 1`,
        [contactId],
      );
      if (!still[0]) {
        await database().execute(
          `UPDATE campaign_contacts SET status = 'unsubscribed', unsubscribed_at = NOW() WHERE id = ? AND tenant_id = ?`,
          [contactId, user.tenantId],
        );
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[campaigns.remove]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/campaigns", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "inbox.write", true);
      if (!user?.tenantId || !(await requireModule(user, "campaigns", res))) return;
      const topicId = Math.floor(Number(req.body?.topicId) || 0);
      const name = clip(req.body?.name, 140);
      const subject = clip(req.body?.subject, 200);
      const body = clip(req.body?.body, 8000);
      if (!topicId || name.length < 2 || subject.length < 2 || body.length < 2) return deny(res, 400, "validation.wizard");
      const topics = await queryRows(`SELECT id, name, resend_topic_id FROM campaign_topics WHERE id = ? AND tenant_id = ? LIMIT 1`, [topicId, user.tenantId]);
      if (!topics[0]) return deny(res, 404, "errors.notFound");
      const audience = await queryRows(
        `SELECT COUNT(*) AS total FROM campaign_subscriptions s
           JOIN campaign_contacts c ON c.id = s.contact_id AND c.tenant_id = ? AND c.status = 'subscribed'
          WHERE s.topic_id = ? AND s.status = 'subscribed'`,
        [user.tenantId, topicId],
      );
      const audienceCount = num(audience[0]?.total);
      if (!audienceCount) return deny(res, 409, "errors.campaigns.empty");
      const [inserted] = await database().execute(
        `INSERT INTO campaigns (tenant_id, topic_id, name, subject, body, status, audience_count, created_by)
         VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
        [user.tenantId, topicId, name, subject, body, audienceCount, user.id],
      );
      const campaignId = num((inserted as { insertId?: number }).insertId);
      const resend = campaignResend();
      if (!resend) {
        if (!notifySandbox()) {
          await database().execute(`UPDATE campaigns SET status = 'failed' WHERE id = ? AND tenant_id = ?`, [campaignId, user.tenantId]);
          return deny(res, 502, "errors.campaigns.send");
        }
        await database().execute(
          `UPDATE campaigns SET status = 'sent', sent_at = NOW() WHERE id = ? AND tenant_id = ?`,
          [campaignId, user.tenantId],
        );
        res.status(201).json({ ok: true, id: campaignId, status: "sent" });
        return;
      }
      const segmentId = await ensureCampaignSegment(resend);
      const remoteTopic = await ensureCampaignTopic(resend, topicId, user.tenantId, String(topics[0].name));
      const office = await queryRows(`SELECT name, support_email FROM tenants WHERE id = ? LIMIT 1`, [user.tenantId]);
      const replyTo = office[0]?.support_email && EMAIL_RE.test(String(office[0].support_email)) ? String(office[0].support_email) : undefined;
      const sent = segmentId && remoteTopic
        ? await resend.broadcasts.create({
          segmentId,
          topicId: remoteTopic,
          from: fromHeader(office[0]?.name ? String(office[0].name) : user.tenantName || undefined),
          replyTo,
          subject,
          html: campaignHtml(body),
          text: `${body}\n\nUnsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}`,
          name,
          send: true,
        })
        : { data: null, error: { message: "missing audience" } };
      if (sent.error || !sent.data?.id) {
        await database().execute(`UPDATE campaigns SET status = 'failed' WHERE id = ? AND tenant_id = ?`, [campaignId, user.tenantId]);
        console.error("[campaigns.send]", sent.error?.message || "send failed");
        return deny(res, 502, "errors.campaigns.send");
      }
      await database().execute(
        `UPDATE campaigns SET status = 'sent', sent_at = NOW(), resend_broadcast_id = ? WHERE id = ? AND tenant_id = ?`,
        [sent.data.id, campaignId, user.tenantId],
      );
      res.status(201).json({ ok: true, id: campaignId, status: "sent" });
    } catch (error) {
      console.error("[campaigns.send]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/app/billing/campaign-packs", async (req, res) => {
    try {
      const user = await requireBroker(req, res, "settings.write", true);
      if (!user?.tenantId) return;
      const action = req.body?.action === "remove" ? "remove" : req.body?.action === "add" ? "add" : "";
      if (!action) return deny(res, 400, "validation.wizard");
      const account = await campaignAccount(user.tenantId);
      const next = campaignPackChange({ used: account.used, included: account.included, packs: account.packs, action });
      if ("error" in next) return deny(res, 409, next.error);
      if (action === "add" && account.platformUsed + CAMPAIGN_PACK_SIZE > account.ceiling) {
        return deny(res, 409, "errors.campaigns.capacity");
      }
      const charged = await chargeCampaignPacks(user.tenantId, account.packs, next.packs);
      if (charged) return deny(res, charged === "errors.stripe" || charged === "errors.server" ? 503 : 409, charged);
      res.json({ ok: true, packs: next.packs });
    } catch (error) {
      console.error("[billing.campaignPacks]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/resend/webhook", async (req, res) => {
    const secret = String(process.env.RESEND_WEBHOOK_SECRET || "").trim();
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!secret) return deny(res, 503, "errors.campaigns.send");
    if (!raw) return deny(res, 400, "errors.campaigns.send");
    const ok = verifyResendWebhook(raw.toString("utf8"), {
      id: String(req.headers["svix-id"] || ""),
      timestamp: String(req.headers["svix-timestamp"] || ""),
      signature: String(req.headers["svix-signature"] || ""),
    }, secret);
    if (!ok) return deny(res, 400, "errors.unauthorized");
    try {
      await applyCampaignWebhook(req.body || {});
      res.json({ ok: true });
    } catch (error) {
      console.error("[resend.webhook]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
    const stripe = stripeOrNull();
    const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!stripe || !secret) return deny(res, 503, "errors.stripe");
    if (!raw) return deny(res, 400, "errors.stripe");
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, String(req.headers["stripe-signature"] || ""), secret);
    } catch {
      return deny(res, 400, "errors.stripe");
    }
    try {
      const seen = await queryRows(`SELECT id FROM stripe_events WHERE id = ? LIMIT 1`, [event.id]);
      if (seen[0]) {
        res.json({ ok: true });
        return;
      }
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "unpaid" && session.metadata?.purpose === "wizard_start") await openPaidWizard(stripe, session, "", appOrigin());
        else if (session.payment_status !== "unpaid") await fulfillStartFee(stripe, session);
      } else if (event.type === "payment_intent.succeeded") {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.metadata?.purpose === "usage_pack") await grantUsagePack(intent);
      } else if (event.type === "invoice.paid") {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);
        if (subId && num(invoice.amount_paid) > 0) await applySubscriptionStatus(subId, "active");
      } else if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);
        if (subId) {
          const rows = await queryRows(`SELECT tenant_id FROM tenant_subscriptions WHERE stripe_subscription_id = ? LIMIT 1`, [subId]);
          if (rows[0]) {
            await logActivity({
              tenantId: num(rows[0].tenant_id),
              actorType: "platform",
              actorId: null,
              action: "billing.payment_failed",
              summary: "A subscription invoice failed",
            });
          }
        }
      } else if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as Stripe.Subscription;
        await applySubscriptionStatus(subscription.id, "canceled");
      }
      await database().execute(`INSERT IGNORE INTO stripe_events (id, event_type) VALUES (?, ?)`, [event.id, event.type]);
      res.json({ ok: true });
    } catch (error) {
      console.error("[stripe.webhook]", error instanceof Error ? error.message : error);
      deny(res, 500, "errors.server");
    }
  });

  app.use("/api", (_req, res) => {
    deny(res, 404, "errors.notFound");
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError) return deny(res, 400, "validation.invalidJson");
    console.error("[api]", err instanceof Error ? err.message : err);
    deny(res, 500, "errors.server");
  });

  flowHooks.planFlowStep = planFlowStep;
  flowHooks.reminderLibrary = reminderLibrary;
  flowHooks.quietUntil = quietUntil;
  return app;
}

const app = buildApp();

export function createServer() {
  return app;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as unknown as Request, res as unknown as Response);
}

export const __test = {
  ROLE_PERMISSIONS,
  OFFICE_CATALOG,
  OFFICE_ROLE_ALLOW,
  OFFICE_ROLE_HIDDEN,
  sectionVisible,
  roleCan,
  recommendPlan,
  get planFlowStep() {
    return flowHooks.planFlowStep;
  },
  get reminderLibrary() {
    return flowHooks.reminderLibrary;
  },
  get quietUntil() {
    return flowHooks.quietUntil;
  },
  taskReminderSlots,
  taskVisibleTo,
  boardPagination,
  loanStageMove,
  moduleMinimumPlan,
  planIncludesModule,
  moduleChange,
  upgradeChange,
  withWizardRules,
  parseWizard,
  parseGridQuery,
  ringPlan,
  toE164,
  mismoDocument,
  microsoftAuthUrl,
  signState,
  readState,
  tenantHost,
  tenantSlugFromHost,
  tenantLegalStarter,
  tenantEmailStarters,
  applicantWelcome,
  renderEmail,
  fillEmail,
  platformEmailDefaults,
  PLATFORM_BRAND,
  normalizeHostname,
  parseBrand,
  normalizeHex,
  readImageUpload,
  meterState,
  allowanceDecision,
  seatChange,
  campaignIncluded,
  campaignRoom,
  campaignPackChange,
  campaignHtml,
  personSlugBase,
  verifyResendWebhook,
  packApplies,
  smsSegments,
  voiceMinutes,
  sha256,
  MCP_CALL_CENTS,
  mcpDecision,
  setDb(next: Db | null) {
    testDb = next;
  },
  outbox,
  clearOutbox() {
    outbox.length = 0;
  },
};
