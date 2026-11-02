import data from "@/content/benchmarks.json";

type Kernel = (typeof data.kernels)[number];

// Kernels of the latest report with both times measured.
export const kernels = data.kernels.filter(
  (k): k is Kernel & { otp: number; clause: number } =>
    k.otp !== null && k.clause !== null && k.otp > 0,
);

// Geometric mean of Clause / OTP over some kernels; below 1 Clause is faster.
function geomean(of: typeof kernels): number {
  return Math.exp(
    of.reduce((sum, k) => sum + Math.log(k.clause / k.otp), 0) / of.length,
  );
}

// Over every kernel, library tests included.
export const kernelGeomean = geomean(kernels);

// The library tests (qlc and ssl) time OTP library modules compiled by Clause;
// the other kernels time the benchmark programs' own code.
const LIBRARY_GROUPS = ["libraries", "ssl"];
const isLibrary = (k: (typeof kernels)[number]) =>
  LIBRARY_GROUPS.includes(k.name.split(".")[0] ?? "");
export const codeGeomean = geomean(kernels.filter((k) => !isLibrary(k)));
export const libraryGeomean = geomean(kernels.filter(isLibrary));

// A ratio as "1.23×", one decimal from 10× up.
export function formatTimes(locale: string, ratio: number): string {
  const digits = ratio < 10 ? 2 : 1;
  const value = ratio.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value}×`;
}
