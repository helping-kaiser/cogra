//! The Markdown frontend: blocks, code spans, headings, tables.
//!
//! `pulldown-cmark` is driven through [`Parser::into_offset_iter`], which
//! yields `(Event, Range<usize>)` pairs, so every event carries its byte
//! range in the source (´conv:lint:markdown-surface´). The mapping onto the
//! frontend contract is direct: a block-level element becomes one
//! [`Region`] whose pieces are its own event ranges with the formatting
//! structure resolved away, a fenced code block becomes a region that
//! participates in nothing wholesale, an inline code event becomes a
//! [`DelimitedSpan`], and a heading becomes a region of kind
//! [`RegionKind::Heading`] whose rung the format supplies.
//!
//! # Options
//!
//! The parser is constructed with [`Options::ENABLE_TABLES`] and nothing
//! else. The tables the registry-as-data path reads are a GitHub extension
//! and `Options::empty()` is CommonMark only; every other extension would
//! change what a region is, corpus-wide, for no discipline's benefit.
//!
//! # Verbatim text
//!
//! A region's logical text is the source's own bytes over the region's
//! pieces, assembled verbatim. CommonMark's own normalizations inside a
//! code span — one leading and trailing space removed, a line ending folded
//! to a space — are deliberately not applied to a span's interior: the
//! grammar admits no occurrence with spacing inside its delimiters
//! (´[LBL-gram:labels:well-formed]´), and
//! (´[LBL-inv:labels:total-resolution]´) asks for a warning where an author
//! nearly wrote one, which is what [`crate::scan::NearMissKind::InteriorSpacing`]
//! is. Assembling verbatim is also what makes [`Region::pieces`] exact, so
//! every span the scanner reports maps back to real file bytes.

use std::ops::Range;
use std::path::PathBuf;

use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};

use crate::adopt::{Adoption, Kind};
use crate::carrier::SourceFile;
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};
use crate::frontend::{Head, Parsed, Region, RegionKind, Table};
use crate::scan::{DelimitedSpan, Label, Syntax};

/// A Markdown source that is not UTF-8 at all, so no region of it exists.
pub const NOT_TEXT: RuleId = RuleId::new("markdown-not-utf8");

/// A backtick the format pairs with nothing.
///
/// In prose the backtick belongs to the document format, so no local
/// classification is available: an unpaired one leaves its block's spans
/// undefined and is a hard failure bounded by that block
/// (´[LBL-judg:labels:participation]´). The finding is the frontend's
/// because [`crate::scan::scan_prose`] never counts a backtick — it is
/// structurally unable to see what the format did not pair.
pub const UNPAIRED_BACKTICK: RuleId = RuleId::new("markdown-unpaired-backtick");

/// Every rule this module can report, for the diagnostic inventory.
pub const RULES: [RuleId; 2] = [NOT_TEXT, UNPAIRED_BACKTICK];

/// Markdown's own sectioning rung.
///
/// For a heading the head is the rung the format supplies and not the
/// heading's own text (´dec:lint:head-recognition´): the heading's text is
/// a title, classified by nothing. The rung's spelling is the one datum of
/// head recognition that `[head-recognition]` states in prose rather than
/// as a value, so it is spelled here and classified `sec` by the registry's
/// own structure table.
const RUNG: &str = "Section";

/// The identifier `[head-recognition]` gives the bold-run form.
const ENVIRONMENT_HEAD: &str = "environment-head";

/// The identifier `[head-recognition]` gives the heading form.
const HEADING: &str = "heading";

/// The language token `[scanned-regions]` gives this format.
pub(crate) const MARKDOWN: &str = "markdown";

