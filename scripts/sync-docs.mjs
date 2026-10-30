// Copies the developer notes of the Clause repository into content/docs/en/.
//
// Usage: pnpm sync-docs [path-to-clau]   (default: ../clau)
//
// docs/*.md and docs/libraries/*.md are copied into one flat directory without
// their internal plan step references (see stripPlanReferences); links are
// rewritten to be relative to docs/, as if every page lived there. The
// "Quick start" section of the project README.md becomes the "Getting started"
// page, its links rewritten the same way.
// Translations in content/docs/<locale>/ are left alone; run
// `pnpm docs-status` afterwards to see which of them are now outdated.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.resolve(root, process.argv[2] ?? "../clau");
const sourceDocs = path.join(source, "docs");
const target = path.join(root, "content", "docs", "en");
const metaFile = path.join(root, "content", "docs-meta.json");

// Subdirectories of docs/ whose pages are served next to the top-level ones.
const SUBDIRS = ["libraries"];

// The notes name the internal plan steps (and their dates) that delivered each
// part: "Plan 11 step 41T (`path`). Text", "(plan step 37)", "(OPT0.2A)",
// "(plan 21, LIB80)", "(LIB80D)".
// Visitors cannot follow those, so paragraph lead-ins and parenthetical
// references are removed; source paths of a lead-in are kept as "Source:".
// Headings and code blocks are left alone, so anchors and structure stay.
// Step ids: "41T", "OPT0.2A", "LIB5E", "LIB81D2a", "OPTM.2E".
const STEP_ID = String.raw`(?:\d+[A-Z0-9]*|[A-Z]{2,5}(?:\d+[A-Z0-9]*[a-z]?(?:\.\d+[A-Z]?)?|\.\d+[A-Z]?))`;
const LIB_ID = String.raw`LIB\d+[A-Z0-9]*[a-z]?`;
// References wrap across lines, so words are separated by any whitespace.
const STEP_IDS = String.raw`${STEP_ID}(?:(?:\s+(?:and|or)\s+|–)${STEP_ID})*`;
const STEP_REF = String.raw`(?:[Pp]lan(?:\s+\d+)?\s+)?(?:[Ss]teps?\s+)?${STEP_IDS}(?:\s+\(part\)|\s+follow-up)?`;
const PLAIN_REF = String.raw`(?:(?:[Pp]lan(?:\s+\d+)?\s+)?[Ss]teps?\s+${STEP_IDS}|(?:plan\s+\d+(?:\s+step|,)?\s+)?(?:OPT[A-Z0-9]*\.\d+[A-Z0-9]*|${LIB_ID})(?:\s+\(part\)|\s+follow-up)?)`;
const LEAD_IN = new RegExp(
  String.raw`^(?:Decision of )?(?:[Pp]lan(?: \d+)? )?[Ss]teps? ${STEP_IDS}(?: \(([^()]*)\))?(?:[.:]\s*|, (?=[a-z]))`,
);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TEXT = String.raw`\d{4}-\d{2}-\d{2}`;
const INLINE_RULES = [
  // "(decision of plan 11 step 57A, 2026-10-08)"
  [
    new RegExp(
      String.raw`\s*\([Dd]ecision of ${PLAIN_REF}(?:,\s+${DATE_TEXT})?\)`,
      "g",
    ),
    "",
  ],
  // "chosen in plan 11 step 17 (2026-10-05) after ..."
  [
    new RegExp(
      String.raw`\s+in\s+[Pp]lan\s+\d+\s+[Ss]teps?\s+${STEP_IDS}(?:\s+\(${DATE_TEXT}\))?`,
      "g",
    ),
    "",
  ],
  // "..., [step 71](../.agents/11-plan.md#step-71))"
  [
    new RegExp(
      String.raw`[,;]\s+\[${STEP_REF}\]\(\.\.\/\.agents\/[^)]*\)(?=\))`,
      "g",
    ),
    "",
  ],
  // "(plan step 41T, [lists module](#lists-module))", "(step 57G3; ..."
  [new RegExp(String.raw`\(${PLAIN_REF}[,;]\s+`, "g"), "("],
  // "Stub until plan 21 LIB4E: ...", "... declined until plan step 71"
  [
    new RegExp(
      String.raw`\s+until\s+[Pp]lan(?:\s+\d+)?\s+(?:[Ss]teps?\s+)?${STEP_IDS}`,
      "g",
    ),
    "",
  ],
  // "(revision 10, OPT0.1A)", "(..., step 41V)", "(... of step 41T)"
  [new RegExp(String.raw`(?:,|\s+of)\s+${PLAIN_REF}\)`, "g"), ")"],
  // "(plan step 37)", "(OPT0.2A)", "(step 41N)"
  [new RegExp(String.raw`\s*\(${PLAIN_REF}\)`, "g"), ""],
  // "(plan 21)", what is left of "(plan 21, LIB80)"
  [/\s*\([Pp]lan \d+\)/g, ""],
  // "([OPT0.5A](../.agents/20-opt.md))"
  [
    new RegExp(
      String.raw`\s*\(\[${STEP_REF}\]\(\.\.\/\.agents\/[^)]*\)\)`,
      "g",
    ),
    "",
  ],
  // "[Plan 21](../.agents/21-lib.md) schedules ..."
  [
    /(^|[.!?]\s+)\[[Pp]lan \d+\]\(\.\.\/\.agents\/[^)]*\)/gm,
    "$1The project plan",
  ],
  [/\[[Pp]lan \d+\]\(\.\.\/\.agents\/[^)]*\)/g, "the project plan"],
  // "tracked in [step 71](../.agents/11-plan.md#step-71)"
  [
    new RegExp(String.raw`\[${STEP_REF}\]\(\.\.\/\.agents\/[^)]*\)`, "g"),
    "the project plan",
  ],
  // "...; step 44: exit reasons; step 45: ..."
  [new RegExp(String.raw`(;\s)${PLAIN_REF}:\s`, "g"), "$1"],
  // "LIB81D1, over the engine's builtins." opening a paragraph
  [
    new RegExp(String.raw`^${PLAIN_REF},\s+([a-z])`),
    (_, first) => first.toUpperCase(),
  ],
  // "; LIB81D1 adds `keylog`", "and LIB81D2b `tickets`"
  [new RegExp(String.raw`\b${LIB_ID}\s+adds\s+`, "g"), "also "],
  [new RegExp(String.raw`(\s)${LIB_ID}\s+(?=\`)`, "g"), "$1"],
];

