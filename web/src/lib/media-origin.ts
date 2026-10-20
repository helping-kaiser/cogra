import type { TypePolicies } from "@apollo/client";

const MEDIA_PATH_PREFIX = "/media/";

/**
 * The API mints every media URL absolute against its public media origin
 * (a LAN address in development, so phones can reach it). A browser on the
 * host cannot always reach that address, but it can always reach its own
 * page origin, which proxies `/media`. Keeping only the path and query lets
 * the browser resolve the bytes against whichever origin served the page.
 * Anything that is not a `/media/` URL passes through untouched.
 */
export function toSameOriginMediaUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!parsed.pathname.startsWith(MEDIA_PATH_PREFIX)) {
    return url;
  }
  return parsed.pathname + parsed.search;
}

/** Cache read policy: every `MediaAttachment.url` is served same-origin. */
export const mediaTypePolicies: TypePolicies = {
  MediaAttachment: {
    fields: {
      url: {
        read: (existing) =>
          typeof existing === "string" ? toSameOriginMediaUrl(existing) : existing,
      },
    },
  },
};