/// Parse one Markdown source.
///
/// ```
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
/// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
/// # let adoption = cogra_linter::Adoption::from_str(
/// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
/// use cogra_linter::frontend::RegionKind;
/// use cogra_linter::{Language, OwnerId, SourceFile, frontend_md};
///
/// let source = SourceFile {
///     path: std::path::PathBuf::from("x.md"),
///     owner: OwnerId::new("linter"),
///     language: Some(Language::new("markdown")),
///     generated: false,
///     bytes: Vec::from("## Syntax \u{b7} `sec:kinds:syntax`\n"),
/// };
/// let parsed = frontend_md::parse(&source, &adoption).map_err(|d| format!("{d:?}"))?;
/// assert_eq!(parsed.regions[0].kind, RegionKind::Heading);
/// assert_eq!(parsed.heads[0].text, "Section");
/// assert_eq!(parsed.heads[0].declared.as_str(), "sec");
/// # Ok(())
/// # }
/// ```
///
/// # Errors
///
/// One diagnostic when the source is not UTF-8, which is the only defect
/// that costs the whole file. Everything the format bounds to one block —
/// an unpaired backtick above all — travels in [`Parsed::diagnostics`]
/// beside the regions that did parse (´crit:lint:error-or-finding´).
pub fn parse(src: &SourceFile, a: &Adoption) -> Result<Parsed, Vec<Diagnostic>> {
    let enforcement = a.enforcement.enforcement_for(&src.path);
    let Ok(text) = std::str::from_utf8(&src.bytes) else {
        return Err(vec![Diagnostic {
            rule: NOT_TEXT,
            severity: Severity::Error,
            enforcement,
            primary: Location::new(src.path.clone(), ByteSpan::new(0, 0), 1, 1),
            related: Vec::new(),
            message: String::from("the source is not UTF-8, so no region of it can be read"),
        }]);
    };
    let mut walker = Walker::new(src, a, text, enforcement);
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    for (event, range) in Parser::new_ext(text, options).into_offset_iter() {
        walker.step(&event, range);
    }
    Ok(walker.finish())
}

/// The document's tables, as its cells' regions spell them.
///
/// The registry's classification relation is read from the registry
/// document's own Convention tables rather than transcribed
/// (´[ARCH-dec:linter:registry-as-data]´); this is the door it comes
/// through.
#[must_use]
pub fn tables(parsed: &Parsed) -> Vec<Table> {
    parsed.tables.clone()
}

/// Whether a bold run has opened the block, and where its text ended.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
enum Strong {
    /// No bold run opened this block.
    Absent,
    /// One is open, at this nesting depth — a bold run inside a bold run
    /// closes the inner one, not the head.
    Open(usize),
    /// One opened the block and closed at this offset of the region text.
    Closed(usize),
}

/// One open block, accumulating its logical text.
struct Frame {
    /// Where the block opened in the document, which is the order its
    /// region is reported in. Blocks close innermost-first — a nested list
    /// item closes before the item holding it — so closing order is not
    /// document order and the two are kept apart here.
    order: usize,
    kind: RegionKind,
    participates: bool,
    /// Whether the block is taken whole rather than assembled from its
    /// leaves: a code block and an HTML block are their own bytes, fences
    /// and tags included.
    verbatim: bool,
    text: String,
    pieces: Vec<ByteSpan>,
    spans: Vec<DelimitedSpan>,
    strong: Strong,
}

impl Frame {
    fn new(order: usize, kind: RegionKind, participates: bool, verbatim: bool) -> Frame {
        Frame {
            order,
            kind,
            participates,
            verbatim,
            text: String::new(),
            pieces: Vec::new(),
            spans: Vec::new(),
            strong: Strong::Absent,
        }
    }

    /// Copy one file range onto the logical text, returning where it landed.
    ///
    /// Adjacent ranges merge, so a paragraph with no structure inside it
    /// ends up with one piece and a quotation with its markers resolved
    /// away ends up with one piece per line.
    fn append(&mut self, src: &str, range: &Range<usize>) -> usize {
        let start = self.text.len();
        let Some(slice) = src.get(range.start..range.end) else {
            return start;
        };
        self.text.push_str(slice);
        match self.pieces.last_mut() {
            Some(last) if last.end == range.start => last.end = range.end,
            _ => self.pieces.push(ByteSpan::new(range.start, range.end)),
        }
        start
    }
}

/// One table, accumulating its cells.
struct TableBuild {
    span: ByteSpan,
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    row: Vec<String>,
    heading: bool,
}

