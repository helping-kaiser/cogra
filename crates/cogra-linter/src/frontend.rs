//! The shared frontend contract: what every frontend produces, and the
//! dispatcher that picks one.
//!
//! A frontend turns one carrier source into logical regions, environment
//! heads, and covered assets (´sig:lint:frontend-api´). The *data* contract
//! is real and lives here; the *behavior* contract is one `match`, because a
//! trait exists to admit implementations its author does not know and the
//! frontends are four, all in this crate (´dec:lint:frontend-dispatch´).
//!
//! # Coordinates
//!
//! A region's [`Region::text`] is logical text with the source's own
//! structure resolved away, so it is not a run of file bytes
//! (´[LBL-gram:labels:well-formed]´). [`Region::pieces`] records the file
//! ranges it was assembled from, in order, and [`Region::locate`] maps a
//! region-local span back into the file — which is how a scan of the logical
//! text produces a diagnostic that points into the source.

use std::path::PathBuf;

use crate::adopt::{Adoption, Area, Kind, Place, ProfileId};
use crate::carrier::SourceFile;
use crate::diag::{ByteSpan, Diagnostic};
use crate::pretokenize::CommentForm;
use crate::scan::{DelimitedSpan, Syntax};

/// What kind of logical region a frontend produced.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum RegionKind {
    /// A block-level element of prose.
    Prose,
    /// A heading, whose rung the format supplies.
    Heading,
    /// A comment, in the form the language gives it.
    Comment(CommentForm),
    /// Table material: one cell of one row.
    TableRow,
}

/// One logical region: the unit the span scanner receives
/// (´sig:lint:frontend-api´).
///
/// ```
/// use cogra_linter::ByteSpan;
/// use cogra_linter::frontend::{Region, RegionKind};
/// use cogra_linter::scan::Syntax;
///
/// let region = Region {
///     kind: RegionKind::Prose,
///     text: String::from("one\ntwo"),
///     pieces: vec![ByteSpan::new(2, 6), ByteSpan::new(8, 11)],
///     syntax: Syntax::Prose,
///     participates: true,
///     generated: false,
///     spans: Vec::new(),
/// };
/// assert_eq!(region.locate(ByteSpan::new(4, 7)), ByteSpan::new(8, 11));
/// assert_eq!(region.span(), ByteSpan::new(2, 11));
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Region {
    /// Which kind of region it is.
    pub kind: RegionKind,
    /// The region's own logical text, structure resolved away.
    pub text: String,
    /// The file ranges the logical text was assembled from, in order. Their
    /// lengths sum to the length of [`Region::text`]: a piece is copied
    /// verbatim, never transformed, which is what makes
    /// [`Region::locate`] exact.
    pub pieces: Vec<ByteSpan>,
    /// Which concrete syntax the region carries.
    pub syntax: Syntax,
    /// Whether its occurrences participate (´[LBL-judg:labels:participation]´).
    pub participates: bool,
    /// Whether it is generated.
    pub generated: bool,
    /// For prose regions: the format's own delimited spans, already paired.
    /// Both offsets of each span index [`Region::text`].
    pub spans: Vec<DelimitedSpan>,
}

impl Region {
    /// The file span enclosing a region-local span.
    ///
    /// A logical span may cross a piece boundary — a wrapped occurrence, a
    /// quotation whose markers were resolved away — and the file range
    /// between its ends then covers structure the logical text does not
    /// hold. That range is what a diagnostic points at: the whole of what
    /// the author wrote, markers included.
    #[must_use]
    pub fn locate(&self, local: ByteSpan) -> ByteSpan {
        ByteSpan::new(self.at(local.start, false), self.at(local.end, true))
    }

    /// The file span enclosing the whole region.
    #[must_use]
    pub fn span(&self) -> ByteSpan {
        match (self.pieces.first(), self.pieces.last()) {
            (Some(first), Some(last)) => ByteSpan::new(first.start, last.end),
            _ => ByteSpan::new(0, 0),
        }
    }

    /// One region-local offset in file coordinates.
    ///
    /// `closing` decides what an offset sitting exactly on a piece boundary
    /// means: the end of the earlier piece for a span's end, the start of
    /// the later one for a span's start. An offset past the logical text
    /// lands at the last piece's end.
    fn at(&self, offset: usize, closing: bool) -> usize {
        let mut consumed = 0;
        for piece in &self.pieces {
            let next = consumed + piece.len();
            let inside = if closing {
                offset <= next
            } else {
                offset < next
            };
            if inside {
                return piece.start + (offset - consumed);
            }
            consumed = next;
        }
        self.pieces.last().map_or(0, |last| last.end)
    }
}

/// A participating authored environment head, with the kind its label
/// declares (´[KND-judg:kinds:head-validation]´).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Head {
    /// The head text the registry classifies — the genre's name, never the
    /// instance's title (´dec:lint:head-recognition´).
    pub text: String,
    /// The kind the head's own mint declares.
    pub declared: Kind,
    /// Where the head sits, in whole-file coordinates.
    pub span: ByteSpan,
}

