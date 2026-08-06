// Renders a surface under the real provider stack: an injectable token
// store, a real Apollo client pointed at MSW, and the auth runtime.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { SessionProvider } from "@/lib/session/provider";
import { AuthRuntimeProvider } from "@/lib/session/runtime";
import { createTokenStore, type TokenStore } from "@/lib/session/token-store";

export function renderWithProviders(
  ui: ReactNode,
  { store = createTokenStore() }: { store?: TokenStore } = {},
) {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
  const result = render(
    <SessionProvider store={store}>
      <ApolloProvider client={client}>
        <AuthRuntimeProvider>{ui}</AuthRuntimeProvider>
      </ApolloProvider>
    </SessionProvider>,
  );
  return { store, client, ...result };
}
