import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { getDoc, getDocSlugs } from "@/lib/docs";
import { isLocale, locales } from "@/lib/i18n";
import { getMessages } from "@/messages";

type Props = { params: Promise<{ lang: string; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) =>
    getDocSlugs().map((slug) => ({ lang, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  return doc ? { title: doc.title } : {};
}

export default async function DocPage({ params }: Props) {
  const { lang, slug } = await params;
  const doc = getDoc(slug);
  if (!isLocale(lang) || !doc) notFound();
  const t = getMessages(lang).docs;

  return (
    <>
      <Link
        href={`/${lang}/docs/`}
        className="text-sm text-muted hover:text-accent"
      >
        ← {t.allDocs}
      </Link>
      {lang !== "en" && (
        <p className="mt-4 text-sm text-muted">{t.englishOnly}</p>
      )}
      <article lang="en" className="prose mt-6 max-w-3xl">
        <h1>{doc.title}</h1>
        <Markdown source={doc.body} locale={lang} />
      </article>
    </>
  );
}
