use std::path::Path;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let adoption = cogra_linter::Adoption::load(&root.join("corpus-adoption.toml"))?;
    let run = cogra_linter::run::check(&adoption, &root)?;
    let want = std::env::args().nth(1).unwrap_or_default();
    for one in &run.findings {
        if !one.rule.as_str().contains(&want) { continue; }
        println!("{}:{}:{}: {} [{}]: {}", one.primary.path.display(), one.primary.line, one.primary.column, one.rule, if one.enforcement == cogra_linter::Enforcement::Failing {"F"} else {"a"}, one.message);
        for rel in &one.related {
            println!("    {}:{}:{}: {}", rel.at.path.display(), rel.at.line, rel.at.column, rel.note);
        }
    }
    Ok(())
}
