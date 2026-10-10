import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { GITHUB_URL } from "@/lib/site";
import { getMessages } from "@/messages";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getMessages(lang).resources.title } : {};
}

export default async function ResourcesPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) return null;
  const t = getMessages(lang).resources;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-3 text-muted">{t.intro}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        <li>
          <a
            href={GITHUB_URL}
            rel="noopener noreferrer"
            className="flex h-full gap-4 rounded-xl border border-border bg-card p-5 hover:border-accent"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-8 shrink-0"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
            </svg>
            <span>
              <span className="block font-semibold">{t.github.title}</span>
              <span className="mt-1 block text-sm text-muted">
                {t.github.text}
              </span>
              <span className="mt-2 block font-mono text-sm break-all text-accent">
                github.com/kvakvs/clause
              </span>
            </span>
          </a>
        </li>
      </ul>
      <h2 className="mt-12 text-lg font-semibold">{t.credits}</h2>
      <p className="mt-2 text-sm text-muted">
        <a
          href="https://www.flaticon.com/free-icons/carpenter"
          title="carpenter icons"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Carpenter icons created by Flat Icons - Flaticon
        </a>
      </p>
    </>
  );
}
