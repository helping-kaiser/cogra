import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

import { ApolloWrapper } from "@/lib/apollo-wrapper";
import { SessionProvider } from "@/lib/session/provider";
import { AuthRuntimeProvider } from "@/lib/session/runtime";
import { RegistrationProvider } from "@/lib/signing/provider";
import { StanceDataProvider } from "@/lib/stance/provider";

import { AppShell } from "./shell";

// One variable family for everything (design.md §3). latin-ext is not
// optional: `İ ğ ş` live there, so a latin-only subset silently breaks
// Turkish. next/font self-hosts at build time, so no request reaches Google
// from the browser.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "CoGra",
  description: "The CoGra web app.",
};

// cover lets the fixed bottom bar extend into the home-indicator area,
// where its own safe-area padding keeps the slots tappable.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} h-full antialiased`}
    >
      {/* THE DOCUMENT DOES NOT SCROLL — the shell's middle does (`shell.tsx`).
          A percentage height resolves against the LARGE viewport, so a body
          left at `min-h-full` stands taller than the shell's `100dvh` by
          exactly the address bar, and the document keeps that much scroll to
          give away. Pinned to the dynamic viewport and closed, it has none,
          which is also what keeps the address bar from moving at all. */}
      <body className="h-dvh overflow-hidden flex flex-col">
        <SessionProvider>
          <ApolloWrapper>
            <AuthRuntimeProvider>
              <RegistrationProvider>
                <StanceDataProvider>
                  <AppShell>{children}</AppShell>
                </StanceDataProvider>
              </RegistrationProvider>
            </AuthRuntimeProvider>
          </ApolloWrapper>
        </SessionProvider>
      </body>
    </html>
  );
}
