//! A scratch probe over the real tree, for the slice's own measurements.
use std::collections::BTreeMap;
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let adoption = cogra_linter::Adoption::load(&root.join("corpus-adoption.toml"))?;
    let started = std::time::Instant::now();
    let run = cogra_linter::run::check(&adoption, &root)?;
    println!("wall {:?}", started.elapsed());
    println!("timing {}", run.timing);
    println!("sources {}", run.sources.len());
    println!("nodes {} edges {}", run.graph.node_count(), run.graph.edge_count());
    println!("findings {} failing {}", run.findings.len(), run.failing().count());
    let mut by_rule: BTreeMap<&str, usize> = BTreeMap::new();
    for one in &run.findings {
        *by_rule.entry(one.rule.as_str()).or_default() += 1;
    }
    for (rule, count) in &by_rule {
        println!("  {rule}: {count}");
    }
    println!("--- failing findings ---");
    for one in run.failing().take(60) {
        println!("{}:{}:{}: {} {}: {}", one.primary.path.display(), one.primary.line, one.primary.column, match one.severity { cogra_linter::Severity::Error => "error", cogra_linter::Severity::Warning => "warning" }, one.rule, one.message);
    }
    Ok(())
}
