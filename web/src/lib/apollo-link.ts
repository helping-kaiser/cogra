// The browser's request chain, in one place so the app and the tests
// that stand in for it send the same thing. What rides every call is
// this tab's access token, and it is held in memory — a tab that has
// not signed in or refreshed yet has none, and its requests go out
// anonymous. Server-side answers to those are viewer-shaped nulls, not
// errors, so which reads carry the header is a correctness question and
// belongs where both sides can see it.
//
// WHICH IS WHY NOTHING LEAVES THIS TAB BEFORE THE SESSION HAS SETTLED. A
// freshly loaded page holds no access token at all — the refresh token sits in
// localStorage, but the access token is minted by a refresh — so every read a
// surface starts on mount would otherwise go out anonymous and be answered
// with the guest's view: the borrowed-view band under a stranger's name, a
// listing without the reader's own pending writes. Those answers are
// viewer-shaped nulls rather than refusals, so the guard never sees an
// UNAUTHENTICATED to replay and nothing refetches when the token lands. The
// gate below is the whole tab's version of the rule the uploads already
// follow: settle the session first, then send.
//
// SETTLED IS NOT SIGNED IN. `prime` resolves three ways and all three are
// settlements — a token already in hand, a refresh that produced one, and a
// refresh that could not run or did not succeed, the last being a tab that is
// legitimately anonymous and whose request should go out as such. A
// signed-out visitor pays no network for it: priming asks the refresher,
// which reads the stored refresh token synchronously and answers false, so
// the gate costs a guest microtasks and nothing more.
//
// THE REFRESH ITSELF IS THE ONE OPERATION THAT MUST NOT WAIT — it is what
// readiness resolves to, so waiting for readiness would be waiting for
// itself. It carries `SKIP_SESSION_READINESS`, and it is the only thing that
// does.
//
// THE TERMINATING LINK CARRIES UPLOADS. `uploadMedia` takes the bytes as an
// `Upload` scalar, which on the wire is a GraphQL multipart request — a
// `multipart/form-data` POST whose `operations` field holds the operation with
// the file replaced by null, whose `map` field says where each file belongs,
// and whose remaining fields are the files themselves
// (https://github.com/jaydenseric/graphql-multipart-request-spec).
//
// Apollo Client does not build that request: "Apollo Client doesn't support a
// file upload feature out of the box… you will have to set Apollo Client up
// manually with a 3rd party package", and the package its own documentation
// names is `apollo-upload-client`
// (https://www.apollographql.com/docs/react/data/file-uploads). So the
// terminating link is that package's `UploadHttpLink` rather than `HttpLink`:
// it sends a plain POST for every operation whose variables hold no file, and
// switches to the multipart encoding only when one does — which means every
// existing call keeps its current shape on the wire.

import { ApolloLink } from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";
import UploadHttpLink from "apollo-upload-client/UploadHttpLink.mjs";

import type { TokenStore } from "@/lib/session/token-store";

/**
 * Settle this tab's session — a token in hand, or the knowledge that there is
 * none to have. `AuthGuard.prime` is the implementation; the link takes it as
 * a function because the guard refreshes *through* the client whose chain this
 * is (`session/browser-guard.ts` ties the knot).
 */
export type SessionReadiness = () => Promise<void>;

/** Marks the refresh mutation, the one operation the readiness gate lets by. */
export const SKIP_SESSION_READINESS = "cograSkipSessionReadiness";

export function authorizedLink(
  store: TokenStore,
  uri: string,
  ready: SessionReadiness,
): ApolloLink {
  const authLink = new SetContextLink(async (prevContext) => {
    if (prevContext[SKIP_SESSION_READINESS] !== true) await ready();
    const accessToken = store.accessToken();
    if (accessToken === null) return {};
    return {
      headers: { ...prevContext.headers, authorization: `Bearer ${accessToken}` },
    };
  });
  return ApolloLink.from([authLink, new UploadHttpLink({ uri })]);
}
