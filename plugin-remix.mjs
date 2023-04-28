import * as fs from "node:fs";
import * as path from "node:path";
import { logDevReady } from "@remix-run/node";
import { readConfig } from "@remix-run/dev/dist/config.js";

let lastTimeout;
/**
 * Broadcasts the build hash to the Remix dev server on a timeout.
 * @param {string} buildPath
 */
function broadcast(buildPath) {
  if (lastTimeout) {
    clearTimeout(lastTimeout);
  }

  lastTimeout = setTimeout(async () => {
    const contents = fs.readFileSync(buildPath, "utf8");
    const manifestMatches = contents.matchAll(/manifest-([A-f0-9]+)\.js/g);
    const sent = new Set();
    for (const match of manifestMatches) {
      const buildHash = match[1].toLowerCase();
      if (!sent.has(buildHash)) {
        sent.add(buildHash);
        logDevReady({ assets: { version: buildHash } });
      }
    }
  }, 10);
}

let buildPath;
export default {
  set: {
    env() {
      return {
        // Forward on the NODE_ENV to the runtime so the proper commonjs
        // node_modules are loaded.
        NODE_ENV:
          process.env.NODE_ENV === "development" ? "development" : "production",
      };
    },
  },
  sandbox: {
    async start({ arc }) {
      // Get the build path from @remix build-path in app.arc or from the
      // remix config if not manually specified.
      const props = new Map(arc.remix || []);
      let userBuildPath = props.get("build-path");

      if (!userBuildPath) {
        const remixConfig = await readConfig();
        userBuildPath = remixConfig.serverBuildPath;
      }

      buildPath = path.resolve(process.cwd(), userBuildPath);

      // Broadcast the build hash to the Remix dev server.
      broadcast(buildPath);
    },
    watcher({ filename }) {
      // If the build path changes, broadcast the build hash to the
      // Remix dev server
      if (filename === buildPath) {
        broadcast(buildPath);
      }
    },
  },
};
