// The tab's account boundary, for the module stores that hold one reader's
// hand-overs. Several accounts share a tab (auth.md "Multi-account device
// custody"), and every way the active account ends or changes — sign-out, a
// refused refresh, another tab's sign-out or switch, a sign-in or join over a
// session — moves the token store's active account, so the store is the one
// place they share. A rotation keeps the account and fires nothing.

import { tokenStore, type TokenStore } from "./token-store";

/** Calls `forget` each time the active account ends or changes; answers the unsubscribe. */
export function onAccountChange(
  forget: () => void,
  accounts: Pick<TokenStore, "activeAccountId" | "subscribe"> = tokenStore,
): () => void {
  let account = accounts.activeAccountId();
  return accounts.subscribe(() => {
    const next = accounts.activeAccountId();
    if (next === account) return;
    account = next;
    forget();
  });
}
