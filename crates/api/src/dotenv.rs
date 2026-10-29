//! ´mod:module:dotenv´
//!
//! Reading `.env` at startup, and saying so when the read went wrong.
//!
//! Every binary loads the file so a plain `cargo run` behaves like the make
//! targets (development.md "Environment Variables"); real environment
//! variables still win, because dotenvy never overrides. dotenvy stops at
//! the first line it cannot parse and every variable from there on is
//! unset, with nothing said — an unquoted value with spaces silently drops
//! the rest of the file. So the outcome is kept and reported once a log
//! exists, naming the line and its variable and never the value, because
//! the line may carry a secret.

use std::path::PathBuf;

/// The outcome of reading `.env`, held until it can be reported: every
/// binary reads the file before its log subscriber exists, since
/// `RUST_LOG` is one of the variables it sets.
#[derive(Debug)]
pub struct DotenvRead {
    /// The file read, if one was found.
    pub path: Option<PathBuf>,
    /// What dotenvy made of it.
    pub result: dotenvy::Result<()>,
}

/// Loads the first `.env` in the current directory or one of its parents —
/// the file `dotenvy::dotenv` finds — into the environment.
///
/// The search is made here rather than inside `dotenvy::dotenv` only to
/// keep the path, which a parse error otherwise loses and which naming the
/// failing line needs; the load itself is dotenvy's `from_path`.
pub fn read() -> DotenvRead {
    let path = std::env::current_dir().ok().and_then(|dir| {
        dir.ancestors()
            .map(|ancestor| ancestor.join(".env"))
            .find(|candidate| candidate.is_file())
    });
    let result = match &path {
        Some(path) => dotenvy::from_path(path),
        None => Ok(()),
    };
    DotenvRead { path, result }
}

impl DotenvRead {
    /// What went wrong, worded for whoever started the binary — `None`
    /// when nothing did. No file is nothing wrong: a deployment
    /// configures through its real environment.
    pub fn problem(&self) -> Option<String> {
        match &self.result {
            Ok(()) => None,
            Err(e) if e.not_found() => None,
            Err(dotenvy::Error::LineParse(fragment, column)) => {
                let file = self
                    .path
                    .as_deref()
                    .map_or_else(|| ".env".to_owned(), |path| path.display().to_string());
                let place = self
                    .path
                    .as_deref()
                    .and_then(|path| std::fs::read_to_string(path).ok())
                    .and_then(|text| failing_line(&text, fragment))
                    .map(|(number, variable)| format!("line {number} (setting {variable})"))
                    .unwrap_or_else(|| format!("a line (at column {column})"));
                Some(format!(
                    "{file}: {place} cannot be parsed, so it and every variable after it are \
                     unset — a value with spaces needs double quotes"
                ))
            }
            Err(e) => Some(format!(".env could not be read: {e}")),
        }
    }

    /// Logs [`DotenvRead::problem`], once the subscriber is up.
    ///
    /// At error level, not warn, because the failure can hide its own
    /// warning: when the read stopped before `RUST_LOG`, the filter falls
    /// back to `EnvFilter`'s default, which admits errors only. A
    /// deployment has no file, so this never fires there.
    pub fn report(&self) {
        if let Some(problem) = self.problem() {
            tracing::error!("{problem}");
        }
    }
}

/// The 1-based number and the variable of the line a parse error came
/// from.
///
/// dotenvy's error carries the text it failed on — the whole line for a
/// malformed name, only the value for a malformed value — so the culprit
/// is the first line that contains that text and fails to parse on its
/// own. The variable is everything before the `=`, without an `export`.
fn failing_line(text: &str, fragment: &str) -> Option<(usize, String)> {
    text.lines().enumerate().find_map(|(index, line)| {
        let fails = line.contains(fragment)
            && dotenvy::from_read_iter(line.as_bytes()).any(|item| item.is_err());
        fails.then(|| {
            let name = line.split('=').next().unwrap_or_default().trim();
            let name = name.strip_prefix("export ").unwrap_or(name).trim();
            (index + 1, name.to_owned())
        })
    })
}

#[cfg(test)]
mod tests {
    use super::failing_line;

    /// The culprit is found from either kind of fragment dotenvy reports:
    /// a value it stopped inside, or a whole line whose name is malformed.
    ///
    /// A parse error is traced to its line and variable, from a value fragment or a whole malformed line alike.
    /// ´claim:dotenv:a-parse-error-is-traced-to-its-line´
    #[test]
    fn a_parse_error_is_traced_to_its_line() {
        let text = "A=1\nexport B=two words\nC=3\n";
        let fragment = match dotenvy::from_read_iter(text.as_bytes()).find_map(Result::err) {
            Some(dotenvy::Error::LineParse(fragment, _)) => fragment,
            other => panic!("expected a parse error, got {other:?}"),
        };
        assert_eq!(failing_line(text, &fragment), Some((2, "B".to_owned())));

        let text = "A=1\n9LIVES=x\n";
        let fragment = match dotenvy::from_read_iter(text.as_bytes()).find_map(Result::err) {
            Some(dotenvy::Error::LineParse(fragment, _)) => fragment,
            other => panic!("expected a parse error, got {other:?}"),
        };
        assert_eq!(
            failing_line(text, &fragment),
            Some((2, "9LIVES".to_owned()))
        );
    }
}
