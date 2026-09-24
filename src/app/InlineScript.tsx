"use client";

// Pattern from node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
// ("Extracting a reusable component"): type is text/javascript on the server
// and text/plain on the client, avoiding React's dev warning for <script> tags.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
