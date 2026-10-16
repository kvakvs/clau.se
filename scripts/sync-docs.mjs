// Copies the developer notes of the Clause repository into content/docs/en/.
//
// Usage: pnpm sync-docs [path-to-clau]   (default: ../clau)
//
// docs/*.md are copied without their internal plan step references (see
// stripPlanReferences). The project README.md is split into the
// "Getting started", "Building the compiler" (with "Testing") and "Using the
// compiler" pages; its links are rewritten to be relative to docs/ like the
// other files.
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

// README "Build" section is split before this line: everything above it
// lists prerequisites, everything from it on describes the build itself.
const BUILD_MARKER = /^(?:Configure and build f|F)rom the repository root:/m;

// The notes name the internal plan steps (and their dates) that delivered each
// part: "Plan 11 step 41T (`path`). Text", "(plan step 37)", "(OPT0.2A)".
// Visitors cannot follow those, so paragraph lead-ins and parenthetical
// references are removed; source paths of a lead-in are kept as "Source:".
// Headings and code blocks are left alone, so anchors and structure stay.
const STEP_ID = String.raw`(?:\d+[A-Z0-9]*|OPT\d+\.\d+[A-Z]?)`;
// References wrap across lines, so words are separated by any whitespace.
const STEP_IDS = String.raw`${STEP_ID}(?:(?:\s+(?:and|or)\s+|–)${STEP_ID})*`;
const STEP_REF = String.raw`(?:[Pp]lan(?:\s+\d+)?\s+)?(?:[Ss]teps?\s+)?${STEP_IDS}(?:\s+\(part\)|\s+follow-up)?`;
const PLAIN_REF = String.raw`(?:(?:[Pp]lan(?:\s+\d+)?\s+)?[Ss]teps?\s+${STEP_IDS}|(?:plan\s+\d+\s+step\s+)?OPT\d+\.\d+[A-Z]?(?:\s+\(part\)|\s+follow-up)?)`;
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
  [new RegExp(String.raw`\(${PLAIN_REF}[,;]\s`, "g"), "("],
  // "(revision 10, OPT0.1A)", "(..., step 41V)", "(... of step 41T)"
  [new RegExp(String.raw`(?:,|\s+of)\s+${PLAIN_REF}\)`, "g"), ")"],
  // "(plan step 37)", "(OPT0.2A)", "(step 41N)"
  [new RegExp(String.raw`\s*\(${PLAIN_REF}\)`, "g"), ""],
  // "([OPT0.5A](../.agents/20-opt.md))"
  [
    new RegExp(
      String.raw`\s*\(\[${STEP_REF}\]\(\.\.\/\.agents\/[^)]*\)\)`,
      "g",
    ),
    "",
  ],
  // "...; step 44: exit reasons; step 45: ..."
  [new RegExp(String.raw`(;\s)${PLAIN_REF}:\s`, "g"), "$1"],
];

if (!fs.existsSync(sourceDocs)) {
  console.error(`No docs directory at ${sourceDocs}`);
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

const docFiles = fs.readdirSync(sourceDocs).filter((f) => f.endsWith(".md"));
for (const file of docFiles) {
  const text = fs.readFileSync(path.join(sourceDocs, file), "utf8");
  fs.writeFileSync(path.join(target, file), stripPlanReferences(text));
}

const sections = splitSections(
  fs.readFileSync(path.join(source, "README.md"), "utf8"),
);
const build = sections.get("Build") ?? "";
const usage = sections.get("Usage") ?? "";
// Sections appended to a page under their own heading, when the README has them.
const subsection = (title) => {
  const body = sections.get(title);
  return body?.trim() ? `\n## ${title}\n\n${body}` : "";
};

const markerAt = build.search(BUILD_MARKER);
const derived = {
  "getting-started.md": [
    "Getting started",
    markerAt >= 0 ? build.slice(0, markerAt) : "",
  ],
  "building.md": [
    "Building the compiler",
    (markerAt >= 0 ? build.slice(markerAt) : build) + subsection("Testing"),
  ],
  "usage.md": ["Using the compiler", usage + subsection("Projects")],
};

for (const [file, [title, body]] of Object.entries(derived)) {
  if (!body.trim()) {
    console.warn(`README section for ${file} not found; skipped`);
    continue;
  }
  if (docFiles.includes(file)) {
    console.warn(`docs/${file} exists; README-derived page overrides it`);
  }
  const text = stripPlanReferences(
    `# ${title}\n\n${rewriteReadmeLinks(body.trim())}\n`,
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

// README links are relative to the repository root; make them relative to docs/.
function rewriteReadmeLinks(markdown) {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (match, href) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) {
      return match;
    }
    const relative = href.startsWith("docs/")
      ? href.slice("docs/".length)
      : `../${href}`;
    return `](${relative})`;
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
