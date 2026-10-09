// Records which English text a translation was made from.
//
// Usage: pnpm docs-stamp <locale> <file.md...>
//
// Run after translating (or updating a translation of) the present English
// file in content/docs/en/. Writes the frontmatter that pnpm docs-status and
// the site use to detect outdated translations.

import fs from "node:fs";
import path from "node:path";
import {
  formatFrontmatter,
  sourceHash,
  splitFrontmatter,
} from "../lib/doc-structure.ts";

const [locale, ...files] = process.argv.slice(2);
if (!locale || locale === "en" || files.length === 0) {
  console.error("Usage: pnpm docs-stamp <locale> <file.md...>");
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, "..");
const meta = JSON.parse(
  fs.readFileSync(path.join(root, "content", "docs-meta.json"), "utf8"),
) as { commit: string | null; dirty: boolean };
const docsDir = path.join(root, "content", "docs");

for (const name of files) {
  const file = path.basename(name);
  const enText = fs.readFileSync(path.join(docsDir, "en", file), "utf8");
  const target = path.join(docsDir, locale, file);
  const { body } = splitFrontmatter(fs.readFileSync(target, "utf8"));
  const stamp = formatFrontmatter({
    source: `docs/${file}`,
    sourceCommit: `${meta.commit ?? "unknown"}${meta.dirty ? "-dirty" : ""}`,
    sourceSha256: sourceHash(enText),
    translatedAt: new Date().toISOString().slice(0, 10),
  });
  fs.writeFileSync(target, stamp + body.replace(/\r\n?/g, "\n"));
  console.log(`stamped ${locale}/${file}`);
}
