import { HttpLink } from "@apollo/client";
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from "@apollo/client-integration-nextjs";

import { graphqlUri } from "@/lib/graphql-uri";
import { mediaTypePolicies } from "@/lib/media-origin";

// Server-component client; the client-component wiring lives in
// apollo-wrapper.tsx.
export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache({ typePolicies: mediaTypePolicies }),
    link: new HttpLink({ uri: graphqlUri() }),
  });
});
