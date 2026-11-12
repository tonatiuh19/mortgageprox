import type { ReactNode } from "react";

function safeHref(url: string): string {
  if (/^https?:\/\/[^\s"<>]+$/.test(url)) return url;
  if (/^\/[^\s"<>]*$/.test(url)) return url;
  return "";
}

function inlineNodes(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1] && match[2]) {
      const href = safeHref(match[2]);
      parts.push(href ? <a key={index} href={href} className="underline">{match[1]}</a> : match[1]);
    } else if (match[3]) {
      parts.push(<strong key={index}>{match[3]}</strong>);
    }
    last = match.index + match[0].length;
    index += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${blocks.length}`} className="mt-3 text-sm leading-relaxed">{inlineNodes(paragraph.join(" "))}</p>);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    blocks.push(
      <ul key={`l-${blocks.length}`} className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {list.map((item, index) => <li key={index}>{inlineNodes(item)}</li>)}
      </ul>,
    );
    list = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const className = level === 1 ? "font-display text-4xl tracking-tight" : level === 2 ? "mt-8 font-display text-2xl" : "mt-4 text-lg font-medium";
      if (level === 1) blocks.push(<h1 key={`h-${blocks.length}`} className={className}>{inlineNodes(heading[2])}</h1>);
      else if (level === 2) blocks.push(<h2 key={`h-${blocks.length}`} className={className}>{inlineNodes(heading[2])}</h2>);
      else blocks.push(<h3 key={`h-${blocks.length}`} className={className}>{inlineNodes(heading[2])}</h3>);
      continue;
    }
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      list.push(trimmed.slice(2));
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return <div className="min-w-0">{blocks}</div>;
}
