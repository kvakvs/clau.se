import type { Metadata } from "next";
import { CookieSettings } from "@/components/cookie-settings";
import { isLocale } from "@/lib/i18n";
import { GITHUB_URL } from "@/lib/site";
import { getMessages } from "@/messages";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getMessages(lang).cookies.title } : {};
}

export default async function CookiesPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) return null;
  const t = getMessages(lang).cookies;

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-3 text-muted">{t.intro}</p>

      <h2 className="mt-10 text-xl font-semibold">{t.choiceTitle}</h2>
      <p className="mt-2 text-muted">{t.choice}</p>
      <CookieSettings t={t} />

      <h2 className="mt-10 text-xl font-semibold">{t.storedTitle}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t.name}
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                {t.purpose}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t.duration}
              </th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((row) => (
              <tr key={row.name} className="border-b border-border">
                <td className="py-1.5 pr-3 font-mono text-xs">{row.name}</td>
                <td className="py-1.5 pr-3">{row.purpose}</td>
                <td className="py-1.5">{row.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-semibold">{t.googleTitle}</h2>
      <p className="mt-2 text-muted">
        {t.google}{" "}
        <a
          href="https://policies.google.com/technologies/partner-sites"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {t.googleLink}
        </a>
      </p>

      <p className="mt-10 text-sm text-muted">
        {t.contact}{" "}
        <a
          href={`${GITHUB_URL}/issues`}
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          GitHub
        </a>
      </p>
    </div>
  );
}
