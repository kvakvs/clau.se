import { localeNames, localeRedirectScript, locales } from "@/lib/i18n";

/** Site root: redirects to the visitor's language; links for visitors without JavaScript. */
export default function RootPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <script dangerouslySetInnerHTML={{ __html: localeRedirectScript }} />
      <h1 className="mb-6 text-2xl font-semibold">Clause</h1>
      <ul className="space-y-2">
        {locales.map((l) => (
          <li key={l}>
            <a href={`/${l}/`} lang={l} className="text-accent hover:underline">
              {localeNames[l]}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
