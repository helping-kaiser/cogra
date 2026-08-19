// Starts the dev server over https (development.md "Reaching the web dev
// server from the phone").
//
// `next dev --experimental-https` on its own generates an mkcert certificate
// naming only localhost, which a phone rejects the moment it dials the dev
// machine by IP. `scripts/stamp-net.sh` regenerates the pair in certificates/
// with the machine's current address among the names; passing them through
// Next's --experimental-https-key/-cert is what pins the server to that pair
// instead of leaving Next free to overwrite it. Without the pair — a fresh
// clone, or a machine that never stamped — Next generates its own, which still
// serves the localhost tunnel route.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(fileURLToPath(import.meta.url), "../..");

/** The https flags for `next dev`, given the directory holding the pair. */
export function httpsArgs(certificatesDir) {
  const key = path.join(certificatesDir, "localhost-key.pem");
  const cert = path.join(certificatesDir, "localhost.pem");

  if (!existsSync(key) || !existsSync(cert)) return ["--experimental-https"];

  return [
    "--experimental-https",
    "--experimental-https-key",
    key,
    "--experimental-https-cert",
    cert,
  ];
}

function main() {
  const args = [
    "dev",
    ...httpsArgs(path.join(webRoot, "certificates")),
    ...process.argv.slice(2),
  ];
  // Run Next's entry point on this Node rather than the node_modules/.bin
  // shim, which is a shell script on POSIX and a .cmd on Windows.
  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");

  spawn(process.execPath, [next, ...args], { stdio: "inherit", cwd: webRoot }).on(
    "exit",
    (code, signal) => {
      process.exit(signal ? 1 : (code ?? 1));
    },
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
