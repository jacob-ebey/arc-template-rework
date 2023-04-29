@app
remix-arc-rework

@http
any /
any /about
any /post-a/:id

@static

@plugins
plugin-remix
  src plugin-remix.mjs

@aws
# profile default
region us-west-2
architecture arm64
