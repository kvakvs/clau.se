// Copies the developer notes of the Clause repository into content/docs/.
//
// Usage: pnpm sync-docs [path-to-clau]   (default: ../clau)
//
// docs/*.md are copied as they are. The project README.md is split into the
// "Getting started", "Building the compiler" and "Using the compiler" pages;
// its links are rewritten to be relative to docs/ like the other files.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.resolve(root, process.argv[2] ?? "../clau");
const sourceDocs = path.join(source, "docs");
const target = path.join(root, "content", "docs");
const metaFile = path.join(root, "content", "docs-meta.json");

// README "Build" section is split before this line: everything above it
// lists prerequisites, everything from it on describes the build itself.
const BUILD_MARKER = "From the repository root:";

if (!fs.existsSync(sourceDocs)) {
  console.error(`No docs directory at ${sourceDocs}`);
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

const docFiles = fs.readdirSync(sourceDocs).filter((f) => f.endsWith(".md"));
for (const file of docFiles) {
  fs.copyFileSync(path.join(sourceDocs, file), path.join(target, file));
}

const sections = splitSections(
  fs.readFileSync(path.join(source, "README.md"), "utf8"),
);
const build = sections.get("Build") ?? "";
const usage = sections.get("Usage") ?? "";
const projects = sections.get("Projects") ?? "";

const markerAt = build.indexOf(BUILD_MARKER);
const derived = {
  "getting-started.md": [
    "Getting started",
    markerAt >= 0 ? build.slice(0, markerAt) : "",
  ],
  "building.md": [
    "Building the compiler",
    markerAt >= 0 ? build.slice(markerAt) : build,
  ],
  "usage.md": [
    "Using the compiler",
    usage + (projects ? `\n## Projects\n\n${projects}` : ""),
  ],
};

for (const [file, [title, body]] of Object.entries(derived)) {
  if (!body.trim()) {
    console.warn(`README section for ${file} not found; skipped`);
    continue;
  }
  if (docFiles.includes(file)) {
    console.warn(`docs/${file} exists; README-derived page overrides it`);
  }
  const text = `# ${title}\n\n${rewriteReadmeLinks(body.trim())}\n`;
  fs.writeFileSync(path.join(target, file), text);
}

fs.writeFileSync(
  metaFile,
  JSON.stringify({ commit: gitCommit(source) }, null, 2) + "\n",
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

function gitCommit(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}
