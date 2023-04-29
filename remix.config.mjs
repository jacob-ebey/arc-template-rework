import { arcServerBundles } from "./plugin-remix.mjs";

/** @type {import("@remix-run/dev").AppConfig} */
export default {
  publicPath: "/_static/build/",
  serverModuleFormat: "esm",
  // serverBuildPath: "src/http/any-catchall/remix-build.mjs",
  serverBundles: arcServerBundles,
  // [
  //   {
  //     serverBuildPath: "src/http/any-about/remix-build.mjs",
  //     routes: ["routes/about"],
  //   },
  //   {
  //     serverBuildPath: "src/http/any-catchall/remix-build.mjs",
  //     catchAll: true,
  //   },
  // ],
  future: {
    unstable_dev: true,
    v2_errorBoundary: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
};
