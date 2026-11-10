import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from "@apollo/client-integration-nextjs";

import { mediaTypePolicies } from "@/lib/media-origin";
import { ssrLink } from "@/lib/ssr-link";

// Server-component client; the client-component wiring lives in
// apollo-wrapper.tsx.
export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache({ typePolicies: mediaTypePolicies }),
    link: ssrLink(),
  });
});
