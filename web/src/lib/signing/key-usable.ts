// One statement of the slot-versus-attached invariant.
//
// A custody slot holding a key says nothing on its own about whose key it is.
// The device's slot is filled by the ceremony, by a restore, and — during the
// migration window — by adopting a pre-multi-account singleton record, and only
// the last of those ties the key to the account that ends up reading it. The
// account's ATTACHED public key is the server's answer to "whose", so a slot
// key that contradicts it is not this account's to sign with.

/**
 * Whether the slot key counts as this account's (roadmap.md slice 1.1).
 *
 * A mismatch reads as key-not-on-device, so a surface offers restore rather
 * than signing with a foreign key. `attachedPub === null` is the pre-attach
 * window — the account has no key yet, so the slot's key cannot contradict it.
 */
export function keyUsable(devicePub: string | null, attachedPub: string | null): boolean {
  return devicePub !== null && (attachedPub === null || attachedPub === devicePub);
}
