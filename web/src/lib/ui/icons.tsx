// The shell's Material icons, inlined from Google's
// material-design-icons set (Apache-2.0) — the same glyphs the
// Android bar wraps via androidx material-icons, so the two bars
// match. Self-hosted like the fonts: no icon font, no external
// fetch. Source: github.com/google/material-design-icons,
// src/<category>/<name>/<variant>/24px.svg.

type IconProps = { className?: string };

// The classic set draws one dynamic_feed glyph — Android's Filled
// and Outlined variants share it too; selection shows in colour.
export function DynamicFeedIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8,8H6v7c0,1.1,0.9,2,2,2h9v-2H8V8z" />
      <path d="M20,3h-8c-1.1,0-2,0.9-2,2v6c0,1.1,0.9,2,2,2h8c1.1,0,2-0.9,2-2V5C22,3.9,21.1,3,20,3z M20,11h-8V7h8V11z" />
      <path d="M4,12H2v7c0,1.1,0.9,2,2,2h9v-2H4V12z" />
    </svg>
  );
}

export function PersonIcon({
  filled = false,
  className = "h-6 w-6",
}: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      {filled ? (
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      ) : (
        <path d="M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 10c2.7 0 5.8 1.29 6 2H6c.23-.72 3.31-2 6-2m0-12C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      )}
    </svg>
  );
}

export function AddIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  );
}
