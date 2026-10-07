// The card's compact age, in the boards' own vocabulary.
//
// `design/components/content/PostCard.jsx:248` puts a timestamp beside the
// author on every card, and the canonical screens fix the words it may use:
// `now` (`screens/ComposeLanded.jsx:10`), then minutes, hours and days —
// `35m`, `45m`, `10m`, `1h`, `2h`, `4h`, `3d` across `screens/_shared.jsx`. No
// board draws a week, a month or a year, so none is invented here: past a day
// the count keeps running in days.
//
// FLOORED, NEVER ROUNDED. A post 119 minutes old reads `1h`, because rounding
// up would let a card claim an age it has not reached — the same honesty the
// rest of the surface owes.

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_HOURS = 24;

/**
 * An ISO instant as the card draws it.
 *
 * `now` is a parameter rather than a call inside, so a test states the
 * moment it is asking about instead of racing the clock.
 */
export function shortTimestamp(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  // A clock skewed behind the server would otherwise print a negative age;
  // "now" is the honest reading of a record that has not aged yet.
  const minutes = Math.floor(Math.max(0, now - then) / MINUTE_MS);
  if (minutes < 1) return "now";
  if (minutes < HOUR_MINUTES) return `${minutes}m`;
  const hours = Math.floor(minutes / HOUR_MINUTES);
  if (hours < DAY_HOURS) return `${hours}h`;
  return `${Math.floor(hours / DAY_HOURS)}d`;
}

/** The ladder's last rung: past it, an age is history and reads as a date. */
const LADDER_DAYS = 30;

/** `12.08.2026` — the house date (copy-voice.md *Ages*). */
export function dateline(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(at.getDate())}.${pad(at.getMonth() + 1)}.${at.getFullYear()}`;
}

/**
 * THE ONE AGES VOCABULARY (copy-voice.md *Ages*, ruled 2026-09-09): the
 * minutes/hours/days ladder up to 30 days — `now`, `35m`, `2h`, `3d` — and
 * the date past it. Settings' `Last used 2d` and `Changed 21d` speak it.
 */
export function ladderAge(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const days = Math.floor(Math.max(0, now - then) / (MINUTE_MS * HOUR_MINUTES * DAY_HOURS));
  return days > LADDER_DAYS ? dateline(iso) : shortTimestamp(iso, now);
}
