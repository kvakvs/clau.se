import type { Metadata } from "next";
import Link from "next/link";
import { themeInitScript } from "@/lib/theme";
import { en } from "@/messages/en";
import "./globals.css";

export const metadata: Metadata = { title: `${en.notFound.title} · Clause` };

export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <main className="mx-auto max-w-md px-4 py-16">
          <p className="text-5xl font-semibold text-accent">404</p>
          <h1 className="mt-4 text-2xl font-semibold">{en.notFound.title}</h1>
          <Link href="/" className="mt-6 inline-block text-accent hover:underline">
            {en.notFound.home}
          </Link>
        </main>
      </body>
    </html>
  );
}