if (!fs.existsSync(sourceDocs)) {
  console.error(`No docs directory at ${sourceDocs}`);
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

// { dir, file }: dir is the subdirectory of docs/ ("" for docs/ itself).
const docFiles = [];
for (const dir of ["", ...SUBDIRS]) {
  const from = path.join(sourceDocs, dir);
  if (!fs.existsSync(from)) continue;
  for (const file of fs.readdirSync(from).filter((f) => f.endsWith(".md"))) {
    if (docFiles.some((d) => d.file === file)) {
      console.error(`docs/${dir}/${file}: another page is named ${file}`);
      process.exit(1);
    }
    docFiles.push({ dir, file });
  }
}
for (const { dir, file } of docFiles) {
  const text = fs.readFileSync(path.join(sourceDocs, dir, file), "utf8");
  fs.writeFileSync(
    path.join(target, file),
    stripPlanReferences(rewriteLinks(text, path.posix.join("docs", dir))),
  );
}

const sections = splitSections(
  fs.readFileSync(path.join(source, "README.md"), "utf8"),
);
const derived = {
  "getting-started.md": ["Getting started", sections.get("Quick start") ?? ""],
};

for (const [file, [title, body]] of Object.entries(derived)) {
  if (!body.trim()) {
    console.warn(`README section for ${file} not found; skipped`);
    continue;
  }
  if (docFiles.some((d) => d.file === file)) {
    console.warn(`docs/${file} exists; README-derived page overrides it`);
  }
  const text = stripPlanReferences(
    `# ${title}\n\n${rewriteLinks(body.trim(), ".")}\n`,
  );
  fs.writeFileSync(path.join(target, file), text);
}

fs.writeFileSync(
  metaFile,
  JSON.stringify(
    {
      commit: git(source, "rev-parse", "--short", "HEAD"),
      // Uncommitted changes in the copied files: the commit alone is not exact.
      dirty: Boolean(
        git(source, "status", "--porcelain", "--", "docs", "README.md"),
      ),
      syncedAt: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ) + "\n",
);
console.log(`Synced ${docFiles.length} docs from ${source}`);

// Splits Markdown into level-2 sections keyed by heading, skipping code fences.
function splitSections(markdown) {
  const result = new Map();
  let current = null;
  let fence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const heading = !fence && /^## (.+)$/.exec(line);
    if (heading) {
      current = heading[1].trim();
      result.set(current, "");
    } else if (current) {
      result.set(current, result.get(current) + line + "\n");
    }
  }
  return result;
}

// Makes the relative links of a file in `from` (a directory relative to the
// repository root) relative to docs/; links to pages of SUBDIRS point at their
// flattened copies.
function rewriteLinks(markdown, from) {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (match, href) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) {
      return match;
    }
    const [target, hash] = href.split("#", 2);
    let resolved = path.posix.normalize(path.posix.join(from, target));
    const page = /^docs\/([^/]+)\/([^/]+\.md)$/.exec(resolved);
    if (page && SUBDIRS.includes(page[1])) resolved = `docs/${page[2]}`;
    const relative = path.posix.relative("docs", resolved) || ".";
    return `](${relative}${hash === undefined ? "" : `#${hash}`})`;
  });
}

function stripPlanReferences(markdown) {
  const blocks = [];
  let fence = false;
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) blocks.push(...stripParagraph(paragraph.join("\n")));
    paragraph = [];
  };
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      flush();
      fence = !fence;
      blocks.push(line);
    } else if (fence || /^#{1,6} /.test(line)) {
      flush();
      blocks.push(line);
    } else if (!line.trim()) {
      flush();
      blocks.push(line);
    } else {
      paragraph.push(line);
    }
  }
  flush();
  // A dropped lead-in paragraph leaves two blank lines in a row.
  return blocks.join("\n").replace(/\n{3,}/g, "\n\n");
}

// Returns the paragraph as lines, or none when nothing but a reference is left.
function stripParagraph(text) {
  let result = text;
  const lead = LEAD_IN.exec(result);
  if (lead) {
    const paths = (lead[1] ?? "")
      .split(/,\s*/)
      .filter((part) => part && !DATE.test(part.trim()));
    let rest = result.slice(lead[0].length);
    rest = rest.charAt(0).toUpperCase() + rest.slice(1);
    const source = paths.length ? `Source: ${paths.join(", ")}.` : "";
    result = [source, rest].filter(Boolean).join(rest ? " " : "");
    if (!result.trim()) return [];
  }
  // "(OPT0.13, OPT0.14)" needs one pass per reference.
  for (let previous = ""; previous !== result;) {
    previous = result;
    for (const [pattern, replacement] of INLINE_RULES) {
      result = result.replace(pattern, replacement);
    }
  }
  return result.split("\n");
}

function git(dir, ...args) {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}
