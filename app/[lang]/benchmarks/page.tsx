import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { isLocale } from "@/lib/i18n";
import { getMessages } from "@/messages";
import data from "@/content/benchmarks.json";

type Props = { params: Promise<{ lang: string }> };

type Kernel = (typeof data.kernels)[number];
type Group = keyof ReturnType<typeof getMessages>["benchmarks"]["groups"];

// Bars span Clause/OTP ratios from 1/4 to 16 on a log2 scale; 1 is the axis.
// The left side leaves room for the "slower" label of red bars.
const MIN_LOG = -2;
const MAX_LOG = 4;
const AXIS_TICKS = [0.25, 0.5, 1, 2, 4, 8, 16];
// A spread above this percentage of the median marks a noisy kernel.
const NOISY_SPREAD = 50;
// Build modes of the executable size table, as the compiler flags read.
const SIZE_MODES = [
  { key: "o0", label: "-O0" },
  { key: "o2", label: "-O2" },
  { key: "lto", label: "-O2 --lto" },
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getMessages(lang).benchmarks.title } : {};
}

export default async function BenchmarksPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) return null;
  const t = getMessages(lang).benchmarks;
  // Summaries of what each kernel and program does; new ones show none.
  const kernelInfo: Partial<Record<string, string>> = t.kernelInfo;
  const programInfo: Partial<Record<string, string>> = t.programInfo;

  const number = (value: number, digits: number) =>
    value.toLocaleString(lang, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const times = (ratio: number) => `${number(ratio, ratio < 10 ? 2 : 1)}×`;
  const megabytes = (bytes: number) =>
    t.megabytes.replace("{value}", number(bytes / 1e6, 2));

  const kernels = data.kernels.filter(
    (k): k is Kernel & { otp: number; clause: number } =>
      k.otp !== null && k.clause !== null && k.otp > 0,
  );
  const geomean = Math.exp(
    kernels.reduce((sum, k) => sum + Math.log(k.clause / k.otp), 0) /
      kernels.length,
  );
  const fasterCount = kernels.filter((k) => k.clause < k.otp).length;
  const first = data.history[0];
  // Kernel names are <program>.<kernel>; rows are grouped by program.
  const groups = new Map<string, typeof kernels>();
  for (const k of kernels) {
    const group = k.name.split(".")[0] ?? "";
    groups.set(group, [...(groups.get(group) ?? []), k]);
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-3 max-w-3xl text-muted">{t.intro}</p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <Tile
          value={
            <>
              {times(geomean >= 1 ? geomean : 1 / geomean)}{" "}
              <span className="font-sans text-lg font-medium">
                {geomean >= 1 ? t.slowerOnAverage : t.fasterOnAverage}
              </span>
            </>
          }
          label={t.geomean}
        />
        <Tile value={`${fasterCount} / ${kernels.length}`} label={t.faster} />
        {first && first.date !== data.runAt.slice(0, 10) && (
          <Tile
            value={times(first.ratio)}
            label={t.first.replace("{date}", first.date)}
          />
        )}
      </dl>

      <section aria-labelledby="kernels" className="mt-12">
        <h2 id="kernels" className="text-2xl font-semibold">
          {t.kernelsTitle}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {t.kernelsNote.replace("{runs}", String(data.runs ?? ""))}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-faster" aria-hidden="true" />
            {t.legendFaster}
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-slower" aria-hidden="true" />
            {t.legendSlower}
          </span>
          <span>🔺 {t.noisy}</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t.kernel}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {t.otp}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {t.clause}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {t.ratio}
                </th>
                <th scope="col" className="w-2/5 px-3 py-2 align-bottom">
                  <Axis />
                </th>
              </tr>
            </thead>
            {[...groups].map(([group, rows]) => (
              <tbody key={group}>
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={5}
                    className="pt-5 pb-1 text-left font-semibold"
                  >
                    {t.groups[group as Group] ?? group}
                  </th>
                </tr>
                {rows.map((k) => {
                  const ratio = k.clause / k.otp;
                  const noisy =
                    (k.otpSpread ?? 0) > NOISY_SPREAD ||
                    (k.clauseSpread ?? 0) > NOISY_SPREAD;
                  return (
                    <tr
                      key={k.name}
                      className="border-b border-border hover:bg-card"
                    >
                      <td className="py-1.5 pr-3 font-mono text-xs break-all">
                        {k.name.slice(group.length + 1)}
                        {noisy && (
                          <span title={t.noisy} aria-label={t.noisy}>
                            {" "}
                            🔺
                          </span>
                        )}
                        <Info text={kernelInfo[k.name]} />
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {number(k.otp, 2)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {number(k.clause, 2)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {times(ratio)}
                      </td>
                      <td className="px-3 py-1.5">
                        <Bar
                          ratio={ratio}
                          label={ratio < 1 ? t.barFaster : t.barSlower}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <section aria-labelledby="programs" className="mt-12">
        <h2 id="programs" className="text-2xl font-semibold">
          {t.programsTitle}
        </h2>
        <p className="mt-2 text-sm text-muted">{t.programsNote}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t.program}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {t.otp}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {t.clause}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {t.ratio}
                </th>
                <th scope="col" className="w-2/5 px-3 py-2 align-bottom">
                  <Axis />
                </th>
              </tr>
            </thead>
            <tbody>
              {data.programs.map((p) => {
                const ratio =
                  p.otp !== null && p.clause !== null && p.otp > 0
                    ? p.clause / p.otp
                    : null;
                return (
                  <tr
                    key={p.name}
                    className="border-b border-border hover:bg-card"
                  >
                    <td className="py-1.5 pr-3 font-mono text-xs">
                      {p.name}
                      <Info text={programInfo[p.name]} />
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {p.otp === null ? "–" : number(p.otp, 2)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {p.clause === null ? "–" : number(p.clause, 2)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {ratio === null ? "–" : times(ratio)}
                    </td>
                    <td className="px-3 py-1.5">
                      {ratio !== null && (
                        <Bar
                          ratio={ratio}
                          label={ratio < 1 ? t.barFaster : t.barSlower}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="history" className="mt-12">
        <h2 id="history" className="text-2xl font-semibold">
          {t.historyTitle}
        </h2>
        <p className="mt-2 text-sm text-muted">{t.historyNote}</p>
        <table className="mt-4 w-full max-w-xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t.date}
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                {t.commit}
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                {t.ratio}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((day) => (
              <tr key={day.date} className="border-b border-border">
                <td className="py-1.5 pr-3 tabular-nums">{day.date}</td>
                <td className="py-1.5 pr-3 font-mono text-xs">{day.commit}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {times(day.ratio)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.sizes && (
        <section aria-labelledby="sizes" className="mt-12">
          <h2 id="sizes" className="text-2xl font-semibold">
            {t.sizesTitle}
          </h2>
          <p className="mt-2 text-sm text-muted">{t.sizesNote}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full max-w-2xl min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t.program}
                  </th>
                  {SIZE_MODES.map((mode) => (
                    <th
                      key={mode.key}
                      scope="col"
                      className="py-2 pr-3 text-right font-medium"
                    >
                      {mode.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sizes.programs.map((p) => (
                  <tr
                    key={p.name}
                    className="border-b border-border hover:bg-card"
                  >
                    <td className="py-1.5 pr-3 font-mono text-xs">{p.name}</td>
                    {SIZE_MODES.map((mode) => (
                      <td
                        key={mode.key}
                        className="py-1.5 pr-3 text-right tabular-nums"
                      >
                        {p[mode.key] === null ? "–" : megabytes(p[mode.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-8 text-sm text-muted">
            {t.sizesHistoryNote.replace(
              "{count}",
              String(data.sizes.history.length),
            )}
          </p>
          <SizeChart
            history={data.sizes.history}
            programs={data.sizes.programs.map((p) => p.name)}
            megabytes={megabytes}
            unit={t.megabytes.replace("{value}", "").trim()}
          />
          <table className="mt-4 w-full max-w-xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t.date}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t.commit}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  {t.sizesTotal}
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  clau
                </th>
              </tr>
            </thead>
            <tbody>
              {data.sizes.history.map((day) => {
                const total = Object.values(day.programs).reduce(
                  (sum, size) => sum + size,
                  0,
                );
                return (
                  <tr key={day.commit} className="border-b border-border">
                    <td className="py-1.5 pr-3 tabular-nums">{day.date}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs">
                      {day.commit}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {megabytes(total)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {day.clau === null ? "–" : megabytes(day.clau)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="setup" className="mt-12">
        <h2 id="setup" className="text-2xl font-semibold">
          {t.setupTitle}
        </h2>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted">{t.machine}</dt>
          <dd>
            {[
              data.host.cpu,
              data.host.cpus &&
                t.cpus.replace("{count}", String(data.host.cpus)),
              data.host.os,
            ]
              .filter(Boolean)
              .join(", ")}
          </dd>
          <dt className="text-muted">{t.otpVersion}</dt>
          <dd>{data.otp}</dd>
          <dt className="text-muted">{t.clauseCommit}</dt>
          <dd className="font-mono">{data.commit}</dd>
          <dt className="text-muted">{t.runAt}</dt>
          <dd className="tabular-nums">{data.runAt.slice(0, 10)}</dd>
        </dl>
        <p className="mt-6 max-w-3xl text-sm text-muted">
          {t.reproduce}{" "}
          <a
            href={`/${lang}/docs/validation/#benchmarks`}
            className="text-accent hover:underline"
          >
            {t.notes}
          </a>
        </p>
      </section>
    </>
  );
}

function Tile({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col-reverse rounded-xl border border-border bg-card p-5">
      <dt className="mt-2 text-sm text-muted">{label}</dt>
      <dd className="font-mono text-3xl font-semibold">{value}</dd>
    </div>
  );
}

/** A short description in small font under a benchmark name. */
function Info({ text }: { text: string | undefined }) {
  return text ? (
    <span className="mt-0.5 block font-sans text-[11px] leading-tight break-normal text-muted">
      {text}
    </span>
  ) : null;
}

type SizeDay = {
  date: string;
  commit: string;
  programs: Partial<Record<string, number>>;
};

/**
 * Vertical bars of -O2 executable sizes: one group per program, one bar per
 * measured commit, oldest first and lightest; the newest bar carries its value.
 */
function SizeChart({
  history,
  programs,
  megabytes,
  unit,
}: {
  history: SizeDay[];
  programs: string[];
  megabytes: (bytes: number) => string;
  unit: string;
}) {
  const width = 720;
  const height = 240;
  const [top, right, bottom, left] = [20, 8, 28, 40];
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = Math.max(
    1e6,
    ...history.flatMap((day) => Object.values(day.programs).map(Number)),
  );
  const step = max > 8e6 ? 2e6 : 1e6;
  const yMax = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step);
  const y = (bytes: number) => top + plotHeight * (1 - bytes / yMax);
  const groupWidth = plotWidth / programs.length;
  const gap = 2;
  const barWidth = Math.min(
    16,
    (groupWidth * 0.8 - gap * (history.length - 1)) / history.length,
  );
  const opacity = (i: number) =>
    history.length > 1 ? 0.3 + (0.7 * i) / (history.length - 1) : 1;

  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[36rem] text-fg"
          role="img"
          aria-label={programs.join(", ")}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? "stroke-muted" : "stroke-border"}
              />
              <text
                x={left - 6}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted text-[11px] tabular-nums"
              >
                {tick / 1e6}
                {tick === yMax ? ` ${unit}` : ""}
              </text>
            </g>
          ))}
          {programs.map((name, g) => {
            const groupX =
              left +
              g * groupWidth +
              (groupWidth -
                history.length * barWidth -
                gap * (history.length - 1)) /
                2;
            return (
              <g key={name}>
                {history.map((day, i) => {
                  const size = day.programs[name];
                  if (size === undefined) return null;
                  const x = groupX + i * (barWidth + gap);
                  const newest = i === history.length - 1;
                  return (
                    <g key={day.commit}>
                      <title>{`${name}, ${day.date} ${day.commit}: ${megabytes(size)}`}</title>
                      <rect
                        x={x - gap / 2}
                        y={top}
                        width={barWidth + gap}
                        height={plotHeight}
                        fill="transparent"
                      />
                      <path
                        d={barPath(x, y(size), barWidth, y(0) - y(size))}
                        fill="currentColor"
                        fillOpacity={opacity(i)}
                      />
                      {newest && (
                        <text
                          x={x + barWidth / 2}
                          y={y(size) - 5}
                          textAnchor="middle"
                          className="fill-fg text-[10px] tabular-nums"
                        >
                          {(size / 1e6).toFixed(2)}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text
                  x={left + (g + 0.5) * groupWidth}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted font-mono text-[11px]"
                >
                  {name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        {history.map((day, i) => (
          <li key={day.commit} className="flex items-center gap-2">
            <span
              className="size-3 rounded-sm bg-fg"
              style={{ opacity: opacity(i) }}
              aria-hidden="true"
            />
            <span className="tabular-nums">{day.date}</span>
            <span className="font-mono text-xs">{day.commit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A bar standing on the baseline with 4px rounded top corners. */
function barPath(x: number, y: number, width: number, height: number) {
  const r = Math.min(4, width / 2, height);
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

/** Position of a ratio across the bar track, in percent. */
function position(ratio: number) {
  const log = Math.min(MAX_LOG, Math.max(MIN_LOG, Math.log2(ratio)));
  return ((log - MIN_LOG) / (MAX_LOG - MIN_LOG)) * 100;
}

function Axis() {
  return (
    <span className="relative mt-1 block h-4 text-xs" aria-hidden="true">
      {AXIS_TICKS.map((tick) => (
        <span
          key={tick}
          className={cn(
            "absolute tabular-nums",
            tick === AXIS_TICKS[0]
              ? ""
              : tick === AXIS_TICKS.at(-1)
                ? "-translate-x-full"
                : "-translate-x-1/2",
          )}
          style={{ left: `${position(tick)}%` }}
        >
          {tick}×
        </span>
      ))}
    </span>
  );
}

/**
 * A blue bar (Clause faster) runs left of the 1× line with its label starting
 * at the line; a red bar runs right of it with its label ending at the line.
 */
function Bar({ ratio, label }: { ratio: number; label: string }) {
  const axis = position(1);
  const end = position(ratio);
  const faster = ratio < 1;
  const left = Math.min(axis, end);
  return (
    <span className="relative flex h-5 items-center" aria-hidden="true">
      {AXIS_TICKS.map((tick) => (
        <span
          key={tick}
          className={cn(
            "absolute inset-y-0 w-px",
            tick === 1 ? "bg-muted" : "bg-border",
          )}
          style={{ left: `${position(tick)}%` }}
        />
      ))}
      <span
        className={cn(
          "absolute h-3",
          faster ? "rounded-l bg-faster" : "rounded-r bg-slower",
        )}
        style={{ left: `${left}%`, width: `${Math.abs(end - axis)}%` }}
      />
      <span
        className="absolute pr-1 pl-1 text-[10px] leading-none text-muted"
        style={faster ? { left: `${axis}%` } : { right: `${100 - axis}%` }}
      >
        {label}
      </span>
    </span>
  );
}
