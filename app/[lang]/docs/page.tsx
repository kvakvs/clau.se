import type { Metadata } from "next";
import Link from "next/link";
import {
  docsSource,
  featuredDocs,
  getDoc,
  getOtherDocs,
  type Doc,
} from "@/lib/docs";
import { isLocale } from "@/lib/i18n";
import { GITHUB_URL } from "@/lib/site";
import { getMessages } from "@/messages";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getMessages(lang).docs.title } : {};
}

export default async function DocsPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) return null;
  const t = getMessages(lang).docs;
  const href = (slug: string) => `/${lang}/docs/${slug}/`;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
      <div className="mt-6 max-w-3xl rounded-xl border border-accent/40 bg-accent-soft px-5 py-4">
        <p className="font-semibold">{t.notReady}</p>
        <p className="mt-1 text-sm">{t.meanwhile}</p>
        {docsSource.commit && (
          <p className="mt-2 text-xs text-muted">
            {t.synced}{" "}
            <a
              href={`${GITHUB_URL}/tree/${docsSource.commit}/docs`}
              rel="noopener noreferrer"
              className="font-mono hover:underline"
            >
              {docsSource.commit}
            </a>
            {` · ${docsSource.syncedAt}`}
          </p>
        )}
      </div>

      <section aria-labelledby="start" className="mt-10">
        <h2 id="start" className="text-xl font-semibold">
          {t.startHere}
        </h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {featuredDocs.map((entry, i) => {
            const { title, text } = t.featured[entry.id];
            const doc = entry.slug ? getDoc(entry.slug, lang) : undefined;
            const related =
              "related" in entry
                ? entry.related
                    .map((slug) => getDoc(slug, lang))
                    .filter((d): d is Doc => d !== undefined)
                : [];
            const body = (
              <>
                <span className="font-mono text-sm text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-1 block font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-muted">{text}</span>
              </>
            );
            return (
              <li key={entry.id}>
                {doc ? (
                  <Link
                    href={href(doc.slug)}
                    className="block h-full rounded-xl border border-border bg-card p-5 hover:border-accent"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="h-full rounded-xl border border-dashed border-border p-5">
                    {body}
                    <p className="mt-3 text-sm">
                      {t.notWritten}{" "}
                      {related.map((d, j) => (
                        <span key={d.slug}>
                          {j > 0 && ", "}
                          <Link
                            href={href(d.slug)}
                            className="text-accent hover:underline"
                          >
                            {d.title}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="reference" className="mt-12">
        <h2 id="reference" className="text-xl font-semibold">
          {t.reference}
        </h2>
        <ul className="mt-4 columns-1 gap-8 sm:columns-2 lg:columns-3">
          {getOtherDocs(lang).map((doc) => (
            <li key={doc.slug} className="break-inside-avoid py-1">
              <Link
                href={href(doc.slug)}
                className="hover:text-accent hover:underline"
              >
                {doc.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
