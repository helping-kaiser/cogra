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
import { graphqlUri } from "@/lib/graphql-uri";
import { tokenStore } from "@/lib/session/token-store";

function makeClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: authorizedLink(tokenStore, graphqlUri()),
  });
}

export function ApolloWrapper({ children }: { children: ReactNode }) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>;
}
