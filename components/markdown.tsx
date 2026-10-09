import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { resolveDocHref } from "@/lib/docs";
import type { Locale } from "@/lib/i18n";

type Props = { source: string; locale: Locale; headingIds: string[] };

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/**
 * Gives headings the anchor ids of the English original, in order, so that
 * links such as compile.md#llvm-sdk work in translated pages too.
 */
function rehypeHeadingIds(ids: string[]) {
  return () => (tree: HastNode) => {
    let next = 0;
    const visit = (node: HastNode) => {
      if (node.type === "element" && /^h[1-6]$/.test(node.tagName ?? "")) {
        const id = ids[next++];
        if (id) node.properties = { ...node.properties, id };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

/** Renders a repository doc at build time; links are mapped to site routes or GitHub. */
export function Markdown({ source, locale, headingIds }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHeadingIds(headingIds)]}
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
