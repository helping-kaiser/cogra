#![no_main]
//! `scan_region` — arbitrary text into [`scan_prose`] and [`scan_code`],
//! asserting no panic and that every reported span lies within the input
//! (´preview:lint:fuzz-plan´, design.md).
//!
//! # The span sets
//!
//! [`scan_prose`] takes the format's own delimited spans from the frontend,
//! so a target that fed it nothing would exercise only the empty case. The
//! plan asks for spans consistent with the text; the scheme is derived from
//! the text rather than drawn from the mutator, because a span set drawn
//! independently of the bytes would mostly be rejected before reaching the
//! scanner and the campaign would report coverage it does not have.
//!
//! Three sets run against every input, in whole-file coordinates fixed by
//! `base`:
//!
//! - `paired` — backtick runs paired left to right, the interior between
//!   them, `displayed` set for a run of two or more. This is the frontend's
//!   own contract restated over arbitrary text, and it is the set that
//!   reaches the scanner's body.
//! - `boundaries` — spans over consecutive character boundaries, capped, so
//!   that interiors the backtick pairing never produces are still read.
//! - `malformed` — inverted, out-of-range, and mid-character spans, which
//!   `well_formed` is contractually required to drop. A panic here is a
//!   breach of that guard, not a misuse of the API.
//!
//! # The bound
//!
//! Every span the scanner reports is in whole-file coordinates, so the bound
//! is `base ..= base + text.len()`. Two bases run: zero, and an offset large
//! enough that a dropped or doubled `base` separates from the zero case.

use cogra_linter::scan::{DelimitedSpan, NearMissKind, RegionScan, scan_code, scan_prose};
use cogra_linter::ByteSpan;
use libfuzzer_sys::fuzz_target;

const OFFSET: usize = 4096;
const CAP: usize = 64;

fn paired(text: &str) -> Vec<DelimitedSpan> {
    let bytes = text.as_bytes();
    let mut runs = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'`' {
            let start = i;
            while i < bytes.len() && bytes[i] == b'`' {
                i += 1;
            }
            runs.push((start, i));
        } else {
            i += 1;
        }
    }

    let mut spans = Vec::new();
    for pair in runs.chunks_exact(2) {
        let (open_start, open_end) = pair[0];
        let (close_start, close_end) = pair[1];
        spans.push(DelimitedSpan {
            outer: ByteSpan::new(open_start, close_end),
            interior: ByteSpan::new(open_end, close_start),
            displayed: open_end - open_start >= 2,
        });
    }
    spans
}

fn boundaries(text: &str) -> Vec<DelimitedSpan> {
    let mut at: Vec<usize> = (0..=text.len())
        .filter(|&i| text.is_char_boundary(i))
        .collect();
    at.truncate(CAP + 1);

    at.windows(2)
        .map(|w| DelimitedSpan {
            outer: ByteSpan::new(w[0], w[1]),
            interior: ByteSpan::new(w[0], w[1]),
            displayed: false,
        })
        .collect()
}

fn malformed(text: &str) -> Vec<DelimitedSpan> {
    let len = text.len();
    vec![
        DelimitedSpan {
            outer: ByteSpan::new(len, 0),
            interior: ByteSpan::new(len, 0),
            displayed: false,
        },
        DelimitedSpan {
            outer: ByteSpan::new(0, len + 1),
            interior: ByteSpan::new(0, len + 1),
            displayed: false,
        },
        DelimitedSpan {
            outer: ByteSpan::new(0, len),
            interior: ByteSpan::new(len, 0),
            displayed: false,
        },
        DelimitedSpan {
            outer: ByteSpan::new(1, len.saturating_sub(1)),
            interior: ByteSpan::new(1, len.saturating_sub(1)),
            displayed: true,
        },
        DelimitedSpan {
            outer: ByteSpan::new(usize::MAX, usize::MAX),
            interior: ByteSpan::new(usize::MAX, usize::MAX),
            displayed: false,
        },
    ]
}

fn within(span: ByteSpan, base: usize, len: usize, which: &str) {
    let end = base + len;
    assert!(
        span.start >= base && span.start <= span.end && span.end <= end,
        "a reported span must lie within the input ({which}): {span:?} not in {base}..{end}"
    );
}

fn at_within(offset: usize, base: usize, len: usize, which: &str) {
    let end = base + len;
    assert!(
        offset >= base && offset <= end,
        "a reported position must lie within the input ({which}): {offset} not in {base}..{end}"
    );
}

fn check(scan: &RegionScan, base: usize, len: usize, which: &str) {
    for one in &scan.occurrences {
        within(one.span(), base, len, which);
        let label = one.label();
        assert!(
            !label.kind().is_empty() && !label.area().is_empty() && !label.name().is_empty(),
            "an occurrence's label must have three non-empty words ({which}): {label:?}"
        );
    }

    for miss in &scan.near_misses {
        within(miss.span, base, len, which);
        match miss.why {
            NearMissKind::WrongCase { at } | NearMissKind::InteriorSpacing { at } => {
                at_within(at, base, len, which);
            }
            NearMissKind::SeveralToOneParenthesis { count } => {
                assert!(count > 1, "several-to-one must count more than one ({which})");
            }
            _ => {}
        }
    }

    assert!(
        scan.near_misses
            .windows(2)
            .all(|w| (w[0].span.start, w[0].span.end) <= (w[1].span.start, w[1].span.end)),
        "near-misses must be ordered by span ({which})"
    );

    if let Some(failure) = scan.delimiter_failure {
        at_within(failure.at, base, len, which);
    }
}

fuzz_target!(|data: &[u8]| {
    let Ok(text) = std::str::from_utf8(data) else {
        return;
    };

    for base in [0, OFFSET] {
        check(&scan_code(text, base), base, text.len(), "code");

        let sets: [(&str, Vec<DelimitedSpan>); 3] = [
            ("prose/paired", paired(text)),
            ("prose/boundaries", boundaries(text)),
            ("prose/malformed", malformed(text)),
        ];
        for (which, spans) in &sets {
            check(&scan_prose(text, base, spans), base, text.len(), which);
        }

        let mut all: Vec<DelimitedSpan> = sets.iter().flat_map(|(_, s)| s.iter().copied()).collect();
        all.sort_unstable_by_key(|s| (s.outer.start, s.outer.end));
        check(&scan_prose(text, base, &all), base, text.len(), "prose/all");
    }

    assert!(
        scan_code(text, 0).occurrences.len() == scan_code(text, OFFSET).occurrences.len(),
        "the base offset must not change what is found"
    );
});
