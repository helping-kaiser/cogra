// Renders a surface under the real provider stack: an injectable token
// store, a real Apollo client pointed at MSW, and the auth runtime.

import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { authorizedLink } from "@/lib/apollo-link";
import type { KeyCeremony } from "@/lib/identity/key-ceremony";
import { SessionProvider } from "@/lib/session/provider";
import { AuthRuntimeProvider } from "@/lib/session/runtime";
import { createTokenStore, type TokenStore } from "@/lib/session/token-store";
import { RegistrationProvider } from "@/lib/signing/provider";
import type { RegistrationFlow } from "@/lib/signing/registration-flow";
import type { WriteSigner } from "@/lib/signing/write-signer";
import { StanceDataProvider } from "@/lib/stance/provider";
import type { StanceData } from "@/lib/stance/stance-data";

export function renderWithProviders(
  ui: ReactNode,
  {
    store = createTokenStore(),
    ceremony,
    flow,
    writeSigner,
    stanceData,
  }: {
    store?: TokenStore;
    ceremony?: KeyCeremony;
    flow?: RegistrationFlow;
    writeSigner?: WriteSigner;
    stanceData?: StanceData;
  } = {},
) {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    // The same chain the browser builds, over the injected store: which
    // reads carry the viewer's token is part of what a surface does.
    link: authorizedLink(store, "http://localhost/graphql"),
  });
  const result = render(
    <SessionProvider store={store}>
      <ApolloProvider client={client}>
        <AuthRuntimeProvider>
          <RegistrationProvider ceremony={ceremony} flow={flow} writeSigner={writeSigner}>
            <StanceDataProvider data={stanceData}>{ui}</StanceDataProvider>
          </RegistrationProvider>
        </AuthRuntimeProvider>
      </ApolloProvider>
    </SessionProvider>,
  );
  return { store, client, ...result };
}
