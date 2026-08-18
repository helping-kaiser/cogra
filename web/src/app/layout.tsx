import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

import { ApolloWrapper } from "@/lib/apollo-wrapper";
import { SessionProvider } from "@/lib/session/provider";
import { AuthRuntimeProvider } from "@/lib/session/runtime";
import { RegistrationProvider } from "@/lib/signing/provider";

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
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <ApolloWrapper>
            <AuthRuntimeProvider>
              <RegistrationProvider>
                <AppShell>{children}</AppShell>
              </RegistrationProvider>
            </AuthRuntimeProvider>
          </ApolloWrapper>
        </SessionProvider>
      </body>
    </html>
  );
}
