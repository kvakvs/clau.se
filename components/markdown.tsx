import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { resolveDocHref } from "@/lib/docs";
import type { Locale } from "@/lib/i18n";

type Props = { source: string; locale: Locale };

/** Renders a repository doc at build time; links are mapped to site routes or GitHub. */
export function Markdown({ source, locale }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug]}
      components={{
        a: ({ href = "", children }) => {
          const target = resolveDocHref(href, locale);
          if (target.startsWith("/") || target.startsWith("#")) {
            return <Link href={target}>{children}</Link>;
          }
          return (
            <a href={target} rel="noopener noreferrer">
              {children}
            </a>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto">
            <table>{children}</table>
          </div>
        ),
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
