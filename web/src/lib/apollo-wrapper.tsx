"use client";

// The client-component Apollo client. In the browser it talks to the
// same-origin /graphql rewrite (no CORS, no public env var); the SSR pass
// needs an absolute URL and reads GRAPHQL_URL like the RSC client.

import { ApolloLink, HttpLink } from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";
import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";
import type { ReactNode } from "react";

import { tokenStore } from "@/lib/session/token-store";

function makeClient() {
  const uri =
    typeof window === "undefined"
      ? (process.env.GRAPHQL_URL ?? "http://localhost:8080/graphql")
      : "/graphql";
  const authLink = new SetContextLink((prevContext) => {
    const accessToken = tokenStore.accessToken();
    if (accessToken === null) return {};
    return {
      headers: { ...prevContext.headers, authorization: `Bearer ${accessToken}` },
    };
  });
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([authLink, new HttpLink({ uri })]),
  });
}

export function ApolloWrapper({ children }: { children: ReactNode }) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>;
}
