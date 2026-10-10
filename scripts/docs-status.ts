// Reports the state of every translation in content/docs/<locale>/ against
// the English copies in content/docs/en/.
//
// Usage: pnpm docs-status [locale...]
//
// current:  made from the present English text (frontmatter sourceSha256)
// outdated: English changed since; re-translate the changed parts and restamp
// missing:  no translation yet (the site shows English)
// Structure errors (headings, code fences or link targets differ from the
// English original) fail the command: heading anchors are mapped by position.

import fs from "node:fs";
import path from "node:path";
import {
  codeFenceCount,
  headings,
  sourceHash,
  splitFrontmatter,
} from "../lib/doc-structure.ts";

const LOCALES = ["sv", "es", "uk", "fr", "de", "pt"];
const docsDir = path.resolve(import.meta.dirname, "..", "content", "docs");
const enDir = path.join(docsDir, "en");
const locales = process.argv.length > 2 ? process.argv.slice(2) : LOCALES;

const linkTargets = (md: string) =>
  [...md.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).sort();

const english = fs.readdirSync(enDir).filter((f) => f.endsWith(".md"));
let errors = 0;

for (const locale of locales) {
  const dir = path.join(docsDir, locale);
  const counts = {
    current: 0,
    outdated: [] as string[],
    missing: [] as string[],
  };
  for (const file of english) {
    const enText = fs.readFileSync(path.join(enDir, file), "utf8");
    const target = path.join(dir, file);
    if (!fs.existsSync(target)) {
      counts.missing.push(file);
      continue;
    }
    const { meta, body } = splitFrontmatter(fs.readFileSync(target, "utf8"));
    if (meta.sourceSha256 === sourceHash(enText)) counts.current++;
    else counts.outdated.push(`${file} (${meta.sourceCommit ?? "unstamped"})`);

    const problems: string[] = [];
    const enHeadings = headings(enText)
      .map((h) => h.depth)
      .join(",");
    if (
      headings(body)
        .map((h) => h.depth)
        .join(",") !== enHeadings
    ) {
      problems.push("headings differ");
    }
    if (codeFenceCount(body) !== codeFenceCount(enText)) {
      problems.push("code fences differ");
    }
    if (linkTargets(body).join("\n") !== linkTargets(enText).join("\n")) {
      problems.push("link targets differ");
    }
    if (problems.length) {
      errors++;
      console.log(`  ERROR ${locale}/${file}: ${problems.join(", ")}`);
    }
  }
  const orphans = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md") && !english.includes(f))
    : [];
  console.log(
    `${locale}: ${counts.current} current, ${counts.outdated.length} outdated, ` +
      `${counts.missing.length} missing, ${orphans.length} orphaned`,
  );
  for (const f of counts.outdated) console.log(`  outdated ${f}`);
  if (counts.missing.length && locales.length === 1) {
    console.log(`  missing ${counts.missing.join(", ")}`);
  }
  for (const f of orphans) console.log(`  orphaned ${f} (no English original)`);
}

if (errors) process.exit(1);