/// The walk over one document's events.
struct Walker<'a> {
    src: &'a str,
    path: PathBuf,
    generated: bool,
    enforcement: Enforcement,
    separator: &'a str,
    bold_form: bool,
    heading_form: bool,
    frames: Vec<Frame>,
    tables: Vec<TableBuild>,
    /// Regions and heads keyed by the order their blocks opened, sorted
    /// into document order once the walk is done.
    regions: Vec<(usize, Region)>,
    heads: Vec<(usize, Head)>,
    opened: usize,
    out: Parsed,
}

impl<'a> Walker<'a> {
    fn new(
        src: &SourceFile,
        a: &'a Adoption,
        text: &'a str,
        enforcement: Enforcement,
    ) -> Walker<'a> {
        Walker {
            src: text,
            path: src.path.clone(),
            generated: src.generated,
            enforcement,
            separator: &a.head_recognition.separator,
            bold_form: has_form(a, ENVIRONMENT_HEAD),
            heading_form: has_form(a, HEADING),
            frames: Vec::new(),
            tables: Vec::new(),
            regions: Vec::new(),
            heads: Vec::new(),
            opened: 0,
            out: Parsed {
                path: src.path.clone(),
                ..Parsed::default()
            },
        }
    }

    fn finish(mut self) -> Parsed {
        while !self.frames.is_empty() {
            self.pop();
        }
        self.regions.sort_by_key(|(order, _)| *order);
        self.heads.sort_by_key(|(order, _)| *order);
        self.out.regions = self.regions.into_iter().map(|(_, one)| one).collect();
        self.out.heads = self.heads.into_iter().map(|(_, one)| one).collect();
        self.out.diagnostics.sort();
        self.out
    }

    fn step(&mut self, event: &Event<'_>, range: Range<usize>) {
        match event {
            Event::Start(tag) => self.start(tag, range),
            Event::End(tag) => self.end(*tag),
            Event::Code(_) => self.code(&range),
            Event::Text(_)
            | Event::Html(_)
            | Event::InlineHtml(_)
            | Event::SoftBreak
            | Event::HardBreak
            | Event::FootnoteReference(_)
            | Event::InlineMath(_)
            | Event::DisplayMath(_) => self.leaf(&range),
            Event::Rule | Event::TaskListMarker(_) => {}
        }
    }

    fn start(&mut self, tag: &Tag<'_>, range: Range<usize>) {
        match tag {
            Tag::Paragraph | Tag::Item => self.push(RegionKind::Prose, true, false, &range),
            Tag::Heading { .. } => self.push(RegionKind::Heading, true, false, &range),
            Tag::TableCell => self.push(RegionKind::TableRow, true, false, &range),
            Tag::CodeBlock(_) | Tag::HtmlBlock => {
                self.push(RegionKind::Prose, false, true, &range);
            }
            Tag::Table(_) => self.tables.push(TableBuild {
                span: ByteSpan::new(range.start, range.end),
                headers: Vec::new(),
                rows: Vec::new(),
                row: Vec::new(),
                heading: false,
            }),
            Tag::TableHead | Tag::TableRow => {
                if let Some(table) = self.tables.last_mut() {
                    table.heading = matches!(tag, Tag::TableHead);
                    table.row.clear();
                }
            }
            Tag::Strong => {
                if let Some(frame) = self.frames.last_mut() {
                    frame.strong = match frame.strong {
                        Strong::Absent if frame.text.is_empty() => Strong::Open(1),
                        Strong::Open(depth) => Strong::Open(depth + 1),
                        other => other,
                    };
                }
            }
            _ => {}
        }
    }

    fn end(&mut self, tag: TagEnd) {
        match tag {
            TagEnd::Paragraph
            | TagEnd::Heading(_)
            | TagEnd::Item
            | TagEnd::CodeBlock
            | TagEnd::HtmlBlock => {
                self.pop();
            }
            TagEnd::TableCell => {
                let text = self.pop();
                if let Some(table) = self.tables.last_mut() {
                    table.row.push(text.trim().to_owned());
                }
            }
            TagEnd::TableHead | TagEnd::TableRow => {
                if let Some(table) = self.tables.last_mut() {
                    let row = std::mem::take(&mut table.row);
                    if table.heading {
                        table.headers = row;
                    } else {
                        table.rows.push(row);
                    }
                }
            }
            TagEnd::Table => {
                if let Some(table) = self.tables.pop() {
                    self.out.tables.push(Table {
                        headers: table.headers,
                        rows: table.rows,
                        span: table.span,
                    });
                }
            }
            TagEnd::Strong => {
                if let Some(frame) = self.frames.last_mut() {
                    frame.strong = match frame.strong {
                        Strong::Open(1) => Strong::Closed(frame.text.len()),
                        Strong::Open(depth) => Strong::Open(depth - 1),
                        other => other,
                    };
                }
            }
            _ => {}
        }
    }

    fn push(&mut self, kind: RegionKind, participates: bool, verbatim: bool, range: &Range<usize>) {
        let src = self.src;
        self.opened += 1;
        let mut frame = Frame::new(self.opened, kind, participates, verbatim);
        if verbatim {
            frame.append(src, range);
        }
        self.frames.push(frame);
    }

    fn leaf(&mut self, range: &Range<usize>) {
        let src = self.src;
        if let Some(frame) = self.frames.last_mut()
            && !frame.verbatim
        {
            frame.append(src, range);
        }
    }

    /// One inline code event, as a delimited span.
    ///
    /// The `displayed` flag is decided by counting the backtick run at the
    /// span's own offset — a bounded byte count at a known position, and
    /// the one place the frontend consults raw bytes on the prose path
    /// (´conv:lint:markdown-surface´). It is bounded because the format has
    /// already told us where the span starts and ends; nothing scans for a
    /// delimiter.
    fn code(&mut self, range: &Range<usize>) {
        let src = self.src;
        let run = run_len(src.as_bytes(), range.start);
        let close = close_len(src.as_bytes(), range.end, run);
        let Some(frame) = self.frames.last_mut() else {
            return;
        };
        if frame.verbatim {
            return;
        }
        let start = frame.append(src, range);
        let end = start + (range.end - range.start);
        let interior_start = (start + run).min(end);
        let interior_end = end.saturating_sub(close).max(interior_start);
        frame.spans.push(DelimitedSpan {
            outer: ByteSpan::new(start, end),
            interior: ByteSpan::new(interior_start, interior_end),
            displayed: run >= 2,
        });
    }

    /// Close the innermost frame, emitting its region, and answer with its
    /// text so a table cell can record it.
    fn pop(&mut self) -> String {
        let Some(frame) = self.frames.pop() else {
            return String::new();
        };
        let text = frame.text.clone();
        if frame.pieces.is_empty() {
            return text;
        }
        let mut region = Region {
            kind: frame.kind,
            text: frame.text,
            pieces: frame.pieces,
            syntax: Syntax::Prose,
            participates: frame.participates,
            generated: self.generated,
            spans: frame.spans,
        };
        if region.participates {
            self.unpaired(&mut region);
            self.head(frame.order, &region, frame.strong);
        }
        self.regions.push((frame.order, region));
        text
    }

    /// Fail a block on the first backtick the format paired with nothing.
    ///
    /// A backtick inside a delimited span is the format's own and is
    /// skipped; a backslash-escaped one is the author's literal, and it is
    /// recognized by the file byte before it rather than by the logical
    /// text, where the backslash has already been resolved away.
    fn unpaired(&mut self, region: &mut Region) {
        let bytes = region.text.as_bytes();
        let mut span = 0;
        let mut i = 0;
        let mut found = None;
        while i < bytes.len() {
            while span < region.spans.len() && region.spans[span].outer.end <= i {
                span += 1;
            }
            if let Some(here) = region.spans.get(span)
                && here.outer.start <= i
            {
                i = here.outer.end.max(i + 1);
                continue;
            }
            if bytes[i] == b'`' {
                let at = region.locate(ByteSpan::new(i, i + 1));
                if !self.escaped(at.start) {
                    found = Some(at);
                    break;
                }
            }
            i += 1;
        }
        let Some(at) = found else {
            return;
        };
        region.spans.clear();
        let finding = self.finding(
            UNPAIRED_BACKTICK,
            at,
            "an unpaired backtick leaves this block's spans undefined",
        );
        self.out.diagnostics.push(finding);
    }

    fn escaped(&self, at: usize) -> bool {
        at > 0 && self.src.as_bytes().get(at - 1) == Some(&b'\\')
    }

    /// Read this region's environment head, where it has one.
    ///
    /// Two forms, both `[head-recognition]`'s: a bold run opening a block,
    /// of the shape `Kind (Title)`, whose head is the text up to the
    /// opening parenthesis — the Title names this instance and handing it
    /// to the registry would ask it to classify a proper noun; and a
    /// heading, whose head is the rung the format supplies. Both are closed
    /// by the separator and the mint, and the mint is what declares the
    /// kind (´dec:lint:head-recognition´).
    fn head(&mut self, order: usize, region: &Region, strong: Strong) {
        let found = match region.kind {
            RegionKind::Heading if self.heading_form => {
                Some((String::from(RUNG), region.span(), 0))
            }
            RegionKind::Prose if self.bold_form => self.bold_head(region, strong),
            _ => None,
        };
        let Some((text, span, after)) = found else {
            return;
        };
        let Some(declared) = self.declared(region, after) else {
            return;
        };
        self.heads.push((
            order,
            Head {
                text,
                declared,
                span,
            },
        ));
    }

    /// The bold form's head, its span, and where the run ended.
    ///
    /// A bold run carrying no parenthesis is not a head.
    fn bold_head(&self, region: &Region, strong: Strong) -> Option<(String, ByteSpan, usize)> {
        let Strong::Closed(end) = strong else {
            return None;
        };
        let run = region.text.get(..end)?;
        let raw = run.get(..run.find('(')?)?;
        let head = raw.trim();
        if head.is_empty() {
            return None;
        }
        let lead = raw.len() - raw.trim_start().len();
        let span = region.locate(ByteSpan::new(lead, lead + head.len()));
        Some((head.to_owned(), span, end))
    }

    /// The kind a head's own mint declares.
    ///
    /// The mint is the first bare, undisplayed span after the separator
    /// whose interior parses as a label. A head whose mint is missing or
    /// unreadable forms no head value: what declares the kind is gone, and
    /// the region stays an ordinary one.
    fn declared(&self, region: &Region, after: usize) -> Option<Kind> {
        let tail = region.text.get(after..)?;
        let separator = after + tail.find(self.separator)? + self.separator.len();
        let span = region.spans.iter().find(|span| {
            span.outer.start >= separator
                && !span.displayed
                && !region
                    .text
                    .get(..span.outer.start)
                    .is_some_and(|head| head.ends_with('('))
        })?;
        let interior = region.text.get(span.interior.start..span.interior.end)?;
        Label::parse(interior).ok().map(|l| Kind::new(l.kind()))
    }

    fn finding(&self, rule: RuleId, at: ByteSpan, message: &str) -> Diagnostic {
        Diagnostic {
            rule,
            severity: Severity::Error,
            enforcement: self.enforcement,
            primary: Location::in_source(self.path.clone(), at, self.src),
            related: Vec::new(),
            message: String::from(message),
        }
    }
}

fn has_form(a: &Adoption, id: &str) -> bool {
    a.head_recognition
        .forms
        .iter()
        .any(|form| form.language.as_str() == MARKDOWN && &*form.id == id)
}

/// How many backticks the run at `at` holds.
fn run_len(bytes: &[u8], at: usize) -> usize {
    bytes
        .get(at..)
        .map_or(0, |tail| tail.iter().take_while(|b| **b == b'`').count())
}

/// How many backticks close a span ending at `end`, capped at the run that
/// opened it.
fn close_len(bytes: &[u8], end: usize, run: usize) -> usize {
    bytes.get(..end).map_or(0, |head| {
        head.iter()
            .rev()
            .take_while(|b| **b == b'`')
            .count()
            .min(run)
    })
}
