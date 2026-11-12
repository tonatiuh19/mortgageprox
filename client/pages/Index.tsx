import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Globe,
  Mail,
  Palette,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";

const brands = [
  {
    name: "Northwind Mortgage",
    domain: "northwindmortgage.com",
    initials: "NW",
    primary: "221 72% 46%",
    phone: "(415) 555-0142",
    card: "rounded-2xl",
    header: "border-b border-border",
    avatar: "rounded-xl",
    heading: "font-display text-3xl tracking-tight",
    button: "",
  },
  {
    name: "Harbor Home Loans",
    domain: "harborhomeloans.com",
    initials: "HH",
    primary: "172 62% 32%",
    phone: "(206) 555-0187",
    card: "rounded-md",
    header: "border-b border-primary/20 bg-primary/5",
    avatar: "rounded-md",
    heading: "font-sans text-3xl font-semibold tracking-tight",
    button: "rounded-sm",
  },
  {
    name: "Juniper Lending",
    domain: "juniperlending.com",
    initials: "JL",
    primary: "16 72% 48%",
    phone: "(303) 555-0129",
    card: "rounded-[2rem]",
    header: "border-b border-border",
    avatar: "rounded-full",
    heading: "font-display text-3xl italic",
    button: "rounded-full",
  },
];

const whiteLabelPoints = [
  {
    icon: Palette,
    title: "Their brand everywhere",
    text: "Logo, colors, fonts and favicon across the website, workspace, portal, emails, texts and letters.",
  },
  {
    icon: Globe,
    title: "Their own web address",
    text: "Borrowers land on portal.theirbrokerage.com, not on a MortgageProx domain.",
  },
  {
    icon: Phone,
    title: "Their own numbers and sender",
    text: "Messages, calls and emails come from the brokerage, never from MortgageProx.",
  },
  {
    icon: Sparkles,
    title: "Their own way of working",
    text: "Stage names and order, message templates, follow-up flows, roles and what each role sees.",
  },
  {
    icon: ShieldCheck,
    title: "Their data, kept separate",
    text: "Every brokerage's clients, loans and conversations stay private to that company.",
  },
];

const roles = [
  {
    title: "MortgageProx team",
    text: "Launches each brokerage, configures company settings and supports the team after go-live.",
  },
  {
    title: "Owners and leadership",
    text: "See the whole business, set up the team and decide exactly who can see what.",
  },
  {
    title: "Loan officers",
    text: "Run their own clients, loans and conversations from one focused workspace.",
  },
  {
    title: "Real-estate partners",
    text: "Referral agents the brokerage works with, kept informed and marketed to in one place.",
  },
  {
    title: "Borrowers",
    text: "A private, branded portal to apply, upload, sign and follow every step of the loan.",
  },
];

const launchSteps = [
  {
    step: "01",
    title: "Brand it",
    text: "Add your logo, colors, fonts and favicon, then connect your own web address.",
  },
  {
    step: "02",
    title: "Set your way of working",
    text: "Start from ready-made stages, message templates and reminder flows, then reorder and edit them.",
  },
  {
    step: "03",
    title: "Bring in the team",
    text: "Add loan officers and partners, assign phone lines and choose what each role can see.",
  },
];

const moduleGroups: { heading: string; items: [string, string][] }[] = [
  {
    heading: "Win the client",
    items: [
      ["Branded website", "Home page, loan options, about, FAQ and contact form."],
      ["Loan application", "Guided step by step, or entered by a loan officer."],
      ["Clients and leads", "Address book with history, loans, notes and lead source."],
      ["People and groups", "Households, co-borrowers and VIP partners handled together."],
      ["Realtor management", "A directory of agent partners and prospects to nurture."],
      ["Scheduler", "Branded booking page with availability and automatic video links."],
      ["Calculators", "Payment and income tools for the team and borrowers."],
      ["Credit analysis", "Borrowers upload a credit report and get a clear summary."],
    ],
  },
  {
    heading: "Move the loan",
    items: [
      ["Pipeline", "A visual board from first application to funded."],
      ["Tasks", "Included from Growth. A board for the team, with due times and reminders."],
      ["Documents", "Uploads and e-sign on the loan file. Included with every plan."],
      ["Compliance", "Standard checklists so every file follows required steps."],
      ["Pre-approval letters", "Chosen with Growth. Letters on the brokerage's letterhead."],
      ["Calendar", "Appointments plus birthdays, anniversaries and milestones."],
    ],
  },
  {
    heading: "Talk to everyone",
    items: [
      ["Conversations", "Texts and calls in one thread, from the brokerage's numbers."],
      ["Phone", "Browser calling, cell forwarding and transcribed voicemail."],
      ["Email", "Team mail with branded signatures. A Microsoft 365 account can be connected."],
      ["Call transcripts", "The words of a call land on the conversation and in an email."],
      ["Templates", "Email, text and stage messages that sound like the brokerage."],
      ["Reminder flows", "Drag-and-drop follow-up sequences from a starter library."],
      ["Broadcasts", "Branded announcements with open and click tracking."],
      ["Notifications", "In-app and email alerts, chosen by each person."],
    ],
  },
  {
    heading: "Run the business",
    items: [
      ["Dashboard and reports", "Pipeline size, conversion, closing time and goals."],
      ["Borrower portal", "Loans, tasks, documents, calculator and profile."],
      ["Team and permissions", "Roles, phone line assignments and section visibility."],
      ["Brand and settings", "Logo, colors, web address, phone, sender and defaults."],
      ["Activity log", "A record of who did what and when."],
      ["AI assistant", "Under the brokerage's chosen name, drafts and answers."],
    ],
  },
];

