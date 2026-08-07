// Invite input parsing, shared by the front door, the /join route, and
// the re-arm card: a pasted /join/<id> URL and a bare id are both fine
// (auth.md "Link URLs" — the paste is the universal fallback). The last
// UUID wins so a full URL's path id beats anything earlier in the text.

const UUID = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

/** The invite-link id in the pasted text, or null when none is there. */
export function extractInviteId(input: string): string | null {
  const matches = input.trim().match(UUID);
  if (matches === null || matches.length === 0) return null;
  return matches[matches.length - 1].toLowerCase();
}
