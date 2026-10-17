import { LanguageSelect } from "@/components/language-select";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Locale } from "@/lib/i18n";
import type { Messages } from "@/messages/en";

type Props = { locale: Locale; t: Messages };

export function SiteHeader({ locale, t }: Props) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <a
          href={`/${locale}/`}
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Logo className="size-7" />
          Clause
        </a>
        <div className="order-last w-full sm:order-none sm:w-auto">
          <NavLinks
            label={t.nav.label}
            links={[
              { href: `/${locale}/`, text: t.nav.home },
              { href: `/${locale}/docs/`, text: t.nav.docs },
              { href: `/${locale}/benchmarks/`, text: t.nav.benchmarks },
              { href: `/${locale}/resources/`, text: t.nav.resources },
            ]}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSelect locale={locale} label={t.language.label} />
          <ThemeToggle label={t.theme.label} names={t.theme} />
        </div>
      </div>
    </header>
  );
}
