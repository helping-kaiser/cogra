// The profile's authored-text caps — the write side's, mirrored client-side so
// a reader never types past a limit the server refuses.
//
// Every cap here is counted in Unicode scalar values, which is what the
// server's `chars().count()` counts and `"".length` — UTF-16 code units — does
// not: an astral character like an emoji weighs two there and one here.
//
// The three figures are the SERVER'S, not this app's: `client-constants.json`
// exports them and `lib/client-constants.test.ts` pins every one of them to
// it, so a cap that moves on the backend fails here rather than reaching a
// reader as a save the form accepted and the server refused.

/** One display name, matching the server's `displayNameChars`. */
export const DISPLAY_NAME_MAX_CHARS = 50;

/** The refusal an over-long display name earns, or null. */
export function displayNameProblem(displayName: string): string | null {
  return [...displayName.trim()].length > DISPLAY_NAME_MAX_CHARS
    ? `Too long — at most ${DISPLAY_NAME_MAX_CHARS} characters.`
    : null;
}

/** One bio, matching the server's `bioChars`. */
export const BIO_MAX_CHARS = 500;

/** The refusal an over-long bio earns, or null. */
export function bioProblem(bio: string): string | null {
  return [...bio.trim()].length > BIO_MAX_CHARS
    ? `Too long — at most ${BIO_MAX_CHARS} characters.`
    : null;
}

/** One website URL, matching the server's `websiteUrlChars`. */
export const WEBSITE_URL_MAX_CHARS = 2048;

/** The refusal an over-long website URL earns, or null. */
export function websiteUrlProblem(websiteUrl: string): string | null {
  return [...websiteUrl.trim()].length > WEBSITE_URL_MAX_CHARS
    ? `Too long — at most ${WEBSITE_URL_MAX_CHARS} characters.`
    : null;
}
