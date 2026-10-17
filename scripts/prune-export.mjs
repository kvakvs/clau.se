// Deletes the RSC payload files (*.txt) from the static export in out/.
//
// Usage: node scripts/prune-export.mjs   (run by `pnpm build`)
//
// Next.js writes about 4 of them per page for client-side navigation and
// prefetching. The site links with plain <a>, so they are never requested.

import fs from "node:fs";
import path from "node:path";

const out = path.resolve(import.meta.dirname, "..", "out");
if (!fs.existsSync(path.join(out, "index.html"))) {
  console.error(`prune-export: no build in ${out}`);
  process.exit(1);
}

let removed = 0;
for (const entry of fs.readdirSync(out, {
  recursive: true,
  withFileTypes: true,
})) {
  if (entry.isFile() && entry.name.endsWith(".txt")) {
    fs.rmSync(path.join(entry.parentPath, entry.name));
    removed++;
  }
}

// Directories that held only segment payloads (__next.$d$lang/...) are left
// empty; remove them deepest first.
const dirs = fs
  .readdirSync(out, { recursive: true, withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => path.join(e.parentPath, e.name))
  .sort((a, b) => b.length - a.length);
for (const dir of dirs) {
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

console.log(`prune-export: removed ${removed} .txt files from out/`);
