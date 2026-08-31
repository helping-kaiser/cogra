//! The gate clause of (´dec:lint:syn-spans´): a known byte range, read out
//! of a `syn` span, before any Rust-frontend code rests on it.
//!
//! Every located Rust diagnostic the crate will ever emit rests on this one
//! API, and a `proc-macro2` built without `span-locations` does not produce
//! wrong offsets loudly — it produces zero-width ones quietly. So the
//! assertions here are literal offsets *and* the text those offsets cut out
//! of the fixture, and each one asserts the range is not empty.
//!
//! The accuracy caveat the API carries is about procedural macros: inside
//! one the range is accurate only on nightly. Outside one — a binary
//! parsing files, which is what the linter is — the documentation states
//! the range is always accurate regardless of toolchain (docs.rs,
//! proc-macro2 1.0.107, verified 2026-08-25).

use syn::spanned::Spanned;

/// Two items and one documentation comment, at offsets counted by hand.
///
/// Line 1 is `0..30`, its newline at `30`; `struct Documented;` is `31..49`;
/// the blank line's newline is at `50`; `struct Plain;` is `51..64`.
const FIXTURE: &str = "/// One line of documentation.\nstruct Documented;\n\nstruct Plain;\n";

/// The whole fixture, so a reader can check the hand-counted offsets.
fn at(range: std::ops::Range<usize>) -> &'static str {
    &FIXTURE[range]
}

/// An item span is the item's own byte range, and never empty.
/// ´claim:spans:an-item-span-is-its-own-byte-range´
#[test]
fn an_item_span_is_the_item_s_own_byte_range() -> Result<(), syn::Error> {
    let file = syn::parse_file(FIXTURE)?;
    let second = file.items.get(1).ok_or_else(|| {
        syn::Error::new(proc_macro2::Span::call_site(), "the fixture lost an item")
    })?;
    let range = second.span().byte_range();
    assert!(
        !range.is_empty(),
        "a zero-width range means span-locations is off"
    );
    assert_eq!(range, 51..64);
    assert_eq!(at(range), "struct Plain;");
    Ok(())
}

/// An identifier's span covers the identifier and nothing around it.
/// ´claim:spans:an-identifier-span-is-the-identifier-alone´
#[test]
fn an_identifier_span_is_the_identifier_alone() -> Result<(), syn::Error> {
    let file = syn::parse_file(FIXTURE)?;
    let syn::Item::Struct(first) = &file.items[0] else {
        panic!("the fixture's first item is a struct");
    };
    let range = first.ident.span().byte_range();
    assert_eq!(range, 38..48);
    assert_eq!(at(range), "Documented");
    Ok(())
}

/// A documentation comment's span is the line it was written on.
/// ´claim:spans:a-doc-comment-span-is-its-own-line´
#[test]
fn a_documentation_comment_carries_the_span_of_its_own_line() -> Result<(), syn::Error> {
    let file = syn::parse_file(FIXTURE)?;
    let syn::Item::Struct(first) = &file.items[0] else {
        panic!("the fixture's first item is a struct");
    };
    let doc = first
        .attrs
        .first()
        .ok_or_else(|| syn::Error::new(first.ident.span(), "the fixture lost its doc comment"))?;
    assert!(
        doc.path().is_ident("doc"),
        "a `///` line parses as a doc attribute"
    );
    let range = doc.span().byte_range();
    assert!(
        !range.is_empty(),
        "a zero-width range means span-locations is off"
    );
    assert_eq!(range, 0..30);
    assert_eq!(at(range), "/// One line of documentation.");
    Ok(())
}

/// Two items of one file occupy disjoint byte ranges.
/// ´claim:spans:two-item-ranges-are-disjoint´
#[test]
fn the_ranges_of_two_items_do_not_overlap() -> Result<(), syn::Error> {
    let file = syn::parse_file(FIXTURE)?;
    let first = file.items[0].span().byte_range();
    let second = file.items[1].span().byte_range();
    assert!(
        first.end <= second.start,
        "item ranges run forward: {first:?} then {second:?}"
    );
    Ok(())
}
