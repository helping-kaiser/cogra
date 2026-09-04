/**
 * Where GraphQL is, said once.
 *
 * In the browser it is the same-origin `/graphql` rewrite (no CORS, no public
 * env var); the SSR and RSC passes need an absolute url and read `GRAPHQL_URL`.
 *
 * The resumable upload path derives its own route from this — the phone trusts
 * one certificate, for one origin, and every hop it makes has to go through it
 * (next.config.ts, the `/media/uploads/:path*` rewrite) — so the two must not
 * be able to disagree.
 */
export function graphqlUri(): string {
  if (typeof window !== "undefined") return "/graphql";
  return process.env.GRAPHQL_URL ?? "http://localhost:8080/graphql";
}
