import fs from "node:fs";
import path from "node:path";
import { GITHUB_URL } from "@/lib/site";
import meta from "@/content/docs-meta.json";

// Markdown copied from ../clau/docs by scripts/sync-docs.mjs.
const DOCS_DIR = path.join(process.cwd(), "content", "docs");

export type Doc = { slug: string; title: string; body: string };

/** Curated head of the table of contents; titles and blurbs are translated. */
export const featuredDocs = [
  { id: "gettingStarted", slug: "getting-started" },
  { id: "building", slug: "building" },
  { id: "using", slug: "usage" },
  { id: "interpreting", slug: null, related: ["validation", "features"] },
  { id: "differences", slug: "differences" },
] as const;

export type FeaturedDocId = (typeof featuredDocs)[number]["id"];

export const docsCommit: string | null = meta.commit;

function slugOf(fileName: string): string {
  return fileName.replace(/\.md$/, "").toLowerCase();
}

let cache: Map<string, Doc> | undefined;

function loadDocs(): Map<string, Doc> {
  if (cache) return cache;
  cache = new Map();
  for (const file of fs.readdirSync(DOCS_DIR)) {
    if (!file.endsWith(".md")) continue;
    const text = fs.readFileSync(path.join(DOCS_DIR, file), "utf8");
    const heading = /^# (.+)$/m.exec(text);
    const slug = slugOf(file);
    cache.set(slug, {
      slug,
      title: heading?.[1]?.replaceAll("`", "") ?? slug,
      body: heading ? text.replace(heading[0], "") : text,
    });
  }
  return cache;
}

export function getDoc(slug: string): Doc | undefined {
  return loadDocs().get(slug);
}

export function getDocSlugs(): string[] {
  return [...loadDocs().keys()];
}

/** Docs not in the featured list, alphabetically by title. */
export function getOtherDocs(): Doc[] {
  const featured = new Set<string>(featuredDocs.map((d) => d.slug ?? ""));
  return [...loadDocs().values()]
    .filter((d) => !featured.has(d.slug))
    .sort((a, b) => a.title.localeCompare(b.title, "en"));
}

/**
 * Resolves a link from a doc (relative to the repository's docs/ directory):
 * other docs become site routes, other repository files go to GitHub.
 */
export function resolveDocHref(href: string, locale: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) return href;
  const [target = "", hash] = href.split("#", 2);
  const fragment = hash ? `#${hash}` : "";
  const resolved = path.posix.normalize(path.posix.join("docs", target));
  if (resolved.startsWith("../")) return GITHUB_URL;
  const doc = /^docs\/([^/]+\.md)$/.exec(resolved);
  if (doc?.[1] && getDoc(slugOf(doc[1]))) {
    return `/${locale}/docs/${slugOf(doc[1])}/${fragment}`;
  }
  return `${GITHUB_URL}/blob/HEAD/${resolved}${fragment}`;
}
