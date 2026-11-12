import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Bold, Heading2, Heading3, Link2, List } from "lucide-react";
import Markdown from "@/components/content/Markdown";

export default function MarkdownEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const field = useRef<HTMLTextAreaElement>(null);

  function insert(prefix: string, suffix = "") {
    const node = field.current;
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const selected = value.slice(start, end);
    const chunk = `${prefix}${selected}${suffix}`;
    onChange(value.slice(0, start) + chunk + value.slice(end));
    const cursor = start + chunk.length;
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(cursor, cursor);
    });
  }

  const tools = [
    { label: t("legal.heading"), icon: Heading2, run: () => insert("## ") },
    { label: t("legal.subheading"), icon: Heading3, run: () => insert("### ") },
    { label: t("legal.bold"), icon: Bold, run: () => insert("**", "**") },
    { label: t("legal.list"), icon: List, run: () => insert("- ") },
    { label: t("legal.link"), icon: Link2, run: () => insert("[", "](https://)") },
  ];

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1">
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              onClick={tool.run}
            >
              <tool.icon className="size-3.5" />
              {tool.label}
            </button>
          ))}
        </div>
        <textarea
          ref={field}
          aria-label={label}
          className="mt-2 min-h-72 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <div className="min-w-0 rounded-xl border border-border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("legal.preview")}</p>
        <Markdown source={value} />
      </div>
    </div>
  );
}
