// The browser's request chain, in one place so the app and the tests
// that stand in for it send the same thing. What rides every call is
// this tab's access token, and it is held in memory — a tab that has
// not signed in or refreshed yet has none, and its requests go out
// anonymous. Server-side answers to those are viewer-shaped nulls, not
// errors, so which reads carry the header is a correctness question and
// belongs where both sides can see it.

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

export function authorizedLink(store: TokenStore, uri: string): ApolloLink {
  const authLink = new SetContextLink((prevContext) => {
    const accessToken = store.accessToken();
    if (accessToken === null) return {};
    return {
      headers: { ...prevContext.headers, authorization: `Bearer ${accessToken}` },
    };
  });
  return ApolloLink.from([authLink, new UploadHttpLink({ uri })]);
}
