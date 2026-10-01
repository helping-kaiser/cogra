/* SETTINGS · AN EMAIL CHANGE IN FLIGHT (jakob 2026-10-01, audit K3.21).

   THE ROW SAYS A CHANGE IS PENDING. A two-sided change can sit half-done for
   its whole window, and a row that went on reading only the old address would
   leave the reader to remember that anything was asked. So the Email row keeps
   its value — the address the account still has, which is the truth until
   both sides land — and takes `Change pending` as its status; the press leads
   back to `ChangeEmailConfirm`, to the side still owed.

   IT IS AN EXEMPLAR OF `Settings` (readme §13, Canvas pages and flows): the
   page is `SettingsBody` whole, and only the Email row is this board's own
   and carries a number; every other row is wired on `Settings`. */
export const FRAME = { width: 390, height: 2613 };

export function Screen() {
  return <SettingsBody emailPending />;
}
