-- Actor-identity uniqueness (auth.md §Application): an address binds at
-- most one account — the address's Registration can exist on the graph
-- only once, so a cross-account duplicate would wedge the second
-- admission behind an unlandable record. The unique indexes are the
-- race-proof enforcement behind attachActorKey's refusal; key and
-- address are 1:1 (the address derives from the key), so both columns
-- carry the invariant. NULLs (a user-kind actor before the ceremony)
-- never collide.

CREATE UNIQUE INDEX actors_actor_pubkey_key ON actors (actor_pubkey);
CREATE UNIQUE INDEX actors_l0_address_key ON actors (l0_address);
