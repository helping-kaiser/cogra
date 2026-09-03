// Serves the production build over https (development.md "Hand-testing
// against a production build").
//
// WHY A PRODUCTION BUILD AT ALL. The dev server compiles routes on demand,
// so the first visit to every screen pays a build; on a phone over the LAN
// that is the difference between a hand test and a wait. `next build` +
// `next start` is what the app actually ships as, and it answers at once.
//
// WHY A PROXY RATHER THAN A CUSTOM SERVER. `next start` speaks plain http
// only. Next's self-hosting guide puts a reverse proxy in front rather
// than teaching the server TLS — "it's recommended to use a reverse proxy
// (like nginx) in front of your Next.js server" — so this is that proxy,
// written against `node:https` and `node:http` alone so the prod path
// needs nothing this repo does not already carry. The alternative, a
// custom server (`next({ dev: false })` behind `https.createServer`),
// Next's own custom-server guide calls an eject to reach for only when
// the integrated router cannot meet the app's needs; it would also put
// the hand test on a server that is not the one `next start` runs, which
// is the opposite of what a production hand test is for.
//
// THE CERTIFICATE IS THE DEV SERVER'S. `scripts/stamp-net.sh` issues one
// mkcert pair naming `localhost` and this machine's current address, and
// `scripts/dev.mjs` hands it to `next dev`. The prod path reads the same
// pair from the same directory, so a phone that already trusts the dev
// origin trusts this one, and the guest APK's pinned CA keeps working.
//
// `next start` is bound to the loopback: only the TLS front is on the
// LAN, so the plain-http hop never leaves the machine.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer as createHttpsServer } from "node:https";
import { request as httpRequest } from "node:http";
import { connect } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(fileURLToPath(import.meta.url), "../..");

/** The https port the phone dials. */
export const DEFAULT_PORT = 3000;

/** The loopback port `next start` is bound to, behind the TLS front. */
export const DEFAULT_UPSTREAM_PORT = 3001;

/** How long to wait for `next start` to accept connections before giving up. */
export const UPSTREAM_READY_TIMEOUT_MS = 120_000;

/**
 * How long one request may take to arrive in full.
 *
 * NODE CUTS A SLOW UPLOAD AT FIVE MINUTES by default: `requestTimeout` is
 * 300000 ms and it measures the WHOLE request, body included, so a large upload
 * on a slow link is destroyed halfway up with nothing said about why. That is a
 * second ceiling under Next's own proxy timeout, and the lower of the two is
 * the one that decides — so this front has to be at least as patient as the
 * router behind it or raising the router's would change nothing.
 *
 * It matches `UPLOAD_PROXY_TIMEOUT_MS` in `next.config.ts` — 100 MiB, the
 * largest body the contract admits, at roughly 1 Mbit/s. `prod-timeouts.test.ts`
 * pins the two together so neither can be raised alone.
 */
export const REQUEST_TIMEOUT_MS = 900_000;

/**
 * How long the HEADERS may take. Left at Node's own minute: headers arrive in
 * one burst at the start of a request, so a slow body is not what this bounds,
 * and shortening the window an idle connection can hold is worth keeping.
 */
export const HEADERS_TIMEOUT_MS = 60_000;

/**
 * The TLS pair from the stamped directory, or null where the machine
 * never stamped one. Null is a refusal rather than a fallback: the whole
 * point of this path is an https origin the phone already trusts, and a
 * self-signed stand-in would neither be trusted by the guest APK nor
 * name this machine's address.
 */
