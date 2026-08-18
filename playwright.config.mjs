/* End-to-end tests for Juke.

   The suite starts both halves of the app itself: the static site, which is
   just a directory served over http, and the worker, which is the room. Both
   are the same commands `.claude/launch.json` uses for development, so there
   is one way to run this thing rather than two.

   The ports are pinned rather than assigned. `live.js` decides where the room
   is by looking at the address bar — localhost means `ws://127.0.0.1:8787` —
   so the worker has to be on that port for the page to find it, and picking a
   free port would quietly test a page that cannot reach any room at all.

   Serial, one worker. Every test drives a shared room on a shared port, and
   two specs racing each other through the same Durable Object would be
   testing the harness. */

import { defineConfig } from "@playwright/test";

/* Re-exported from the helpers rather than declared again. These two used to
   be written out in both files — the same fact in two places, which is the
   drift this project has a rule about — and nothing would have complained if
   they had ever disagreed except a suite quietly testing a server nobody was
   running. The helpers own them because that is where the env override lives. */
export { SITE, WORKER_HTTP } from "./tests/helpers.mjs";
import { SITE, WORKER_HTTP, LOCAL_SITE } from "./tests/helpers.mjs";

export default defineConfig({
  testDir: "./tests",
  // A full room draft is 140 picks paced at 500ms, so about two minutes, and
  // the point of the test is that it reaches the end rather than that it is
  // quick about it.
  timeout: 6 * 60 * 1000,
  expect: { timeout: 15 * 1000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],

  use: {
    baseURL: SITE,
    // Nothing here is a visual test, and a trace on a two-minute draft is
    // large. Kept for failures only, where it is the whole point.
    trace: "retain-on-failure",
    video: "off"
  },

  /* Both are waited on by `port` rather than by `url`, which matters for the
     worker: it has no health route, and every address it does answer is a 404
     until somebody creates a room. Waiting for a URL therefore waits for a
     2xx that is never coming, and the suite times out with both servers up
     and perfectly healthy. A listening port is the honest question here. */
  /* Only start servers when the suite is actually pointed at localhost. Aimed
     at the deployed site there is nothing to start, and a webServer block
     waiting on a port nobody will ever listen on just times the run out
     before it begins. LOCAL_SITE comes from the helpers beside SITE itself,
     so what counts as local is decided in one place. */
  webServer: !LOCAL_SITE ? undefined : [
    {
      /* `py` is the Windows launcher and is the only thing that works there;
         it does not exist anywhere else, so the suite could not start its own
         static server on Linux or macOS at all — it failed with "py: not
         found" before a single test ran. Same reason CLAUDE.md tells you to
         run the pipeline as `py scripts/build_players.py`: this project is
         developed on Windows. Picked per platform rather than changed, so the
         Windows path is untouched. */
      command: (process.platform === "win32" ? "py" : "python3") + " -m http.server 8765",
      port: 8765,
      reuseExistingServer: true,
      timeout: 30 * 1000
    },
    {
      command: "npx --yes wrangler@4 dev -c worker/wrangler.toml --port 8787 --local",
      port: 8787,
      reuseExistingServer: true,
      timeout: 120 * 1000
    }
  ]
});
