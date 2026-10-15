import { GITHUB_URL } from "@/lib/site";
import type { Messages } from "@/messages/en";
import homeMeta from "@/content/home-meta.json";

export function SiteFooter({ t }: { t: Messages }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted">
        <p>Clause · {t.footer.tagline}</p>
        <p className="flex items-center gap-4">
          {/* Date of the last /update-doc run (content/home-meta.json). */}
          <span>
            {t.footer.updated}{" "}
            <time dateTime={homeMeta.updatedAt} className="tabular-nums">
              {homeMeta.updatedAt}
            </time>
          </span>
          <a
            href={GITHUB_URL}
            rel="noopener noreferrer"
            className="hover:text-fg"
          >
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
