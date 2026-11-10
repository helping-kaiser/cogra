// The canonical 8-4-4-4-12 hexadecimal form, either case, and nothing else —
// anchored on both ends, because an id that is merely CONTAINED in other text
// is exactly what a crafted link would supply.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `value` is a UUID, as the wire's `UUID` scalar spells one. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
