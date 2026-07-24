import { HttpLink } from "@apollo/client";
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from "@apollo/client-integration-nextjs";

// Server-component client. Client-component wiring (ApolloNextAppProvider)
// is added by the first surface that needs client-side data.
export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: process.env.GRAPHQL_URL ?? "http://localhost:8080/graphql",
    }),
  });
});
