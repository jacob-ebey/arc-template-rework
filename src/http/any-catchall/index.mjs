import { installGlobals } from "@remix-run/node";
import { createRequestHandler } from "@remix-run/architect";

import * as build from "./remix-build.mjs";

installGlobals();

export const handler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});
