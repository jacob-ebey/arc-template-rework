import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { logDevReady } from "@remix-run/node";
import { readConfig } from "@remix-run/dev/dist/config.js";

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

      for (const buildPath of buildPaths) {
        ensureLambdaHandler(buildPath);
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

/**
 * @param {import("@remix-run/dev/dist/config/routes").RouteManifest} routes
 */
export function arcServerBundles(routes) {
  /** @type {Map<string, {
   *   route: import("@remix-run/dev/dist/config/routes").ConfigRoute;
   *   isLeaf: boolean;
   * }>} */
  const allRouteConfigsById = new Map();
  /** @type {Map<string, import("@remix-run/dev/dist/config/routes").ConfigRoute>} */
  const leafRouteConfigsById = new Map();
  const allRoutes = Object.values(routes).sort(
    (a, b) => b.id.length - a.id.length
  );

  for (const route of allRoutes) {
    let isLeaf = true;
    for (const other of Object.values(routes)) {
      if (other.parentId === route.id) {
        isLeaf = false;
        break;
      }
    }
    allRouteConfigsById.set(route.id, { route, isLeaf });
    if (isLeaf) {
      leafRouteConfigsById.set(route.id, route);
    }
  }

  let results = [];
  for (const leafRoute of leafRouteConfigsById.values()) {
    const serverBuildPath = createServerBuildPath(
      leafRoute,
      allRouteConfigsById
    );
    results.push({
      serverBuildPath,
      routes: [leafRoute.id],
    });
  }

  return results;
}

/**
 *
 * @param {import("@remix-run/dev/dist/config/routes").ConfigRoute} route
 * @param {Map<string, {
 *   route: import("@remix-run/dev/dist/config/routes").ConfigRoute;
 *   isLeaf: boolean;
 * }>} allRouteConfigsById
 */
function createServerBuildPath(route, allRouteConfigsById) {
  let path = createServerBuildPathRecursive(route, allRouteConfigsById);
  if (!path) {
    path = "index";
  }
  return `src/http/any-${path}/remix-build.mjs`;
}
/**
 * @param {import("@remix-run/dev/dist/config/routes").ConfigRoute} route
 * @param {Map<string, {
 *   route: import("@remix-run/dev/dist/config/routes").ConfigRoute;
 *   isLeaf: boolean;
 * }>} allRouteConfigsById
 */
function createServerBuildPathRecursive(route, allRouteConfigsById) {
  let result = "";
  if (route.parentId) {
    const parent = allRouteConfigsById.get(route.parentId);
    if (parent) {
      result = createServerBuildPathRecursive(
        parent.route,
        allRouteConfigsById
      );
    }
  }

  if (route.path) {
    result =
      route.path
        .split("/")
        .map((segment) =>
          // replace `:` with `000`
          // replace `-` with `_`
          // replace `*` with `catchall`
          segment
            .replace(/^:/g, "000")
            .replace(/-/g, "_")
            .replace(/^\*$/g, "catchall")
        )
        .join("-") + result;
  }

  return result;
}

const templatePath = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "plugin-remix-handler-template.mjs"
);
function ensureLambdaHandler(buildPath) {
  const handlerPath = path.join(path.dirname(buildPath), "index.mjs");
  if (!fs.existsSync(handlerPath)) {
    fs.mkdirSync(path.dirname(handlerPath), { recursive: true });
    console.log(
      `Creating new lambda handler ${path.relative(process.cwd(), handlerPath)}`
    );
    fs.copyFileSync(templatePath, handlerPath);
  }
}

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
