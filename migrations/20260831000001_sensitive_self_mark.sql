-- The author's own sensitive mark, versioned with the content state it
-- describes. A content act carries the complete content state
-- (data-model.md "The payload envelope"), so the mark lives on the
-- version row like the title does: an edit that omits it writes an
-- unmarked version, and the history keeps both.
--
-- One boolean is the whole vocabulary. The mark's reach is fixed —
-- it veils the body, media, words and description as one region, and
-- leaves the title and topics readable (moderation.md §1) — so there is
-- no per-field choice to store. Moderator verdicts are separate
-- operational metadata; this column is the author's own statement,
-- mirrored from guild keys 13 and 14 of the witnessed payload.

ALTER TABLE post_versions
    ADD COLUMN sensitive        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN sensitive_reason TEXT,
    ADD CONSTRAINT post_versions_reason_needs_mark CHECK (
        sensitive_reason IS NULL OR sensitive
    );

ALTER TABLE comment_versions
    ADD COLUMN sensitive        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN sensitive_reason TEXT,
    ADD CONSTRAINT comment_versions_reason_needs_mark CHECK (
        sensitive_reason IS NULL OR sensitive
    );
