/** Clause mark: an Erlang-style clause arrow inside a rounded square. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path
        d="M8 11h9M8 16h12l-4-4M20 16l-4 4M8 21h9"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-accent-fg"
      />
    </svg>
  );
}
