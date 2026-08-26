#![no_main]
//! `cddl_parse` — arbitrary text into [`Theory::parse`], asserting only
//! that it never panics; parse failure is a returned `Err`, not a crash
//! (´preview:xchg:fuzz-plan´).
//!
//! Known finding: the CDDL grammar has an exponential-backtracking path,
//! so a hostile nested theory makes `parse` hang. Under libfuzzer this
//! surfaces as a `-timeout` report, not a crash — it is the recorded
//! parser-DoS, not a new defect. Run this target with `-timeout=10`.

use cogra_interchange::Theory;
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if let Ok(s) = std::str::from_utf8(data) {
        let _ = Theory::parse(s);
    }
});
