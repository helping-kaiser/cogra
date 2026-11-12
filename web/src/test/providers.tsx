// Renders a surface under the real provider stack: an injectable token
// store, a real Apollo client pointed at MSW, and the auth runtime.

import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";

import { CommentEditor } from "@/app/posts/[id]/edit/comment-editor";
import { CommentEditDoor } from "@/lib/compose/comment-edit-door";
import { createGuardedClient } from "@/lib/session/browser-guard";
import { HiddenProvider } from "@/lib/hidden/provider";
import type { KeyCeremony } from "@/lib/identity/key-ceremony";
import { SavedProvider } from "@/lib/saved/provider";
import { SessionProvider } from "@/lib/session/provider";
import { settleReaderState, type ReaderAccountState } from "@/lib/session/reader-state";
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
    cache = new InMemoryCache(),
    hydrate = false,
    reader,
  }: {
    store?: TokenStore;
    /**
     * What the session's one account read answered (`reader-state.ts`), as the
     * root layout's `AccountPreferencesSync` publishes it — staged, since the
     * sync is not mounted here. Absent, the reader stays unsettled.
     */
    reader?: ReaderAccountState | null;
    /**
     * Arrive cold: server-render the tree, then hydrate it, as a reload or a
     * shared link does. The first client commit then reads the session's
     * server snapshot (`resolving`), not the store — the window a surface
     * that waits for its reader must survive.
     */
    hydrate?: boolean;
    /**
     * The client's cache, for a test that needs what an earlier surface (the
     * feed) left in it before the first render. Fresh by default.
     */
    cache?: InMemoryCache;
    ceremony?: KeyCeremony;
    flow?: RegistrationFlow;
    writeSigner?: WriteSigner;
    stanceData?: StanceData;
  } = {},
) {
  if (reader !== undefined) settleReaderState(reader);
  // The same chain the browser builds, over the injected store: which reads
  // carry the viewer's token — and whether they wait for the session to
  // settle before they go at all — is part of what a surface does.
  const client = createGuardedClient(
    store,
    "http://localhost/graphql",
    (link) => new ApolloClient({ cache, link }),
  );
  const tree = (
    <SessionProvider store={store}>
      <ApolloProvider client={client}>
        <AuthRuntimeProvider>
          <RegistrationProvider ceremony={ceremony} flow={flow} writeSigner={writeSigner}>
            <StanceDataProvider data={stanceData}>
              <SavedProvider>
                <HiddenProvider>
                  {/* The shell's door to a comment's edit off its thread (`shell.tsx`). */}
                  <CommentEditDoor editor={CommentEditor}>{ui}</CommentEditDoor>
                </HiddenProvider>
              </SavedProvider>
            </StanceDataProvider>
          </RegistrationProvider>
        </AuthRuntimeProvider>
      </ApolloProvider>
    </SessionProvider>
  );
  if (!hydrate) return { store, client, ...render(tree) };
  const container = document.body.appendChild(document.createElement("div"));
  container.innerHTML = renderToString(tree);
  return { store, client, ...render(tree, { container, hydrate: true }) };
}
