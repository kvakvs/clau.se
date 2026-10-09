import fs from "node:fs";
import path from "node:path";
import {
  headingIds,
  sourceHash,
  splitFrontmatter,
  splitTitle,
} from "@/lib/doc-structure";
import { defaultLocale, type Locale } from "@/lib/i18n";
import { GITHUB_URL } from "@/lib/site";
import meta from "@/content/docs-meta.json";

// content/docs/en/: English copies made by scripts/sync-docs.mjs.
// content/docs/<locale>/: translations; see scripts/docs-status.ts.
const DOCS_DIR = path.join(process.cwd(), "content", "docs");

/**
 * source: the English original. current: a translation of the present
 * English text. outdated: the English text changed after translation.
 * fallback: no translation, English shown instead.
 */
export type DocStatus = "source" | "current" | "outdated" | "fallback";

export type Doc = {
  slug: string;
  title: string;
  body: string;
  lang: Locale;
  status: DocStatus;
  /** Heading anchors from the English original, so links work in every language. */
  headingIds: string[];
  translatedAt?: string;
  sourceCommit?: string;
};

/** Curated head of the table of contents; titles and blurbs are translated. */
export const featuredDocs = [
  { id: "gettingStarted", slug: "getting-started" },
  { id: "building", slug: "building" },
  { id: "using", slug: "usage" },
  { id: "interpreting", slug: null, related: ["validation", "features"] },
  { id: "differences", slug: "differences" },
] as const;

export type FeaturedDocId = (typeof featuredDocs)[number]["id"];

export const docsSource: {
  commit: string | null;
  dirty: boolean;
  syncedAt: string;
} = meta;

function slugOf(fileName: string): string {
  return fileName.replace(/\.md$/, "").toLowerCase();
}

type Source = { file: string; text: string; title: string; body: string };

let english: Map<string, Source> | undefined;

function loadEnglish(): Map<string, Source> {
  if (english) return english;
  english = new Map();
  const dir = path.join(DOCS_DIR, defaultLocale);
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const { title, body } = splitTitle(text);
    english.set(slugOf(file), {
      file,
      text,
      title: title ?? slugOf(file),
      body,
    });
  }
  return english;
}

const cache = new Map<string, Doc | undefined>();

export function getDoc(slug: string, locale: Locale): Doc | undefined {
  const key = `${locale}/${slug}`;
  if (cache.has(key)) return cache.get(key);
  const source = loadEnglish().get(slug);
  let doc: Doc | undefined;
  if (source) {
    const base = {
      slug,
      headingIds: headingIds(source.body),
    };
    const file = path.join(DOCS_DIR, locale, source.file);
    if (locale !== defaultLocale && fs.existsSync(file)) {
      const { meta: m, body: text } = splitFrontmatter(
        fs.readFileSync(file, "utf8"),
      );
      const { title, body } = splitTitle(text);
      doc = {
        ...base,
        title: title ?? source.title,
        body,
        lang: locale,
        status:
          m.sourceSha256 === sourceHash(source.text) ? "current" : "outdated",
        translatedAt: m.translatedAt,
        sourceCommit: m.sourceCommit,
      };
    } else {
      doc = {
        ...base,
        title: source.title,
        body: source.body,
        lang: defaultLocale,
        status: locale === defaultLocale ? "source" : "fallback",
      };
    }
  }
  cache.set(key, doc);
  return doc;
}

export function getDocSlugs(): string[] {
  return [...loadEnglish().keys()];
}

/** Docs not in the featured list, alphabetically by (translated) title. */
export function getOtherDocs(locale: Locale): Doc[] {
  const featured = new Set<string>(featuredDocs.map((d) => d.slug ?? ""));
  return getDocSlugs()
    .filter((slug) => !featured.has(slug))
    .map((slug) => getDoc(slug, locale))
    .filter((d): d is Doc => d !== undefined)
    .sort((a, b) => a.title.localeCompare(b.title, locale));
}

/**
 * Resolves a link from a doc (relative to the repository's docs/ directory):
 * other docs become site routes, other repository files go to GitHub.
 */
export function resolveDocHref(href: string, locale: Locale): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) return href;
  const [target = "", hash] = href.split("#", 2);
  const fragment = hash ? `#${hash}` : "";
  const resolved = path.posix.normalize(path.posix.join("docs", target));
  if (resolved.startsWith("../")) return GITHUB_URL;
  const doc = /^docs\/([^/]+\.md)$/.exec(resolved);
  if (doc?.[1] && loadEnglish().has(slugOf(doc[1]))) {
    return `/${locale}/docs/${slugOf(doc[1])}/${fragment}`;
  }
  return `${GITHUB_URL}/blob/HEAD/${resolved}${fragment}`;
}
