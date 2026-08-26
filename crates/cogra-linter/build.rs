//! Compile the vendored Kotlin grammar's C into this crate.
//!
//! The grammar at `vendor/tree-sitter-kotlin/` ships its generated
//! `src/parser.c` committed, so this script compiles C and nothing else: it
//! runs no grammar toolchain, reaches no network, and would build the same
//! bytes on a machine that has never heard of the tree-sitter CLI. That is
//! the whole point of vendoring the generated parser
//! (ARCH dec:linter:kotlin-tree-sitter).
//!
//! The shape is the one tree-sitter's own generated bindings use: `cc` at
//! C11 with the grammar's `src` on the include path, because `parser.c`
//! includes `tree_sitter/parser.h` relative to it. `scanner.c` joins it —
//! this grammar has an external scanner carrying nesting block comments,
//! raw string bodies, and semicolon inference, and the parser links against
//! its five entry points.

use std::path::Path;

/// The grammar's C sources, relative to this package's own directory, which
/// is the directory Cargo runs a build script in.
const GRAMMAR: &str = "vendor/tree-sitter-kotlin/src";

fn main() {
    let src = Path::new(GRAMMAR);
    let parser = src.join("parser.c");
    let scanner = src.join("scanner.c");

    let mut build = cc::Build::new();
    build.std("c11").include(src);

    #[cfg(target_env = "msvc")]
    build.flag("-utf-8");

    build.file(&parser).file(&scanner);

    println!("cargo:rerun-if-changed={}", parser.display());
    println!("cargo:rerun-if-changed={}", scanner.display());

    build.compile("tree-sitter-kotlin");
}
