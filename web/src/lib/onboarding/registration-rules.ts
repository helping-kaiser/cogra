// What the join form may accept, stated once.
//
// These are the SERVER'S rules, mirrored here so the form can refuse
// before it spends a round trip — never a second, laxer opinion. The
// repo-root `client-constants.json` is what the backend exports them
// as, and `client-constants.test.ts` pins every value below to it, so a
// server-side change fails a test here rather than reaching a reader as
// a form that submits and is refused.
//
// The copy beside each field reads its figure from these constants too:
// a rule the screen states and a rule the screen enforces that drift
// apart is the worst of the three possible states.

/** A handle is 3-30 characters (`registration.handleMinChars`/`MaxChars`). */
export const HANDLE_MIN_CHARS = 3;
export const HANDLE_MAX_CHARS = 30;

/**
 * The handle charset (`registration.handleCharsetPattern`): lowercase
 * ASCII, digits, underscore. The form lowercases what is typed, so the
 * pattern refuses only what lowercasing cannot rescue.
 */
export const HANDLE_PATTERN = /^[a-z0-9_]+$/;

/** `registration.passwordMinChars`. */
export const PASSWORD_MIN_CHARS = 12;

/**
 * Whether a handle is one the server would take.
 *
 * Folded first, exactly as `normalize_handle` folds it — trimmed, then
 * lowercased — and only then measured. A form that judged the raw string
 * would be STRICTER than the server it mirrors, disabling submit on a
 * trailing space the server would have trimmed away, and a client
 * refusing what the server accepts is the same defect as the reverse.
 */
export function handleValid(handle: string): boolean {
  const folded = handle.trim().toLowerCase();
  return (
    folded.length >= HANDLE_MIN_CHARS &&
    folded.length <= HANDLE_MAX_CHARS &&
    HANDLE_PATTERN.test(folded)
  );
}

export function passwordValid(password: string): boolean {
  return password.length >= PASSWORD_MIN_CHARS;
}

/**
 * The address check is deliberately "has an `@`", not a grammar.
 *
 * Every regex short of RFC 5322 rejects a deliverable address someone
 * actually has, and the only proof an address exists is the
 * verification mail the server sends anyway. So the form checks the one
 * thing a typo always breaks and leaves the verdict to delivery.
 */
export function emailPlausible(email: string): boolean {
  return email.includes("@");
}
