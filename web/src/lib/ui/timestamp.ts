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
