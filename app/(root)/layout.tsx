import type { Metadata } from "next";
import { themeInitScript } from "@/lib/theme";
import "../globals.css";

export const metadata: Metadata = {
  title: "Clause",
  description:
    "Clause compiles Erlang/OTP 29 ahead of time through LLVM into native executables.",
};

export default function RootRedirectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
