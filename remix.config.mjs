/** @type {import("@remix-run/dev").AppConfig} */
export default {
  publicPath: "/_static/build/",
  serverBuildPath: "src/http/any-catchall/remix-build.mjs",
  serverModuleFormat: "esm",
  future: {
    unstable_dev: true,
    v2_errorBoundary: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
};
