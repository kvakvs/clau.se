// Copies the newest benchmark report of the Clause repository into
// content/benchmarks.json for the benchmarks page.
//
// Usage: pnpm sync-benchmarks [path-to-clau]   (default: ../clau)
//
// Reports are text files written by benchmarks/run.py into the gitignored
// benchmarks/history/reports/<host>/<day>-<hash>.txt; the newest one (by day,
// over every host) is used. benchmarks/history/<host>.json adds the Clause/OTP
// geometric mean of each earlier run day of the same host, and the executable
// sizes of the latest run days that recorded them. The host name is
// not published.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.resolve(root, process.argv[2] ?? "../clau");
const historyDir = path.join(source, "benchmarks", "history");
const reportsDir = path.join(historyDir, "reports");
const target = path.join(root, "content", "benchmarks.json");

const reports = fs.existsSync(reportsDir)
  ? fs
      .readdirSync(reportsDir)
      .flatMap((host) =>
        fs
          .readdirSync(path.join(reportsDir, host))
          .filter((f) => /^\d{4}-\d{2}-\d{2}-[0-9a-f]+\.txt$/.test(f))
          .map((file) => ({ host, file })),
      )
      .sort((a, b) => a.file.localeCompare(b.file))
  : [];
const latest = reports.at(-1);
if (!latest) {
  console.error(`No benchmark reports in ${reportsDir}`);
  process.exit(1);
}

const text = fs.readFileSync(
  path.join(reportsDir, latest.host, latest.file),
  "utf8",
);
const lines = text.split(/\r?\n/);
const header = (prefix) =>
  lines
    .find((l) => l.startsWith(prefix))
    ?.slice(prefix.length)
    .trim() ?? "";

const [, cpu = "", cpus = "", os = ""] = header("Host:").split(" | ");
const kernels = table("Kernel times (ms)").map(({ name, values }) => ({
  name,
  otp: values["otp-jit"]?.value ?? null,
  otpSpread: values["otp-jit"]?.spread ?? null,
  clause: values["clause-o2"]?.value ?? null,
  clauseSpread: values["clause-o2"]?.spread ?? null,
}));
const programs = table("Program wall times").map(({ name, values }) => ({
  name,
  otp: values["otp-jit"]?.value ?? null,
  clause: values["clause-o2"]?.value ?? null,
}));

const data = {
  runAt: header("Clause benchmarks,"),
  host: { cpu, cpus: Number.parseInt(cpus, 10) || null, os },
  otp: header("OTP:").split(";")[0],
  commit: header("Clause HEAD:").split(" ")[0],
  runs: Number.parseInt(header("Runs per program and system:"), 10) || null,
  kernels,
  programs,
  history: history(latest.host),
  sizes: sizes(latest.host),
};

fs.writeFileSync(target, JSON.stringify(data, null, 2) + "\n");
console.log(
  `Benchmarks from ${latest.file}: ${kernels.length} kernels, ` +
    `${data.history.length} run days`,
);

// Rows of the table under a section title: the column header line names the
// systems, a dashed line follows, rows run until the next blank line.
function table(title) {
  const start = lines.findIndex((l) => l.startsWith(title));
  if (start < 0) return [];
  const columns = lines[start + 2]
    .trim()
    .split(/\s{2,}/)
    .slice(1);
  const rows = [];
  for (const line of lines.slice(start + 4)) {
    if (!line.trim()) break;
    const [name, ...rest] = line.trim().split(/\s+/);
    const cells = [
      ...rest.join(" ").matchAll(/(n\/a|[\d.]+)(?: \+\/-(\d+)%)?/g),
    ];
    const values = {};
    columns.forEach((column, i) => {
      const cell = cells[i];
      if (cell && cell[1] !== "n/a") {
        values[column] = {
          value: Number(cell[1]),
          spread: cell[2] === undefined ? null : Number(cell[2]),
        };
      }
    });
    rows.push({ name, values });
  }
  return rows;
}

function readHistory(host) {
  const file = path.join(historyDir, `${host}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
}

// Executable sizes in bytes: the newest run's bench_* programs at O0, O2 and
// O2 with LTO, and clau itself; plus the O2 sizes of the last SIZE_DAYS
// commits, each run day's baseline (the previous commit) included.
function sizes(host) {
  const SIZE_DAYS = 6;
  const records = readHistory(host).filter((r) => r.sizes_bytes);
  const newest = records.at(-1)?.sizes_bytes;
  if (!newest) return null;
  const points = new Map();
  for (const record of records) {
    const s = record.sizes_bytes;
    const point = (commit, date, key, clau) => ({
      date: String(date).slice(0, 10),
      commit: String(commit).slice(0, 8),
      clau: clau ?? null,
      programs: Object.fromEntries(
        Object.entries(s.programs ?? {})
          .filter(([, p]) => p[key] > 0)
          .map(([name, p]) => [name, p[key]]),
      ),
    });
    if (record.baseline?.commit && !points.has(record.baseline.commit)) {
      points.set(
        record.baseline.commit,
        point(
          record.baseline.commit,
          record.baseline.commit_date,
          "baseline",
          s.clau?.baseline,
        ),
      );
    }
    points.set(
      record.commit,
      point(record.commit, record.run_date, "o2", s.clau?.head),
    );
  }
  return {
    clau: newest.clau?.head ?? null,
    programs: Object.entries(newest.programs ?? {}).map(([name, p]) => ({
      name,
      o0: p.o0 ?? null,
      o2: p.o2 ?? null,
      lto: p.lto ?? null,
    })),
    history: [...points.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-SIZE_DAYS),
  };
}

// Geometric mean of Clause time / OTP time per recorded run day. Records from
// before the benchmarks' rescaling keep only their per-kernel ratios.
function history(host) {
  return readHistory(host)
    .map((record) => {
      const ratios = record.clause_us
        ? Object.entries(record.clause_us)
            .filter(([name, clause]) => clause > 0 && record.otp_us?.[name] > 0)
            .map(([name, clause]) => clause / record.otp_us[name])
        : Object.values(record.otp_ratio ?? {});
      const logs = ratios.filter((r) => r > 0).map((r) => Math.log(r));
      return {
        date: String(record.run_date).slice(0, 10),
        commit: String(record.commit).slice(0, 8),
        ratio: logs.length
          ? Number(
              Math.exp(logs.reduce((a, b) => a + b, 0) / logs.length).toFixed(
                2,
              ),
            )
          : null,
      };
    })
    .filter((day) => day.ratio !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}
