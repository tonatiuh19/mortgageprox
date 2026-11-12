import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  meta,
  live,
  tools,
}: {
  title: string;
  meta?: ReactNode;
  live?: string;
  tools?: ReactNode;
}) {
  return (
    <header className="section-header">
      <div className="section-header-title">
        <span className="section-mark" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
          {meta || live ? (
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {meta}
              {live ? <span className="section-live">{live}</span> : null}
            </p>
          ) : null}
        </div>
      </div>
      {tools ? <div className="section-header-tools">{tools}</div> : null}
    </header>
  );
}
