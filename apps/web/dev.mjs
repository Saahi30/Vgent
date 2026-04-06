/**
 * Custom dev server that warms all routes on startup.
 * Prevents the Webpack freeze issue where compiling routes
 * on-demand causes the process to deadlock after ~750 modules.
 */
import { createServer } from "http";
import { parse } from "url";
import next from "next";

const app = next({ dev: true, dir: "." });
const handle = app.getRequestHandler();

const ROUTES = [
  "/", "/agents", "/contacts", "/knowledge-bases", "/live",
  "/settings/providers", "/admin", "/calls", "/settings/team",
  "/settings/usage", "/campaigns/new", "/agents/new",
];

async function warmRoute(baseUrl, route) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    await fetch(`${baseUrl}${route}`, { signal: controller.signal });
    clearTimeout(timeout);
    console.log(`  ✓ ${route}`);
  } catch {
    console.log(`  ✗ ${route} (will compile on first visit)`);
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    req.setTimeout(60000);
    res.setTimeout(60000);
    handle(req, res, parse(req.url, true));
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  server.listen(3000, async () => {
    console.log("> Ready on http://localhost:3000");
    console.log("> Warming routes...");

    // Warm routes sequentially with delays to avoid deadlock
    for (const route of ROUTES) {
      await warmRoute("http://localhost:3000", route);
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log("> All routes warmed. Server ready for use.");
  });
});