/// A covered asset of one profile's census, as the language exposes it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Asset {
    /// The profile whose census covers it.
    pub profile: ProfileId,
    /// Its bare identifier, as the language exposes it.
    pub identifier: String,
    /// The classification the profile's rule read off it.
    pub area: Area,
    /// Where the profile's standard place puts its label.
    pub place: Place,
    /// Where the asset sits, in whole-file coordinates.
    pub span: ByteSpan,
}

/// One table of a document, as its cells' regions spell it.
///
/// The cell texts are the regions' own logical text, so a cell holding a
/// code span holds it with its delimiters: the table is the document's
/// bytes, not an interpretation of them. Reading a kind token out of one is
/// the registry parser's affair (´sig:lint:kind-registry-api´).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Table {
    /// The header row's cells.
    pub headers: Vec<String>,
    /// The body rows, each a row of cells.
    pub rows: Vec<Vec<String>>,
    /// The whole table, in whole-file coordinates.
    pub span: ByteSpan,
}

/// What one frontend produced from one source.
///
/// The findings travel beside the regions and are never traded for them: an
/// unpaired backtick fails its block and the rest of the file resolves
/// normally (´[LBL-judg:labels:participation]´), which is the same shape
/// [`crate::carrier::WalkOutcome`] gives a traversal failure.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Parsed {
    /// The source this came from, relative to the corpus root.
    pub path: PathBuf,
    /// Its logical regions, in document order.
    pub regions: Vec<Region>,
    /// Its participating authored heads, in document order.
    pub heads: Vec<Head>,
    /// The covered assets of every effective profile's census.
    pub assets: Vec<Asset>,
    /// Its tables, in document order. Empty for a format with no tables.
    pub tables: Vec<Table>,
    /// What the frontend found wrong, each bounded as its discipline bounds
    /// it.
    pub diagnostics: Vec<Diagnostic>,
}

/// Parse one source with the frontend its language names.
///
/// A language with no frontend yields an empty [`Parsed`]: its files stay in
/// the carrier and stay owned, carrying no occurrences
/// (´[LBL-judg:labels:minting]´).
///
/// # Errors
///
/// One or more diagnostics whenever the source cannot be parsed at all — a
/// Markdown file that is not UTF-8, say. A defect the format bounds to one
/// block is not such a failure: it travels in [`Parsed::diagnostics`] beside
/// the regions that did parse.
pub fn parse(src: &SourceFile, a: &Adoption) -> Result<Parsed, Vec<Diagnostic>> {
    match src.language.as_ref().map(crate::adopt::Language::as_str) {
        Some(crate::frontend_md::MARKDOWN) => crate::frontend_md::parse(src, a),
        _ => Ok(Parsed {
            path: src.path.clone(),
            ..Parsed::default()
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn region(pieces: Vec<ByteSpan>, text: &str) -> Region {
        Region {
            kind: RegionKind::Prose,
            text: String::from(text),
            pieces,
            syntax: Syntax::Prose,
            participates: true,
            generated: false,
            spans: Vec::new(),
        }
    }

    #[test]
    fn a_contiguous_region_locates_by_addition() {
        let one = region(vec![ByteSpan::new(10, 20)], "0123456789");
        assert_eq!(one.locate(ByteSpan::new(2, 5)), ByteSpan::new(12, 15));
    }

    #[test]
    fn a_span_crossing_a_piece_boundary_covers_the_structure_between() {
        let one = region(vec![ByteSpan::new(0, 3), ByteSpan::new(9, 12)], "abcdef");
        assert_eq!(one.locate(ByteSpan::new(1, 5)), ByteSpan::new(1, 11));
    }

    #[test]
    fn an_offset_on_a_boundary_belongs_to_the_piece_it_faces() {
        let one = region(vec![ByteSpan::new(0, 3), ByteSpan::new(9, 12)], "abcdef");
        assert_eq!(one.locate(ByteSpan::new(3, 3)), ByteSpan::new(9, 3));
        assert_eq!(one.locate(ByteSpan::new(0, 3)), ByteSpan::new(0, 3));
        assert_eq!(one.locate(ByteSpan::new(3, 6)), ByteSpan::new(9, 12));
    }

    #[test]
    fn an_offset_past_the_text_lands_at_the_last_piece() {
        let one = region(vec![ByteSpan::new(4, 7)], "abc");
        assert_eq!(one.locate(ByteSpan::new(90, 90)), ByteSpan::new(7, 7));
    }

    #[test]
    fn a_region_with_no_pieces_spans_nothing() {
        let one = region(Vec::new(), "");
        assert_eq!(one.span(), ByteSpan::new(0, 0));
        assert_eq!(one.locate(ByteSpan::new(0, 1)), ByteSpan::new(0, 0));
    }
}
