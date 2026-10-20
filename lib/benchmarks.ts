import data from "@/content/benchmarks.json";

type Kernel = (typeof data.kernels)[number];

// Kernels of the latest report with both times measured.
export const kernels = data.kernels.filter(
  (k): k is Kernel & { otp: number; clause: number } =>
    k.otp !== null && k.clause !== null && k.otp > 0,
);

// Geometric mean of Clause / OTP over the kernels; below 1 Clause is faster.
export const kernelGeomean = Math.exp(
  kernels.reduce((sum, k) => sum + Math.log(k.clause / k.otp), 0) /
    kernels.length,
);

// A ratio as "1.23×", one decimal from 10× up.
export function formatTimes(locale: string, ratio: number): string {
  const digits = ratio < 10 ? 2 : 1;
  const value = ratio.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value}×`;
}
