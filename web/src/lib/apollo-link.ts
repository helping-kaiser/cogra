// The browser's request chain, in one place so the app and the tests
// that stand in for it send the same thing. What rides every call is
// this tab's access token, and it is held in memory — a tab that has
// not signed in or refreshed yet has none, and its requests go out
// anonymous. Server-side answers to those are viewer-shaped nulls, not
// errors, so which reads carry the header is a correctness question and
// belongs where both sides can see it.

import { ApolloLink, HttpLink } from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";

import type { TokenStore } from "@/lib/session/token-store";

export function authorizedLink(store: TokenStore, uri: string): ApolloLink {
  const authLink = new SetContextLink((prevContext) => {
    const accessToken = store.accessToken();
    if (accessToken === null) return {};
    return {
      headers: { ...prevContext.headers, authorization: `Bearer ${accessToken}` },
    };
  });
  return ApolloLink.from([authLink, new HttpLink({ uri })]);
}
