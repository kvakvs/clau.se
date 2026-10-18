import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CookieBanner } from "@/components/cookie-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { analyticsInitScript } from "@/lib/consent";
import { isLocale, locales } from "@/lib/i18n";
import { siteIcons } from "@/lib/site";
import { themeInitScript } from "@/lib/theme";
import { getMessages } from "@/messages";
import "../globals.css";

type Props = {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return {
    metadataBase: new URL("https://clau.se"),
    icons: siteIcons,
    title: { default: "Clause", template: "%s · Clause" },
    description: getMessages(lang).meta.description,
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getMessages(lang);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Google tag (gtag.js), loaded only after consent. */}
        <script dangerouslySetInnerHTML={{ __html: analyticsInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader locale={lang} t={t} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">
          {children}
        </main>
        <SiteFooter locale={lang} t={t} />
        <CookieBanner lang={lang} t={t.cookies} />
      </body>
    </html>
  );
}
