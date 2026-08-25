"use client";

// The client-component Apollo client. In the browser it talks to the
// same-origin /graphql rewrite (no CORS, no public env var); the SSR pass
// needs an absolute URL and reads GRAPHQL_URL like the RSC client.

import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";
import type { ReactNode } from "react";

import { authorizedLink } from "@/lib/apollo-link";
import { tokenStore } from "@/lib/session/token-store";

function makeClient() {
  const uri =
    typeof window === "undefined"
      ? (process.env.GRAPHQL_URL ?? "http://localhost:8080/graphql")
      : "/graphql";
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: authorizedLink(tokenStore, uri),
  });
}

export function ApolloWrapper({ children }: { children: ReactNode }) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>;
}