const stageRows = [
  { name: "Application", count: 6, pct: 42 },
  { name: "Documents", count: 8, pct: 58 },
  { name: "Underwriting", count: 5, pct: 36 },
  { name: "Clear to close", count: 3, pct: 22 },
  { name: "Funded", count: 12, pct: 84 },
];

const marqueeItems = [
  "Pipeline",
  "Clear to close",
  "Pre-approval letters",
  "Reminder flows",
  "Borrower portal",
  "Compliance checklists",
  "Branded email",
  "Transcribed voicemail",
  "Credit analysis",
  "Realtor partners",
];

function Words({ text, delay = 150 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block animate-word-rise"
          style={{ animationDelay: `${delay + i * 80}ms` }}
        >
          {word}&nbsp;
        </span>
      ))}
    </>
  );
}

function CountUp({
  to,
  prefix = "",
  suffix = "",
  duration = 1600,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.5);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Reveal className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
        {title}
      </h2>
      {children && (
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
    </Reveal>
  );
}

function HeroPreview() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-primary/10 blur-3xl" />
      <div
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const px = (event.clientX - rect.left) / rect.width - 0.5;
          const py = (event.clientY - rect.top) / rect.height - 0.5;
          setTilt({ x: py * -8, y: px * 10 });
        }}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        style={{
          transform: `perspective(1400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
        className="relative transition-transform duration-500 ease-out will-change-transform"
      >
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-float sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Pipeline · This week
              </p>
              <p className="mt-1 font-display text-2xl">
                <CountUp to={4820400} prefix="$" />
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              On track
            </span>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              [23, "", "Active applications"],
              [11, "d", "Avg. to close"],
              [38, "%", "Conversion"],
            ].map(([value, suffix, label]) => (
              <div key={label} className="rounded-xl bg-muted/70 p-3">
                <p className="text-lg font-semibold">
                  <CountUp to={value as number} suffix={suffix as string} />
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3.5">
            {stageRows.map((stage, i) => (
              <div key={stage.name}>
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>{stage.name}</span>
                  <span className="tabular-nums">{stage.count}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full origin-left animate-grow-x rounded-full bg-primary"
                    style={{
                      width: `${stage.pct}%`,
                      animationDelay: `${500 + i * 120}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 divide-y divide-border rounded-xl border border-border">
            {[
              ["Maya Chen", "Purchase · $612,000", "Docs received", "emerald"],
              ["James Okafor", "Refinance · $389,500", "Needs pay stubs", "amber"],
            ].map(([name, detail, status, tone]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    {detail}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    tone === "emerald"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
                  )}
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function BrandPreview() {
  const [index, setIndex] = useState(0);
  const brand = brands[index];

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Preview a brokerage brand"
        className="inline-flex flex-wrap gap-1.5 rounded-xl border border-border bg-card p-1"
      >
        {brands.map((item, i) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-300",
              i === index
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div
        key={brand.name}
        style={
          {
            "--primary": brand.primary,
            "--primary-foreground": "0 0% 100%",
          } as CSSProperties
        }
        className={cn(
          "animate-slide-up overflow-hidden border border-border bg-card shadow-float",
          brand.card,
        )}
      >
        <div className={cn("flex items-center gap-2 px-4 py-3", brand.header)}>
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ml-3 truncate rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
            portal.{brand.domain}
          </span>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-9 items-center justify-center bg-primary text-sm font-semibold text-primary-foreground",
                  brand.avatar,
                )}
              >
                {brand.initials}
              </span>
              <span className="font-semibold">{brand.name}</span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {brand.phone}
            </span>
          </div>

          <h3 className={cn("mt-10 animate-word-rise", brand.heading)}>
            Welcome home, Maya.
          </h3>
          <p className="mt-2 text-muted-foreground">
            Your loan is moving. Two documents are left to upload.
          </p>

          <div className="mt-8">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>Underwriting</span>
              <span className="tabular-nums">Step 4 of 6</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-full w-2/3 origin-left animate-grow-x rounded-full bg-primary"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button className={brand.button}>Upload documents</Button>
            <Button variant="outline" className={brand.button}>
              Message your officer
            </Button>
          </div>

          <p className="mt-8 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
            <Mail className="size-3.5" />
            Messages arrive from {brand.name}, never from MortgageProx.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.10),transparent)]" />
        <div className="pointer-events-none absolute -left-32 top-32 -z-10 size-[28rem] animate-drift rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-16 -z-10 size-96 animate-drift-alt rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-500/10" />
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-32 lg:pt-24">
          <div>
            <h1 className="font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.5rem]">
              <Words text="The office around the loan," />
              <em
                className="inline-block animate-word-rise italic"
                style={{ animationDelay: "560ms" }}
              >
                <span className="text-shimmer">in your own brand.</span>
              </em>
            </h1>
            <p
              className="animate-slide-up mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground [animation-delay:800ms]"
            >
              MortgageProx gives each brokerage a complete system for the
              people, paperwork and conversations behind every home loan, with
              a borrower portal that carries only its name.
            </p>
            <div className="animate-slide-up mt-10 flex flex-wrap gap-3 [animation-delay:950ms]">
              <Button asChild size="lg">
                <Link to="/start">
                  Launch your brokerage
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/pricing">See packages</Link>
              </Button>
            </div>
            <p className="animate-fade-in mt-8 text-sm text-muted-foreground [animation-delay:1100ms]">
              MortgageProx is not a bank and does not approve loans. It is the
              office around the loan, ready on day one.
            </p>
          </div>

          <HeroPreview />
        </div>
      </section>

      <div className="relative overflow-hidden border-y border-border bg-card/60 py-6 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="flex shrink-0 items-center gap-10 whitespace-nowrap pr-10 font-display text-2xl text-muted-foreground/80"
            >
              {item}
              <span className="size-1.5 rounded-full bg-primary/70" />
            </span>
          ))}
        </div>
      </div>

      <section id="white-label" className="scroll-mt-20 border-t border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div>
              <SectionHeading
                eyebrow="White-label by default"
                title="Every touchpoint wears the brokerage's name."
              >
                Each company gets its own website, logo, colors, web address,
                phone numbers and email identity. Their team and borrowers only
                ever see their brand.
              </SectionHeading>
              <ul className="mt-12 space-y-7">
                {whiteLabelPoints.map((point, i) => (
                  <li key={point.title} className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-transform duration-300 hover:scale-110">
                      <point.icon className="size-5" />
                    </span>
                    <Reveal delay={i * 90}>
                      <h3 className="font-semibold">{point.title}</h3>
                      <p className="mt-1 leading-relaxed text-muted-foreground">
                        {point.text}
                      </p>
                    </Reveal>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:sticky lg:top-28">
              <Reveal>
                <BrandPreview />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section id="roles" className="scroll-mt-20 mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <SectionHeading
          eyebrow="Built for everyone in the loan"
          title="One platform, five clear views."
        >
          Each person sees what they need, and nothing they should not.
        </SectionHeading>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {roles.map((role, i) => (
            <Reveal key={role.title} delay={i * 90} className="h-full">
              <div className="group h-full rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-float">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold tabular-nums text-primary transition-transform duration-300 group-hover:scale-110">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-6 font-semibold">{role.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {role.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="launch" className="scroll-mt-20 border-t border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <SectionHeading
              eyebrow="Fast launch"
              title="Ready on day one, yours over time."
            >
              A guided setup with ready-made templates and flows means a new
              brokerage can start working right away.
            </SectionHeading>
            <Reveal delay={150}>
              <Button asChild variant="outline" size="lg" className="shrink-0">
                <Link to="/start">
                  Start a 30-day trial
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </Reveal>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {launchSteps.map((step, i) => (
              <Reveal key={step.step} delay={i * 120} className="h-full">
                <div className="group h-full rounded-2xl border border-border bg-background p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-float">
                  <span className="inline-block font-display text-4xl tabular-nums text-primary/80 transition-transform duration-500 group-hover:translate-x-1">
                    {step.step}
                  </span>
                  <h3 className="mt-8 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="scroll-mt-20 mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <SectionHeading
          eyebrow="26 modules"
          title="Everything the loan touches, in one office."
        >
          From the first question to closing day, and every follow-up in
          between.
        </SectionHeading>
        <div className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-2">
          {moduleGroups.map((group, groupIndex) => {
            const offset = moduleGroups
              .slice(0, groupIndex)
              .reduce((sum, g) => sum + g.items.length, 0);
            return (
              <Reveal key={group.heading} delay={groupIndex * 100}>
                <h3 className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <CalendarDays className="size-4 text-primary" />
                  {group.heading}
                </h3>
                <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {group.items.map(([name, description], i) => (
                    <li
                      key={name}
                      className="flex gap-4 px-5 py-4 transition-colors duration-200 hover:bg-muted/60"
                    >
                      <span className="pt-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {String(offset + i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="font-medium">{name}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:pb-32">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-primary-foreground sm:px-16">
            <div className="pointer-events-none absolute -right-24 -top-24 size-96 animate-drift rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 left-10 size-72 animate-drift-alt rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-xl">
                <h2 className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
                  Your brand. Your borrowers. Your office.
                </h2>
                <p className="mt-4 flex items-center gap-2 text-lg text-primary-foreground/80">
                  <Check className="size-5" />
                  Never miss a follow-up again.
                </p>
              </div>
              <Button asChild size="lg" className="bg-background text-foreground shadow-none hover:bg-background/90 hover:shadow-none">
                <Link to="/start">
                  Start a 30-day trial
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
