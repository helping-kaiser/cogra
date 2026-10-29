// The web container's health probe (deployment.md "Health"): a static
// asset `next start` serves without calling the API, so an API outage does
// not mark the web server unhealthy and restart it for nothing.
try {
  const res = await fetch("http://127.0.0.1:3000/favicon.ico", {
    signal: AbortSignal.timeout(5000),
  });
  process.exit(res.ok ? 0 : 1);
} catch {
  process.exit(1);
}
