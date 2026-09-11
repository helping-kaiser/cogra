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

import { graphqlUri } from "@/lib/graphql-uri";
import { createGuardedClient } from "@/lib/session/browser-guard";
import { tokenStore } from "@/lib/session/token-store";

// The guard is built with the client rather than under it: the chain waits
// on the guard's readiness, and the surfaces reach for the same one
// (`session/browser-guard.ts`).
function makeClient() {
  return createGuardedClient(
    tokenStore,
    graphqlUri(),
    (link) => new ApolloClient({ cache: new InMemoryCache(), link }),
  );
}

export function ApolloWrapper({ children }: { children: ReactNode }) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>;
}