export function tlsCredentials(certificatesDir) {
  const key = path.join(certificatesDir, "localhost-key.pem");
  const cert = path.join(certificatesDir, "localhost.pem");
  if (!existsSync(key) || !existsSync(cert)) return null;
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

/**
 * The headers the upstream receives. Next builds absolute URLs and reads
 * the request's origin from these, so a proxy that dropped them would
 * have the app believe it is serving plain http on the loopback.
 *
 * `x-forwarded-*` are set rather than appended: this is the edge, so
 * whatever a client sent under those names is its own claim, not a hop
 * this deployment made.
 */
export function forwardedHeaders(headers, { host, remoteAddress }) {
  return {
    ...headers,
    host,
    "x-forwarded-host": host,
    "x-forwarded-proto": "https",
    "x-forwarded-for": remoteAddress ?? "",
  };
}

/** How long to leave between connection attempts while waiting. */
const RETRY_MS = 100;

/**
 * Resolves once something accepts a TCP connection on the port.
 *
 * The deadline is its own timer rather than a check inside the retry
 * loop: a connection attempt that is refused comes back at once, but one
 * that is dropped — a filtered port, a host that never answers — hangs
 * instead, and a loop that only re-checks the clock on failure would
 * wait on it forever.
 */
export function waitForPort(port, host, { timeoutMs = UPSTREAM_READY_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let socket = null;
    let retry = null;
    let expiry = null;
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (expiry !== null) clearTimeout(expiry);
      if (retry !== null) clearTimeout(retry);
      socket?.destroy();
      if (error === undefined) resolve();
      else reject(error);
    };

    expiry = setTimeout(
      () => finish(new Error(`nothing accepted a connection on ${host}:${port}`)),
      Math.max(0, timeoutMs),
    );

    const attempt = () => {
      if (settled) return;
      socket = connect({ port, host });
      socket.once("connect", () => finish());
      socket.once("error", () => {
        socket?.destroy();
        retry = setTimeout(attempt, RETRY_MS);
      });
    };
    attempt();
  });
}

/**
 * The TLS front. Bodies are piped in both directions and never buffered:
 * the App Router streams its responses, and a proxy that collected them
 * first would turn every streamed page into a wait for the last byte.
 */
export function createProxy(credentials, { upstreamPort, upstreamHost }) {
  const server = createHttpsServer(credentials, (req, res) => {
    const upstream = httpRequest(
      {
        host: upstreamHost,
        port: upstreamPort,
        method: req.method,
        path: req.url,
        headers: forwardedHeaders(req.headers, {
          host: req.headers.host ?? `${upstreamHost}:${upstreamPort}`,
          remoteAddress: req.socket.remoteAddress,
        }),
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
      res.end("The production server behind this origin is not answering.\n");
    });
    req.pipe(upstream);
  });

  // Set after construction rather than through the options object: these are
  // properties of the server, and assigning them is what Node documents.
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
  return server;
}

function main() {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const upstreamPort = Number(process.env.WEB_UPSTREAM_PORT ?? DEFAULT_UPSTREAM_PORT);
  const upstreamHost = "127.0.0.1";

  const credentials = tlsCredentials(path.join(webRoot, "certificates"));
  if (credentials === null) {
    console.error(
      "No certificate pair in web/certificates — run scripts/stamp-net.sh first.\n" +
        "The prod hand-test origin has to be one the phone already trusts.",
    );
    process.exit(1);
  }

  // Next's own entry point on this Node rather than the node_modules/.bin
  // shim, which is a shell script on POSIX and a .cmd on Windows.
  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const server = spawn(
    process.execPath,
    [next, "start", "-H", upstreamHost, "-p", String(upstreamPort)],
    { stdio: "inherit", cwd: webRoot },
  );

  const proxy = createProxy(credentials, { upstreamPort, upstreamHost });

  const shutdown = () => {
    proxy.close();
    server.kill("SIGTERM");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  server.on("exit", (code, signal) => {
    proxy.close();
    process.exit(signal ? 1 : (code ?? 1));
  });

  waitForPort(upstreamPort, upstreamHost)
    .then(() => {
      // Every interface, so the phone on the LAN reaches it; the plain
      // http hop stays on the loopback behind this.
      proxy.listen(port, "0.0.0.0", () => {
        console.log(`> Production build served over https on port ${port}`);
      });
    })
    .catch((error) => {
      console.error(String(error));
      shutdown();
      process.exit(1);
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
