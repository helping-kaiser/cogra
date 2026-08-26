#![no_main]
//! `markdown_regions` — arbitrary text into [`frontend_md::parse`],
//! asserting no panic, and that every region's pieces lie within the file and
//! do not overlap, per design.md (´preview:lint:fuzz-plan´).
//!
//! The design names the recursive descent of the Markdown region walk as one
//! of the two deferred hazards to look at first, so the target is pointed at
//! the walk rather than at the frontend's periphery: deeply nested structure
//! is exactly what the mutator finds cheaply from a seed corpus of real
//! Markdown, and the assertions below are all about what the walk assembled.
//!
//! # The piece contract
//!
//! [`Region::pieces`] carries the file ranges the logical text was assembled
//! from, in order, and the crate states that their lengths sum to the length
//! of [`Region::text`] — a piece is copied verbatim, never transformed, which
//! is what makes [`Region::locate`] exact. That sum is asserted here beside
//! the containment and ordering the plan names, because a walk that dropped
//! or doubled a piece would still satisfy containment while making every
//! diagnostic offset in that region wrong.
//!
//! # The adoption
//!
//! Parsing is relative to adoption data, and the corpus's own
//! `corpus-adoption.toml` is the ruled instance — embedded rather than read
//! at runtime so the target has no working-directory dependency, and built
//! once and shared across iterations as the sibling crate's registry target
//! does. The path handed in is a Markdown path the partition owns, so the
//! run takes the frontend's real configuration and not a degenerate one.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::frontend::Parsed;
use cogra_linter::{Adoption, ByteSpan, Language, OwnerId, SourceFile, frontend_md};
use libfuzzer_sys::fuzz_target;

const ADOPTION: &str = include_str!("../../../../corpus-adoption.toml");

fn adoption() -> &'static Adoption {
    static ADOPTED: OnceLock<Adoption> = OnceLock::new();
    ADOPTED.get_or_init(|| {
        Adoption::from_str(ADOPTION, Path::new("corpus-adoption.toml"))
            .expect("the corpus's own ruled adoption data")
    })
}

fn within(span: ByteSpan, len: usize, which: &str) {
    assert!(
        span.start <= span.end && span.end <= len,
        "{which} must lie within the file: {span:?} not in 0..{len}"
    );
}

fn check(parsed: &Parsed, len: usize) {
    for region in &parsed.regions {
        let mut previous: Option<ByteSpan> = None;
        let mut covered = 0usize;
        for piece in &region.pieces {
            within(*piece, len, "a region piece");
            if let Some(last) = previous {
                assert!(
                    last.end <= piece.start,
                    "a region's pieces must ascend and not overlap: {last:?} then {piece:?}"
                );
            }
            previous = Some(*piece);
            covered += piece.end - piece.start;
        }

        assert_eq!(
            covered,
            region.text.len(),
            "the pieces must sum to the logical text's length: {:?}",
            region.pieces
        );

        for span in &region.spans {
            assert!(
                span.outer.start <= span.interior.start
                    && span.interior.start <= span.interior.end
                    && span.interior.end <= span.outer.end
                    && span.outer.end <= region.text.len(),
                "a delimited span must be well formed inside its region: {span:?}"
            );
            assert!(
                region.text.is_char_boundary(span.outer.start)
                    && region.text.is_char_boundary(span.outer.end)
                    && region.text.is_char_boundary(span.interior.start)
                    && region.text.is_char_boundary(span.interior.end),
                "a delimited span must fall on character boundaries: {span:?}"
            );
        }

        if !region.pieces.is_empty() {
            let whole = ByteSpan::new(0, region.text.len());
            within(region.locate(whole), len, "a located region span");
        }
    }

    for head in &parsed.heads {
        within(head.span, len, "a head");
    }
    for asset in &parsed.assets {
        within(asset.span, len, "an asset");
    }
    for table in &parsed.tables {
        within(table.span, len, "a table");
    }
    for one in &parsed.diagnostics {
        within(one.primary.span, len, "a diagnostic");
        for related in &one.related {
            assert!(
                related.at.span.start <= related.at.span.end,
                "a related location must not be inverted: {:?}",
                related.at.span
            );
        }
    }
}

fuzz_target!(|data: &[u8]| {
    let source = SourceFile {
        path: PathBuf::from("docs/fuzz.md"),
        owner: OwnerId::new("linter"),
        language: Some(Language::new("markdown")),
        generated: false,
        bytes: data.to_vec(),
    };

    match frontend_md::parse(&source, adoption()) {
        Ok(parsed) => check(&parsed, data.len()),
        Err(diagnostics) => {
            assert!(
                std::str::from_utf8(data).is_err(),
                "the whole file is lost only when it is not UTF-8: {diagnostics:?}"
            );
        }
    }
});
