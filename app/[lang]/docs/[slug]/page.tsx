import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { getDoc, getDocSlugs } from "@/lib/docs";
import { isLocale, locales } from "@/lib/i18n";
import { GITHUB_URL } from "@/lib/site";
import { getMessages } from "@/messages";

type Props = { params: Promise<{ lang: string; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) =>
    getDocSlugs().map((slug) => ({ lang, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const doc = isLocale(lang) ? getDoc(slug, lang) : undefined;
  return doc ? { title: doc.title } : {};
}

export default async function DocPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const doc = getDoc(slug, lang);
  if (!doc) notFound();
  const t = getMessages(lang).docs;
  const englishHref = `/en/docs/${slug}/`;
  const commit = doc.sourceCommit?.replace(/-dirty$/, "");

  return (
    <>
      <a
        href={`/${lang}/docs/`}
        className="text-sm text-muted hover:text-accent"
      >
        ← {t.allDocs}
      </a>
      {doc.status === "fallback" && (
        <p className="mt-4 text-sm text-muted">{t.englishOnly}</p>
      )}
      {doc.status === "outdated" && (
        <p className="mt-4 max-w-3xl rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
          {t.outdated}{" "}
          <a href={englishHref} className="text-accent underline">
            {t.readEnglish}
          </a>
        </p>
      )}
      {(doc.status === "current" || doc.status === "outdated") && (
        <p className="mt-4 text-xs text-muted">
          {t.translated}
          {commit && (
            <>
              {" · "}
              <a
                href={`${GITHUB_URL}/tree/${commit}`}
                rel="noopener noreferrer"
                className="font-mono hover:underline"
              >
                {doc.sourceCommit}
              </a>
            </>
          )}
          {doc.translatedAt && ` · ${doc.translatedAt}`}
          {doc.status === "current" && (
            <>
              {" · "}
              <a href={englishHref} className="hover:underline">
                {t.readEnglish}
              </a>
            </>
          )}
        </p>
      )}
      <article lang={doc.lang} className="prose mt-6 max-w-3xl">
        <h1>{doc.title}</h1>
        <Markdown source={doc.body} locale={lang} headingIds={doc.headingIds} />
      </article>
    </>
  );
}
