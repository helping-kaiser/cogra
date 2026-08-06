// A short user-readable session label for the sessions list, derived from
// the user agent (auth.md § Tokens; Android sends Build.MODEL).

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/Windows/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad/, "iOS"],
  [/Mac OS/, "macOS"],
  [/Linux/, "Linux"],
];

export function deviceLabel(userAgent?: string): string | null {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : null);
  if (ua === null) return null;
  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? "Browser";
  const system = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1];
  return system === undefined ? browser : `${browser} on ${system}`;
}
