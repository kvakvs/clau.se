import Image from "next/image";
import { formatTimes, kernelGeomean, kernels } from "@/lib/benchmarks";
import { isLocale } from "@/lib/i18n";
import { GITHUB_URL } from "@/lib/site";
import { getMessages } from "@/messages";
import logoLarge from "@/public/logo-large.png";

type Props = { params: Promise<{ lang: string }> };

export default async function HomePage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) return null;
  const messages = getMessages(lang);
  const t = messages.home;
  // Clause -O2 against OTP: "2.00× faster" or "1.50× slower".
  const faster = kernelGeomean < 1;
  const speedup = faster ? 1 / kernelGeomean : kernelGeomean;
  const side = faster
    ? messages.benchmarks.barFaster
    : messages.benchmarks.barSlower;

  return (
    <>
      <section className="flow-root">
        <Image
          src={logoLarge}
          alt=""
          className="float-left mr-4 mb-2 w-16 sm:mr-8 sm:mb-4 sm:w-1/5"
          priority
        />
        <div className="sm:flow-root">
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-5 text-lg text-muted">{t.intro}</p>
          <p className="mt-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted">
            {t.status}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`/${lang}/docs/`}
              className="rounded-full bg-accent px-5 py-2.5 font-medium text-accent-fg hover:opacity-90"
            >
              {t.ctaDocs}
            </a>
            <a
              href={GITHUB_URL}
              rel="noopener noreferrer"
              className="rounded-full border border-border px-5 py-2.5 font-medium hover:border-muted"
            >
              {t.ctaSource}
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="features" className="mt-16">
        <h2 id="features" className="text-2xl font-semibold">
          {t.cardsTitle}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.cards.map((card) =>
            card.id === "benchmarks" ? (
              // Filled from the latest benchmark report; links to its page.
              <li
                key={card.id}
                className="relative flex flex-col rounded-xl border border-border bg-card p-5 hover:border-muted"
              >
                <p className="font-mono text-xl font-semibold text-accent">
                  {card.property
                    .replace("{ratio}", formatTimes(lang, speedup))
                    .replace("{side}", side)}
                </p>
                <h3 className="mt-3 font-semibold">
                  <a
                    href={`/${lang}/benchmarks/`}
                    className="after:absolute after:inset-0"
                  >
                    {card.title}
                  </a>
                </h3>
                <p className="mt-2 text-sm text-muted">
                  {card.text.replace("{count}", String(kernels.length))}
                </p>
              </li>
            ) : (
              <li
                key={card.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5"
              >
                <p className="font-mono text-xl font-semibold text-accent">
                  {card.property}
                </p>
                <h3 className="mt-3 font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm text-muted">{card.text}</p>
              </li>
            ),
          )}
        </ul>
      </section>

      <section aria-labelledby="details" className="mt-16">
        <h2 id="details" className="text-2xl font-semibold">
          {t.detailsTitle}
        </h2>
        <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {t.details.map((group) => (
            <div key={group.id}>
              <h3 className="border-b border-border pb-2 font-semibold">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-accent">
                      →
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
