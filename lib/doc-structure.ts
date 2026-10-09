// Markdown helpers shared by the site (lib/docs.ts) and the docs scripts.
// No path aliases here: scripts/*.ts import this file directly with Node.

import { createHash } from "node:crypto";
import GithubSlugger from "github-slugger";

export type TranslationMeta = {
  source: string;
  sourceCommit: string;
  sourceSha256: string;
  translatedAt: string;
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const FENCE = /^\s*(```|~~~)/;

export function normalize(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** SHA-256 of an English doc, recorded in each translation made from it. */
export function sourceHash(text: string): string {
  return createHash("sha256").update(normalize(text)).digest("hex");
}

export function splitFrontmatter(text: string): {
  meta: Partial<TranslationMeta>;
  body: string;
} {
  const match = FRONTMATTER.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const pair = /^(\w+):\s*(.*)$/.exec(line);
    if (pair?.[1]) meta[pair[1]] = pair[2] ?? "";
  }
  return { meta, body: text.slice(match[0].length) };
}

export function formatFrontmatter(meta: TranslationMeta): string {
  const lines = Object.entries(meta).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

/** Lines outside fenced code blocks. */
function proseLines(markdown: string): string[] {
  let fence = false;
  return normalize(markdown)
    .split("\n")
    .filter((line) => {
      if (FENCE.test(line)) fence = !fence;
      return !fence && !FENCE.test(line);
    });
}

/** ATX headings in order, as plain text (no backticks, links or emphasis). */
export function headings(markdown: string): { depth: number; text: string }[] {
  return proseLines(markdown).flatMap((line) => {
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m?.[1] || m[2] === undefined) return [];
    const text = m[2]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/`/g, "")
      .replace(/\*/g, "");
    return [{ depth: m[1].length, text }];
  });
}

/** GitHub-style anchor ids of the headings, in order. */
export function headingIds(markdown: string): string[] {
  const slugger = new GithubSlugger();
  return headings(markdown).map((h) => slugger.slug(h.text));
}

export function codeFenceCount(markdown: string): number {
  return normalize(markdown)
    .split("\n")
    .filter((line) => FENCE.test(line)).length;
}

/** Splits off the first level-1 heading, which pages render as the title. */
export function splitTitle(markdown: string): { title?: string; body: string } {
  const m = /^# (.+)$/m.exec(markdown);
  if (!m?.[1]) return { body: markdown };
  return {
    title: m[1].replace(/`/g, ""),
    body: markdown.replace(m[0], ""),
  };
}
