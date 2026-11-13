/* Restore · the code doesn't check out — the input-error round (readme
   §13, entry): the recovery-code field wears M3's error state, wording
   the server's rejection of a code that doesn't resolve. */

export function Screen() {
  return <RestoreBody value="7Q3ZD-XK9P2-M4TVE-0RH8N-1WYB6G" error="That code doesn't check out." />;
}
