import { useEffect } from "react";

export default function PageMeta({
  title,
  description,
  noIndex = false,
  iconUrl,
}: {
  title: string;
  description?: string;
  noIndex?: boolean;
  iconUrl?: string | null;
}) {
  useEffect(() => {
    document.title = title;
    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }
    let robots = document.querySelector('meta[name="robots"]');
    if (noIndex) {
      if (!robots) {
        robots = document.createElement("meta");
        robots.setAttribute("name", "robots");
        document.head.appendChild(robots);
      }
      robots.setAttribute("content", "noindex");
    }
    if (!iconUrl) return;
    const links = [...document.querySelectorAll('link[rel="icon"]')] as HTMLLinkElement[];
    const previous = links.map((link) => link.href);
    if (!links.length) {
      const created = document.createElement("link");
      created.rel = "icon";
      document.head.appendChild(created);
      links.push(created);
    }
    for (const link of links) link.href = iconUrl;
    return () => {
      links.forEach((link, index) => {
        if (previous[index]) link.href = previous[index];
      });
    };
  }, [title, description, noIndex, iconUrl]);
  return null;
}
