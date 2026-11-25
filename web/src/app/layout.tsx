import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

import { ApolloWrapper } from "@/lib/apollo-wrapper";
import { AccountDeletionProvider } from "@/lib/deletion/deletion-status";
import { SeenRecordSync } from "@/lib/history/seen-record-sync";
import { DeviceLockKeeper } from "@/lib/identity/device-lock-keeper";
import { AccountPreferencesSync } from "@/lib/settings/account-preferences-sync";
import { GeekModeSync } from "@/lib/settings/geek-mode-sync";
import { THEME_BOOT_SCRIPT } from "@/lib/settings/theme-boot";
import { SessionProvider } from "@/lib/session/provider";
import { AuthRuntimeProvider } from "@/lib/session/runtime";
import { RegistrationProvider } from "@/lib/signing/provider";
import { HiddenProvider } from "@/lib/hidden/provider";
import { SavedProvider } from "@/lib/saved/provider";
import { StanceDataProvider } from "@/lib/stance/provider";
import { KeyboardInsetSync } from "@/lib/ui2/keyboard-inset-sync";

import { AppShell } from "./shell";

// One variable family for everything (design.md §3). latin-ext is not
// optional: `İ ğ ş` live there, so a latin-only subset silently breaks
// Turkish. next/font self-hosts at build time, so no request reaches Google
// from the browser.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
});

// TEXT SCALE IS HONOURED (design/readme.md, "Text scale is honoured and never
// capped"). Chrome on a phone keeps 1rem at 16px whatever the phone's font
// size, unless the page opts in with `<meta name="text-scale"
// content="scale">`: then the initial font size, and with it every `rem`,
// follows the OS setting (developer.chrome.com, "Respect Operating System Text
// Scale"). `other` is Next's documented door for a meta it has no field for.
export const metadata: Metadata = {
  title: "CoGra",
  description: "The CoGra web app.",
  other: { "text-scale": "scale" },
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
    // The theme chosen in Settings rides the document as `data-theme`, and
    // Show exact values as `data-geek`, both set by the head script before
    // the first paint — React did not render them, so the two attributes are
    // the hydration differences this element owns.
    <html
      lang="en"
      className={`${figtree.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
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
              <AccountPreferencesSync />
              <GeekModeSync />
              <KeyboardInsetSync />
              <SeenRecordSync />
              <DeviceLockKeeper />
              <AccountDeletionProvider>
                <RegistrationProvider>
                  <StanceDataProvider>
                    <SavedProvider>
                      <HiddenProvider>
                        <AppShell>{children}</AppShell>
                      </HiddenProvider>
                    </SavedProvider>
                  </StanceDataProvider>
                </RegistrationProvider>
              </AccountDeletionProvider>
            </AuthRuntimeProvider>
          </ApolloWrapper>
        </SessionProvider>
      </body>
    </html>
  );
}
