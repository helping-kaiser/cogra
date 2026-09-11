// Renders a surface under the real provider stack: an injectable token
// store, a real Apollo client pointed at MSW, and the auth runtime.

import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { createGuardedClient } from "@/lib/session/browser-guard";
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
  // The same chain the browser builds, over the injected store: which reads
  // carry the viewer's token — and whether they wait for the session to
  // settle before they go at all — is part of what a surface does.
  const client = createGuardedClient(
    store,
    "http://localhost/graphql",
    (link) => new ApolloClient({ cache: new InMemoryCache(), link }),
  );
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
