import * as fs from "node:fs";
import * as path from "node:path";
import { logDevReady } from "@remix-run/node";
import { readConfig } from "@remix-run/dev/dist/config.js";

let lastTimeout;
/**
 * Broadcasts the build hash to the Remix dev server on a timeout.
 * @param {string} buildPath
 */
function broadcast(buildPaths) {
  if (lastTimeout) {
    clearTimeout(lastTimeout);
  }

  lastTimeout = setTimeout(async () => {
    const sent = new Set();
    for (const buildPath of buildPaths) {
      const contents = fs.readFileSync(buildPath, "utf8");
      const manifestMatches = contents.matchAll(/manifest-([A-f0-9]+)\.js/g);
      for (const match of manifestMatches) {
        const buildHash = match[1].toLowerCase();
        if (!sent.has(buildHash)) {
          sent.add(buildHash);
          logDevReady({ assets: { version: buildHash } });
        }
      }
    }
  }, 10);
}

let buildPaths = new Set();
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
      if (userBuildPath) {
        buildPaths.add(path.resolve(process.cwd(), userBuildPath));
      }

      const remixConfig = await readConfig();
      if (!userBuildPath && !remixConfig.serverBundles) {
        buildPaths.add(
          path.resolve(process.cwd(), remixConfig.serverBuildPath)
        );
      }

      if (remixConfig.serverBundles) {
        remixConfig.serverBundles.forEach((bundle) => {
          buildPaths.add(
            path.resolve(remixConfig.rootDirectory, bundle.serverBuildPath)
          );
        });
      }

      // Broadcast the build hash to the Remix dev server.
      broadcast(buildPaths);
    },
    watcher({ filename }) {
      // If the build path changes, broadcast the build hash to the
      // Remix dev server
      if (buildPaths.has(filename)) {
        broadcast(buildPaths);
      }
    },
  },
};
