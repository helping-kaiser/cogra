// The resumable upload path (api-spec.md "Resuming a large upload"): begin,
// then one PUT per part, then complete — so a dropped connection costs one
// part rather than the file. Android's `ChunkedUpload.kt` is the reference and
// this is deliberately its twin.
//
// **The whole point is that a part is the unit of failure.** A ninety
// megabyte video used to ride one long POST, so a connection that blinked
// anywhere in it lost everything and the retry started from zero. Here a part
// number names a position rather than an attempt — "re-sending a part replaces
// it" — so a blip costs one part and the upload carries on without the author
// being told anything happened.
//
// **On `fetch` rather than the Apollo link.** The parts are not a GraphQL
// operation: they are a plain authenticated PUT whose body is the bytes, and
// the API serves that route beside `/graphql` for exactly that reason
// (crates/api/src/lib.rs, "Why this is a route and not a mutation"). `fetch`
// is what the platform documents for it, and a `Blob` body needs no
// intermediate copy — `Blob.slice()` "returns a new Blob object which contains
// data from a subset of the blob it's called from"
// (https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice), so a 90 MiB
// video is never held twice.

import { delayMs, retryable } from "./upload-retry";

/** The part route's own vocabulary — null on success, a message on failure. */
export type PartsFailure = string;

const OCTET_STREAM = "application/octet-stream";

const UNAUTHORIZED = 401;
const SERVER_ERROR = 500;

const TRANSPORT = "The upload could not reach the server.";
const REFUSED = "The server would not take that video.";
const MALFORMED = "That file could not be read as a video.";

type PartResult = "sent" | "refused" | "transient";

export type PartUploader = {
  /**
   * Sends every part of `blob` for `uploadId`.
   *
   * Answers null on success, or the message to surface when a part has
   * exhausted its attempts.
   */
  sendAll(
    uploadId: string,
    blob: Blob,
    partSizeBytes: number,
    partCount: number,
  ): Promise<PartsFailure | null>;
};

/**
 * Where the part route lives, derived from the GraphQL endpoint rather than
 * configured separately: the parts are served by the same Axum app, so a
 * second setting could only ever disagree with the first — and in the browser
 * both go through the one origin whose certificate the device trusts
 * (next.config.ts, the `/media/uploads/:path*` rewrite).
 *
 * A relative endpoint ("/graphql", which is what the browser uses) answers
 * with the empty string, so the part path stays same-origin too.
 */
export function uploadsOrigin(graphqlUri: string): string {
  try {
    return new URL(graphqlUri).origin;
  } catch {
    return "";
  }
}

export function createPartUploader(deps: {
  /** From `uploadsOrigin`; "" means same-origin. */
  origin: string;
  /** This tab's access token, read per attempt so a refresh mid-upload lands. */
  accessToken: () => string | null;
  /** Injected so the suites drive the backoff on a virtual clock. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected so a test can pin the schedule. */
  random?: () => number;
  /** Injected so a test needs no server. */
  fetchImpl?: typeof fetch;
}): PartUploader {
  const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const random = deps.random ?? Math.random;
  const doFetch = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  const partUrl = (uploadId: string, partNumber: number) =>
    `${deps.origin}/media/uploads/${uploadId}/parts/${partNumber}`;

  /**
   * One PUT.
   *
   * A transport fault is worth trying again; a refusal is an answer and is
   * not. The route speaks the same vocabulary here as it does over GraphQL, so
   * a 4xx that is not an expired token means the request was wrong and
   * repeating it would only be slower — the codes it actually answers with
   * (NOT_FOUND, BAD_INPUT, FORBIDDEN) are all in the same terminal set the
   * write signer clears material on.
   *
   * NO REQUEST TIMEOUT, and that is the deviation from android worth naming.
   * `HttpURLConnection.readTimeout` bounds one idle read; `fetch` has no such
   * knob — `AbortSignal.timeout()` bounds the WHOLE request instead
   * (https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout), so
   * any value large enough for eight mebibytes over a poor link is too large
   * to catch anything, and any value small enough to catch a stall would kill
   * the slow-but-working upload this class exists to protect. A dead
   * connection still surfaces: the platform rejects the promise, which is a
   * transient fault here.
   */
  async function attemptPart(
    uploadId: string,
    partNumber: number,
    chunk: Blob,
  ): Promise<PartResult> {
    const token = deps.accessToken();
    let response: Response;
    try {
      response = await doFetch(partUrl(uploadId, partNumber), {
        method: "PUT",
        headers: {
          ...(token === null ? {} : { authorization: `Bearer ${token}` }),
          "content-type": OCTET_STREAM,
        },
        body: chunk,
      });
    } catch {
      // The case this exists for: the connection went away. `fetch` rejects
      // on a network fault and on nothing else.
      return "transient";
    }
    if (response.ok) return "sent";
    // A stale access token is worth one more try: the guard refreshes around
    // the calls that bracket this one, so the next attempt reads a fresh
    // header without this loop knowing how.
    if (response.status === UNAUTHORIZED) return "transient";
    if (response.status < SERVER_ERROR) return "refused";
    return "transient";
  }

  /** One part, retried until it lands or the budget runs out. */
  async function sendOne(
    uploadId: string,
    partNumber: number,
    chunk: Blob,
  ): Promise<PartsFailure | null> {
    let attempt = 1;
    for (;;) {
      const wait = delayMs(attempt, random());
      if (wait > 0) await sleep(wait);

      const result = await attemptPart(uploadId, partNumber, chunk);
      if (result === "sent") return null;
      if (result === "refused") return REFUSED;
      if (!retryable(attempt)) return TRANSPORT;
      attempt += 1;
    }
  }

  return {
    /**
     * Parts go one at a time. The contract allows two or three at once and it
     * would be faster, but the failure this exists to fix is a network that
     * went away — where concurrency multiplies the attempts spent against a
     * dead link rather than the bytes moved.
     */
    async sendAll(uploadId, blob, partSizeBytes, partCount) {
      for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
        const offset = (partNumber - 1) * partSizeBytes;
        // Every part but the last is exactly the dictated size; the last is
        // whatever remains. A part of any other size is refused at the route,
        // not discovered at assembly.
        const end = Math.min(offset + partSizeBytes, blob.size);
        if (end <= offset) return MALFORMED;
        const failure = await sendOne(uploadId, partNumber, blob.slice(offset, end));
        if (failure !== null) return failure;
      }
      return null;
    },
  };
}
