// An honest server's answer to an upload, for the view suites.
//
// The view suites' transport sends no file body (the multipart link is not
// in play), so the server cannot hash what it was sent. Each suite instead
// pins the device's upload digest to SENT_DIGEST with
//
//   vi.mock("@/lib/api/media-api", async (importOriginal) => ({
//     ...(await importOriginal<typeof import("@/lib/api/media-api")>()),
//     uploadDigestOf: async () => "ee".repeat(32),
//   }));
//
// and answers with that same digest — the echo every finished upload is
// checked against. The hashing itself is `uploads.test.ts`'s subject, pinned
// there against Node's own crypto.

/** The device's upload digest in the view suites — the mock's own literal. */
export const SENT_DIGEST = "ee".repeat(32);

/** An uploaded asset as the server answers it: READY, both digests the bytes sent. */
export function echoedMedia(
  id: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    __typename: "MediaAttachment",
    id,
    url: `https://media.test/${id}`,
    altText: null,
    status: "NORMAL",
    mimeType: "image/webp",
    options: { __typename: "MediaOptions", aspectRatio: "4:5", durationMs: null },
    coverMedia: null,
    coverTaken: false,
    state: "READY",
    failureReason: null,
    digest: SENT_DIGEST,
    uploadDigest: SENT_DIGEST,
    ...extra,
  };
}
