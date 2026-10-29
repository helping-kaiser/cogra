//! Reading `.env`: the documented overrides parse, and a line dotenvy
//! cannot parse is said out loud rather than silently ending the read.
//! No database, no server — dotenvy's parser and the startup log only.

use std::path::Path;
use std::sync::{Arc, Mutex};

use api::dotenv::DotenvRead;

/// The commented-out `DOCKER_COMPOSE` example in `.env.example`, as a
/// developer would uncomment it.
fn documented_override() -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.env.example");
    let example = std::fs::read_to_string(path).expect(".env.example is committed");
    example
        .lines()
        .find_map(|line| line.strip_prefix("# DOCKER_COMPOSE="))
        .map(|value| format!("DOCKER_COMPOSE={value}"))
        .expect(".env.example documents a DOCKER_COMPOSE override")
}

/// Every variable dotenvy yields from `source`, or the error it stops at —
/// read without touching the process environment.
fn parse(source: &str) -> Result<Vec<(String, String)>, dotenvy::Error> {
    dotenvy::from_read_iter(source.as_bytes()).collect()
}

/// The override the docs show is in the one form dotenvy reads, and the
/// lines after it are still read — the unquoted form of the same value
/// stops the read at that line.
///
/// The documented compose override parses, and the lines after it are read.
/// ´claim:dotenv:the-documented-override-parses´
#[test]
fn the_documented_override_parses() {
    let line = documented_override();
    let parsed = parse(&format!("{line}\nAFTER=read\n")).expect("the documented form parses");
    assert_eq!(parsed[0].0, "DOCKER_COMPOSE");
    assert!(
        parsed[0].1.starts_with("wsl.exe -d claude-podman ") && !parsed[0].1.contains('"'),
        "the value is the command, unquoted: {:?}",
        parsed[0].1
    );
    assert_eq!(parsed[1], ("AFTER".to_owned(), "read".to_owned()));

    let unquoted = line.replace('"', "");
    assert!(matches!(
        parse(&format!("{unquoted}\nAFTER=read\n")),
        Err(dotenvy::Error::LineParse(..))
    ));
}

/// A buffer the startup log writes into, read back by the test.
#[derive(Clone, Default)]
struct Captured(Arc<Mutex<Vec<u8>>>);

impl std::io::Write for Captured {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        self.0.lock().expect("log buffer").extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// A line dotenvy cannot parse surfaces in the startup log, naming the
/// line and the variable it stopped at and never the value — the line may
/// carry a secret. It surfaces under `EnvFilter`'s fallback, errors only,
/// because that is the filter a binary runs with when the read stopped
/// before `RUST_LOG`. A missing file, or a file read whole, stays silent.
///
/// A .env line dotenvy cannot parse is logged at startup by line and variable, never by value, even under the errors-only fallback filter.
/// ´claim:dotenv:an-unparsable-line-is-logged´
#[test]
fn an_unparsable_line_is_logged() {
    let captured = Captured::default();
    let sink = captured.clone();
    let subscriber = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::ERROR)
        .with_ansi(false)
        .with_writer(move || sink.clone())
        .finish();
    let _guard = tracing::subscriber::set_default(subscriber);

    let dir = tempfile::tempdir().expect("scratch directory");
    let file = dir.path().join(".env");
    let text = "WEB_ORIGIN=http://localhost:3000\n\
                SMTP_URL=smtps://user:hunter2 x@smtp.example.org\n\
                RUST_LOG=debug\n";
    std::fs::write(&file, text).expect("write .env");
    let stopped = DotenvRead {
        path: Some(file.clone()),
        result: parse(text).map(|_| ()),
    };
    assert!(
        stopped.result.is_err(),
        "an unquoted value with a space is refused"
    );
    stopped.report();

    DotenvRead {
        path: None,
        result: Err(dotenvy::Error::Io(std::io::ErrorKind::NotFound.into())),
    }
    .report();
    DotenvRead {
        path: Some(file),
        result: Ok(()),
    }
    .report();

    let log = String::from_utf8(captured.0.lock().expect("log buffer").clone()).expect("utf-8");
    assert_eq!(
        log.lines().count(),
        1,
        "one line, for the parse error only: {log}"
    );
    assert!(log.contains("ERROR"), "{log}");
    assert!(
        log.contains("line 2 (setting SMTP_URL)"),
        "names the line: {log}"
    );
    assert!(!log.contains("hunter2"), "never the value: {log}");
}
